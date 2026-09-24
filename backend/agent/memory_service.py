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
    - 'CONFLICT': Contradictory information or major update on same subject/entity.
    - 'REINFORCEMENT': Same verified fact repeated.
    - 'NEW_FACT': Distinct event or separate topic.
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
        return "NEW_FACT"

    # If title is identical or very similar but content differs noticeably:
    # E.g. "Emily lives in Delhi" vs "Emily moved to Mumbai"
    if (old_title == new_title or (old_title in new_title and len(old_title) > 5)):
        # Contradictory update or conflict
        return "CONFLICT"

    # Entity-level conflict check (e.g. lives in, moved, changed phone)
    conflict_markers = ["moved to", "lives in", "changed", "new address", "no longer", "instead of"]
    if any(m in new_content for m in conflict_markers) and any(e.lower() in old_content for e in candidate.entities if len(e) > 3):
        return "CONFLICT"

    return "NEW_FACT"


def create_or_update_memory(
    patient_id: str,
    extraction: Union[dict, ExtractedFactCandidate],
    source_type: str = "conversation",
    source_id: Optional[str] = None,
    source_message_id: Optional[str] = None,
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
                return create_or_update_memory(patient_id, cands[0], source_type, source_id, source_message_id, speech_confidence)
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
        elif rel == "CONFLICT":
            conflict_with_id = d["id"]
            novelty_score = 70.0
            break

    # Step 2: Calculate Weighted Score
    score_breakdown = MemoryScoringService.calculate_score(
        candidate=candidate,
        novelty_score=novelty_score,
        speech_confidence=speech_confidence,
    )

    # Step 3: Evaluate Decision & Retention
    decision_result = MemoryDecisionService.evaluate_decision(
        candidate=candidate,
        score_breakdown=score_breakdown,
        has_conflict=bool(conflict_with_id),
    )

    if decision_result.decision == "DISCARD":
        return {
            "created": False,
            "reason": "discarded_low_score",
            "score": score_breakdown.total_score,
            "decision": decision_result.decision,
        }

    # Step 4: Persist in PostgreSQL
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
        "source_type": source_type,
        "source_id": source_id,
        "source_message_id": source_message_id,
        "status": decision_result.status,
        "metadata": {
            "score_breakdown": score_breakdown.model_dump(),
            "decision": decision_result.decision,
            "entities": candidate.entities,
            "event_date": candidate.event_date,
            "conflict_with": conflict_with_id,
            "requires_review": decision_result.requires_review,
            "reason": decision_result.reason,
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
    if decision_result.status == "ACTIVE":
        try:
            vectorstore.upsert_memory_vector(
                patient_id=patient_id,
                memory_id=mid,
                text=f"{candidate.title}. {candidate.content}",
                memory_type=candidate.memory_type,
                status="ACTIVE",
            )
        except Exception as e:
            logger.warning("ChromaDB vector sync failed (Postgres record preserved): %s", e)

    out = {
        "created": True,
        "memory_id": mid,
        "status": decision_result.status,
        "decision": decision_result.decision,
        "total_score": score_breakdown.total_score,
    }
    if conflict_with_id:
        out["conflict_with"] = conflict_with_id
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
                "id": mem["id"],
                "title": mem["title"],
                "content": mem["content"],
                "memory_type": mem["memory_type"],
                "distance": h.get("distance"),
                "relevance_score": relevance,
                "created_at": mem["created_at"],
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
