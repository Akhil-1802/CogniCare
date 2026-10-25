"""Long-term memory service for CogniCare.
PostgreSQL is the source of truth; ChromaDB provides semantic retrieval.
Evaluates candidates using MemoryScoringService and MemoryDecisionService.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union

from db.supabase import supabase
from agent.schemas import (
    ExtractedFactCandidate,
    validate_extraction_payload,
    validate_candidate,
)
from agent.scoring_service import MemoryScoringService
from agent.decision_service import MemoryDecisionService, calculate_memory_relevance
from agent import vectorstore

logger = logging.getLogger("cognicare.memory")


def _now():
    return datetime.now(timezone.utc).isoformat()


def _keywords(text: str):
    import re
    words = re.findall(r"[a-z]{3,}", (text or "").lower())
    stop = {
        "the", "and", "for", "with", "that", "this", "from", "have", "has",
        "are", "was", "were", "will", "you", "your", "our", "patient",
    }
    return {w for w in words if w not in stop}


def find_candidate_duplicates(patient_id: str, title: str, content: str, limit: int = 10):
    """Keyword-overlap lookup + semantic lookup over non-rejected memories for a patient."""
    try:
        rows = (
            supabase.table("memories")
            .select("*")
            .eq("patient_id", patient_id)
            .neq("status", "REJECTED")
            .limit(50)
            .execute()
        ).data or []
    except Exception:
        return []

    new_keys = _keywords(f"{title} {content}")
    scored = []
    for r in rows:
        old_keys = _keywords(f"{r.get('title','')} {r.get('content','')}")
        overlap = len(new_keys & old_keys) / max(len(new_keys | old_keys), 1)
        if overlap >= 0.3 or (title and title.lower() in (r.get("title", "") or "").lower()):
            scored.append((overlap, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    semantic_ids = set()
    try:
        for hit in vectorstore.search_memory_vectors(patient_id, f"{title} {content}", k=5):
            semantic_ids.add(hit["memory_id"])
    except Exception:
        pass

    for r in rows:
        if r.get("id") in semantic_ids and all(x[1].get("id") != r.get("id") for x in scored):
            scored.append((0.35, r))

    return [r for _, r in scored[:limit]]


def classify_candidate_relation(candidate: ExtractedFactCandidate, existing: dict) -> str:
    """
    Classifies relationship between new candidate and existing memory:
    - 'DUPLICATE': Identical or virtually identical fact.
    - 'UPDATE_CANDIDATE': New or changed information superseding an existing fact.
    - 'CONFLICT': Contradictory information on same subject requiring review.
    - 'NEW': Distinct event or separate topic.
    """
    old_content = (existing.get("content") or "").strip().lower()
    new_content = candidate.content.strip().lower()
    old_title = (existing.get("title") or "").strip().lower()
    new_title = candidate.title.strip().lower()

    if old_content == new_content:
        return "DUPLICATE"

    # Distinct events are NOT duplicates just because the person/category is shared
    # E.g. "Emily is daughter" (RELATIONSHIP) vs "Emily called me today" (EVENT)
    old_type = existing.get("memory_type")
    new_type = candidate.memory_type

    if old_type != new_type and ("event" in (old_type or "").lower() or "event" in (new_type or "").lower()):
        return "NEW"

    # Check for update markers indicating changing status/location/schedule
    update_markers = ["moved to", "lives in now", "changed to", "new address", "new phone", "switched to", "now lives", "no longer", "instead of"]
    has_update_marker = any(m in new_content for m in update_markers)

    # If title is identical or very similar:
    # E.g. "Emily lives in Delhi" vs "Emily moved to Mumbai"
    if old_title == new_title or (old_title in new_title and len(old_title) > 5):
        return "UPDATE_CANDIDATE" if has_update_marker else "CONFLICT"

    # Entity-level conflict / update check
    if has_update_marker and any(e.lower() in old_content for e in candidate.entities if len(e) > 3):
        return "UPDATE_CANDIDATE"

    if any(e.lower() in old_content for e in candidate.entities if len(e) > 3) and old_type == new_type:
        return "CONFLICT"

    return "NEW"


def create_or_update_memory(
    patient_id: str,
    extraction: Union[dict, ExtractedFactCandidate],
    source_type: str = "conversation",
    source_id: Optional[str] = None,
    source_message_id: Optional[str] = None,
    source_document_id: Optional[str] = None,
    speech_confidence: float = 1.0,
) -> dict:
    """
    Validates, scores, dedupes, decides, and persists a memory candidate.
    Supports both ExtractedFactCandidate and legacy dictionary payloads.
    PostgreSQL is source of truth; ChromaDB is kept in sync for ACTIVE memories.
    """
    # Normalize input into an ExtractedFactCandidate
    candidate: Optional[ExtractedFactCandidate] = None
    if isinstance(extraction, ExtractedFactCandidate):
        candidate = extraction
    elif isinstance(extraction, dict):
        if "candidates" in extraction:
            cands = extraction.get("candidates")
            if cands and isinstance(cands, list):
                return create_or_update_memory(patient_id, cands[0], source_type, source_id, source_message_id, source_document_id, speech_confidence)
        # Check if legacy format
        if extraction.get("should_create_memory") is False:
            return {"created": False, "reason": "invalid_or_not_important"}
        legacy = validate_extraction_payload(extraction)
        if legacy:
            imp_val = 90.0 if legacy.importance == "HIGH" else (40.0 if legacy.importance == "LOW" else 70.0)
            candidate = ExtractedFactCandidate(
                title=legacy.title,
                content=legacy.content,
                memory_type=legacy.memory_type,
                confidence=legacy.confidence,
                importance_estimate=imp_val,
                source_conversation_id=source_id,
                source_message_id=source_message_id,
                source_document_id=source_document_id,
                source_type=source_type,
            )
        else:
            cand = validate_candidate(extraction)
            if cand:
                candidate = cand

    if candidate is None:
        return {"created": False, "reason": "invalid_or_not_important"}

    # Step 1: Duplicate and conflict detection
    dups = find_candidate_duplicates(patient_id, candidate.title, candidate.content)
    now = _now()

    conflict_with_id: Optional[str] = None
    novelty_score = 100.0
    detected_relation = "NEW"

    for d in dups:
        rel = classify_candidate_relation(candidate, d)
        if rel == "DUPLICATE":
            # Exact duplicate -> update confirmation and confidence
            try:
                new_conf = max(float(d.get("confidence", 0)), candidate.confidence)
                supabase.table("memories").update({
                    "confidence": new_conf,
                    "last_confirmed_at": now,
                    "updated_at": now,
                }).eq("id", d["id"]).execute()
            except Exception:
                pass
            return {"created": False, "reason": "duplicate", "memory_id": d["id"]}
        elif rel in ("CONFLICT", "UPDATE_CANDIDATE"):
            conflict_with_id = d["id"]
            detected_relation = rel
            novelty_score = 70.0
            break

    # Step 2: Calculate Weighted Score
    score_breakdown = MemoryScoringService.calculate_score(
        candidate=candidate,
        novelty_score=novelty_score,
        speech_confidence=speech_confidence,
        duplicate_status=detected_relation,
    )

    # Step 3: Evaluate Decision & Retention
    decision_result = MemoryDecisionService.evaluate_decision(
        candidate=candidate,
        score_breakdown=score_breakdown,
        has_conflict=bool(conflict_with_id),
        supersedes_id=conflict_with_id if detected_relation == "UPDATE_CANDIDATE" else None,
        duplicate_status=detected_relation,
    )

    if decision_result.decision == "DISCARD":
        return {
            "created": False,
            "reason": "discarded_low_score",
            "score": score_breakdown.total_score,
            "decision": decision_result.decision,
        }

    # Step 4: Persist in PostgreSQL (Source of Truth)
    mid = uuid.uuid4().hex
    importance_label = "HIGH" if score_breakdown.importance >= 75 else ("LOW" if score_breakdown.importance < 40 else "MEDIUM")

    row = {
        "id": mid,
        "patient_id": patient_id,
        "title": candidate.title,
        "content": candidate.content,
        "memory_type": candidate.memory_type,
        "importance": importance_label,
        "confidence": candidate.confidence,
        "importance_score": score_breakdown.importance,
        "confidence_score": score_breakdown.confidence,
        "usefulness_score": score_breakdown.usefulness,
        "persistence_score": score_breakdown.persistence,
        "novelty_score": score_breakdown.novelty,
        "total_score": score_breakdown.total_score,
        "retention_days": decision_result.retention_days,
        "retention_policy": decision_result.retention_policy,
        "last_confirmed_at": now,
        "expires_at": decision_result.expires_at,
        "source_type": source_type or candidate.source_type,
        "source_id": source_id or candidate.source_conversation_id,
        "source_message_id": source_message_id or candidate.source_message_id,
        "status": decision_result.status,
        "metadata": {
            "score_breakdown": score_breakdown.model_dump(),
            "decision": decision_result.decision,
            "entities": candidate.entities,
            "event_date": candidate.event_date,
            "conflict_with": conflict_with_id,
            "supersedes_id": conflict_with_id if detected_relation == "UPDATE_CANDIDATE" else None,
            "requires_review": decision_result.requires_review,
            "review_reason": decision_result.review_reason,
            "reason": decision_result.reason,
            "vector_synced": False,
        },
        "created_at": now,
        "updated_at": now,
    }

    try:
        supabase.table("memories").insert(row).execute()
    except Exception as e:
        logger.error("Failed to insert memory into PostgreSQL: %s", e)
        return {"created": False, "reason": f"db_error: {e}"}

    # Step 5: Sync to ChromaDB (Only ACTIVE memories indexed for ordinary retrieval)
    vector_synced = False
    vector_sync_error = None
    if decision_result.status == "ACTIVE":
        try:
            ok = vectorstore.upsert_memory_vector(
                patient_id=patient_id,
                memory_id=mid,
                text=f"{candidate.title}. {candidate.content}",
                memory_type=candidate.memory_type,
                status="ACTIVE",
            )
            vector_synced = bool(ok)
        except Exception as e:
            logger.warning("ChromaDB vector sync failed (Postgres record preserved): %s", e)
            vector_sync_error = str(e)
            vector_synced = False

        if vector_synced or vector_sync_error:
            try:
                row["metadata"]["vector_synced"] = vector_synced
                if vector_sync_error:
                    row["metadata"]["vector_sync_error"] = vector_sync_error
                supabase.table("memories").update({"metadata": row["metadata"]}).eq("id", mid).execute()
            except Exception:
                pass

    out = {
        "created": True,
        "memory_id": mid,
        "status": decision_result.status,
        "decision": decision_result.decision,
        "total_score": score_breakdown.total_score,
        "vector_synced": vector_synced,
    }
    if conflict_with_id:
        out["conflict_with"] = conflict_with_id
    if detected_relation == "UPDATE_CANDIDATE":
        out["supersedes_id"] = conflict_with_id
    return out


def process_patient_message_memories(
    patient_id: str,
    patient_message: str,
    assistant_reply: str = "",
    conversation_id: Optional[str] = None,
    message_id: Optional[str] = None,
    speech_confidence: float = 1.0,
) -> List[dict]:
    """
    Extracts all memory candidates from a patient message and processes each candidate independently.
    Returns list of results for each candidate.
    """
    from agent.extraction import MemoryExtractionService

    candidates = MemoryExtractionService.extract_candidates(
        patient_message=patient_message,
        assistant_reply=assistant_reply,
        conversation_id=conversation_id,
        message_id=message_id,
        speech_confidence=speech_confidence,
    )

    results = []
    for cand in candidates:
        res = create_or_update_memory(
            patient_id=patient_id,
            extraction=cand,
            source_type="conversation",
            source_id=conversation_id,
            source_message_id=message_id,
            speech_confidence=speech_confidence,
        )
        results.append({
            "candidate_title": cand.title,
            "memory_type": cand.memory_type,
            **res,
        })
    return results


def get_patient_memories(
    patient_id: str,
    status: Optional[str] = "ACTIVE",
    include_relevance: bool = True,
    limit: int = 50,
) -> List[dict]:
    """
    Fetches memories for a patient from PostgreSQL (source of truth).
    Filters by status, excludes expired memories from ordinary retrieval,
    and attaches calculated relevance score.
    """
    try:
        q = supabase.table("memories").select("*").eq("patient_id", patient_id)
        if status:
            q = q.eq("status", status)
        rows = (q.order("created_at", desc=True).limit(limit).execute()).data or []
    except Exception as e:
        logger.error("Failed to fetch memories: %s", e)
        return []

    now_dt = datetime.now(timezone.utc)
    out = []
    for r in rows:
        # If requesting ACTIVE memories, filter out any whose expires_at is past
        if status == "ACTIVE" and r.get("expires_at"):
            try:
                exp_dt = datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00"))
                if exp_dt < now_dt:
                    continue
            except Exception:
                pass

        if include_relevance:
            confirmed_str = r.get("last_confirmed_at") or r.get("created_at")
            confirmed_dt = None
            if confirmed_str:
                try:
                    confirmed_dt = datetime.fromisoformat(confirmed_str.replace("Z", "+00:00"))
                except Exception:
                    pass
            tot_score = float(r.get("total_score") or 70.0)
            r["relevance_score"] = calculate_memory_relevance(
                tot_score, confirmed_dt, r.get("memory_type", "IMPORTANT_FACT"), now_dt
            )
        out.append(r)

    if include_relevance:
        out.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
    return out


def search_verified_memories(patient_id: str, query: str, limit: int = 5) -> List[dict]:
    """
    Semantic search over patient's verified ACTIVE memories.
    Cross-checks ChromaDB results against PostgreSQL to guarantee only eligible
    ACTIVE, unexpired memories belonging to the authenticated patient are returned.
    """
    if not query.strip():
        return []

    vector_hits = vectorstore.search_memory_vectors(patient_id, query, k=limit * 2)
    if not vector_hits:
        return []

    hit_ids = [h["memory_id"] for h in vector_hits]
    try:
        rows = (
            supabase.table("memories")
            .select("*")
            .eq("patient_id", patient_id)
            .in_("id", hit_ids)
            .eq("status", "ACTIVE")
            .execute()
        ).data or []
    except Exception:
        return []

    now_dt = datetime.now(timezone.utc)
    row_map = {}
    for r in rows:
        # Check expiration
        if r.get("expires_at"):
            try:
                exp_dt = datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00"))
                if exp_dt < now_dt:
                    continue
            except Exception:
                pass
        row_map[r["id"]] = r

    verified_results = []
    for h in vector_hits:
        mid = h["memory_id"]
        if mid in row_map:
            mem = row_map[mid]
            confirmed_str = mem.get("last_confirmed_at") or mem.get("created_at")
            confirmed_dt = None
            if confirmed_str:
                try:
                    confirmed_dt = datetime.fromisoformat(confirmed_str.replace("Z", "+00:00"))
                except Exception:
                    pass
            relevance = calculate_memory_relevance(
                float(mem.get("total_score") or 70.0), confirmed_dt, mem.get("memory_type", "IMPORTANT_FACT"), now_dt
            )
            verified_results.append({
                "id": mem.get("id"),
                "title": mem.get("title", ""),
                "content": mem.get("content", ""),
                "memory_type": mem.get("memory_type", "IMPORTANT_FACT"),
                "distance": h.get("distance"),
                "relevance_score": relevance,
                "created_at": mem.get("created_at", ""),
            })
            if len(verified_results) >= limit:
                break

    return verified_results


def update_patient_memory(
    patient_id: str,
    memory_id: str,
    title: Optional[str] = None,
    content: Optional[str] = None,
    reconfirm: bool = False,
) -> dict:
    """Updates a memory record by the patient or authorized caregiver."""
    existing = (
        supabase.table("memories").select("*").eq("id", memory_id).execute()
    ).data
    if not existing or existing[0].get("patient_id") != patient_id:
        return {"success": False, "error": "not_found"}

    now = _now()
    updates: Dict[str, Any] = {"updated_at": now}
    if title is not None:
        updates["title"] = title.strip()
    if content is not None:
        updates["content"] = content.strip()
    if reconfirm:
        updates["last_confirmed_at"] = now

    try:
        supabase.table("memories").update(updates).eq("id", memory_id).execute()
        updated_row = {**existing[0], **updates}
        if updated_row.get("status") == "ACTIVE":
            vectorstore.upsert_memory_vector(
                patient_id=patient_id,
                memory_id=memory_id,
                text=f"{updated_row.get('title')}. {updated_row.get('content')}",
                memory_type=updated_row.get("memory_type", "IMPORTANT_FACT"),
                status="ACTIVE",
            )
        return {"success": True, "memory": updated_row}
    except Exception as e:
        return {"success": False, "error": str(e)}


def delete_patient_memory(patient_id: str, memory_id: str, soft_delete: bool = True) -> bool:
    """Soft-deletes (ARCHIVED) or removes a memory and removes it from ChromaDB."""
    existing = (
        supabase.table("memories").select("*").eq("id", memory_id).execute()
    ).data
    if not existing or existing[0].get("patient_id") != patient_id:
        return False

    try:
        if soft_delete:
            supabase.table("memories").update({
                "status": "ARCHIVED",
                "updated_at": _now(),
            }).eq("id", memory_id).execute()
        else:
            supabase.table("memories").delete().eq("id", memory_id).execute()

        vectorstore.delete_memory_vector(patient_id, memory_id)
        return True
    except Exception:
        return False


def reconcile_memory_vectors(patient_id: Optional[str] = None, force_reindex: bool = False) -> dict:
    """
    Reconciles ChromaDB vector index with PostgreSQL source of truth.
    1. Upserts any ACTIVE unexpired memories missing in ChromaDB or marked vector_synced=False.
    2. Removes any vectors from ChromaDB for memories that are EXPIRED, ARCHIVED, or REJECTED.
    3. Idempotent and safe to run multiple times.
    """
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()

    try:
        q = supabase.table("memories").select("*")
        if patient_id:
            q = q.eq("patient_id", patient_id)
        rows = q.execute().data or []
    except Exception as e:
        logger.error("Failed to query memories for vector reconciliation: %s", e)
        return {"success": False, "error": str(e), "synced": 0, "deleted": 0, "failed": 0}

    synced_count = 0
    deleted_count = 0
    failed_count = 0

    for mem in rows:
        mid = mem["id"]
        pid = mem["patient_id"]
        st = mem.get("status")
        meta = mem.get("metadata") or {}

        # Check expiration
        is_expired = False
        if mem.get("expires_at"):
            try:
                exp_dt = datetime.fromisoformat(mem["expires_at"].replace("Z", "+00:00"))
                if exp_dt < now_dt:
                    is_expired = True
            except Exception:
                pass

        if st == "ACTIVE" and not is_expired:
            already_synced = meta.get("vector_synced") is True
            if not already_synced or force_reindex:
                try:
                    ok = vectorstore.upsert_memory_vector(
                        patient_id=pid,
                        memory_id=mid,
                        text=f"{mem.get('title')}. {mem.get('content')}",
                        memory_type=mem.get("memory_type", "IMPORTANT_FACT"),
                        status="ACTIVE",
                    )
                    if ok:
                        meta["vector_synced"] = True
                        meta.pop("vector_sync_error", None)
                        supabase.table("memories").update({
                            "metadata": meta,
                            "updated_at": now_iso,
                        }).eq("id", mid).execute()
                        synced_count += 1
                    else:
                        failed_count += 1
                except Exception as e:
                    logger.warning("Vector reconciliation failed for memory %s: %s", mid, e)
                    failed_count += 1
        else:
            # Memory is EXPIRED, ARCHIVED, REJECTED, or PENDING_VALIDATION -> remove from ChromaDB
            try:
                vectorstore.delete_memory_vector(patient_id=pid, memory_id=mid)
                deleted_count += 1
            except Exception:
                pass

    return {
        "success": True,
        "synced": synced_count,
        "deleted": deleted_count,
        "failed": failed_count,
    }


def resolve_memory_conflict(
    patient_id: str,
    candidate_memory_id: str,
    action: str,  # "keep_existing", "replace_with_candidate", "edit"
    edit_title: Optional[str] = None,
    edit_content: Optional[str] = None,
    resolver_role: str = "CareTaker",
) -> dict:
    """
    Resolves a conflict or update between a candidate memory and an existing memory:
    - 'keep_existing': rejects the candidate memory and preserves the existing fact.
    - 'replace_with_candidate': archives the superseded memory with an audit trace, activates candidate, syncs vector.
    - 'edit': updates candidate title/content, archives the old memory, activates candidate, syncs vector.
    """
    cand_res = (
        supabase.table("memories").select("*").eq("id", candidate_memory_id).execute()
    )
    if not cand_res.data or cand_res.data[0].get("patient_id") != patient_id:
        return {"success": False, "error": "Candidate memory not found"}

    cand = cand_res.data[0]
    meta = cand.get("metadata") or {}
    conflict_with_id = meta.get("conflict_with") or meta.get("supersedes_id")
    now_iso = datetime.now(timezone.utc).isoformat()

    if action == "keep_existing":
        # Reject candidate
        supabase.table("memories").update({
            "status": "REJECTED",
            "updated_at": now_iso,
            "metadata": {
                **meta,
                "rejection_reason": "Caregiver chose to keep existing memory",
                "resolved_at": now_iso,
                "resolved_by": resolver_role,
            },
        }).eq("id", candidate_memory_id).execute()
        vectorstore.delete_memory_vector(patient_id, candidate_memory_id)
        return {
            "success": True,
            "action": "keep_existing",
            "rejected_id": candidate_memory_id,
        }

    elif action in ("replace_with_candidate", "edit"):
        # Archive the old conflicting/superseded memory if exists
        if conflict_with_id:
            try:
                old_mem = (
                    supabase.table("memories").select("*").eq("id", conflict_with_id).execute()
                ).data
                if old_mem:
                    old_meta = old_mem[0].get("metadata") or {}
                    supabase.table("memories").update({
                        "status": "ARCHIVED",
                        "updated_at": now_iso,
                        "metadata": {
                            **old_meta,
                            "superseded_by": candidate_memory_id,
                            "archived_at": now_iso,
                            "archived_reason": "Superseded by confirmed update",
                        },
                    }).eq("id", conflict_with_id).execute()
                    vectorstore.delete_memory_vector(patient_id, conflict_with_id)
            except Exception as e:
                logger.warning("Could not archive previous memory %s: %s", conflict_with_id, e)

        # Activate candidate
        cand_updates: Dict[str, Any] = {
            "status": "ACTIVE",
            "last_confirmed_at": now_iso,
            "updated_at": now_iso,
        }
        if edit_title and edit_title.strip():
            cand_updates["title"] = edit_title.strip()
        if edit_content and edit_content.strip():
            cand_updates["content"] = edit_content.strip()

        cand_meta = {
            **meta,
            "resolved_at": now_iso,
            "resolved_by": resolver_role,
            "vector_synced": True,
        }
        cand_updates["metadata"] = cand_meta

        supabase.table("memories").update(cand_updates).eq("id", candidate_memory_id).execute()
        final_title = cand_updates.get("title", cand.get("title", ""))
        final_content = cand_updates.get("content", cand.get("content", ""))
        vectorstore.upsert_memory_vector(
            patient_id=patient_id,
            memory_id=candidate_memory_id,
            text=f"{final_title}. {final_content}",
            memory_type=cand.get("memory_type", "IMPORTANT_FACT"),
            status="ACTIVE",
        )
        return {
            "success": True,
            "action": action,
            "active_id": candidate_memory_id,
            "archived_id": conflict_with_id,
        }

    return {"success": False, "error": f"Unknown action '{action}'"}

