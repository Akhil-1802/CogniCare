"""Long-term memory service. PostgreSQL is source of truth."""
import uuid
from datetime import datetime, timezone
from db.supabase import supabase
from agent.schemas import validate_extraction_payload
from agent import vectorstore


def _now():
    return datetime.now(timezone.utc).isoformat()


def _keywords(text: str):
    import re

    words = re.findall(r"[a-z]{3,}", (text or "").lower())
    stop = {"the", "and", "for", "with", "that", "this", "from", "have", "has", "are", "was", "were", "will", "you", "your", "our"}
    return {w for w in words if w not in stop}


def find_candidate_duplicates(patient_id: str, title: str, content: str, limit: int = 10):
    """Keyword-overlap lookup + semantic lookup. Returns list of memory rows."""
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
    new_keys = _keywords(title + " " + content)
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
        if r["id"] in semantic_ids and all(x[1]["id"] != r["id"] for x in scored):
            scored.append((0.35, r))
    return [r for _, r in scored[:limit]]


def create_or_update_memory(
    patient_id: str,
    extraction: dict,
    source_type: str = "conversation",
    source_id: str | None = None,
):
    """Validate, dedupe, create or update. Never silently overwrite conflicts."""
    valid = validate_extraction_payload(extraction)
    if valid is None:
        return {"created": False, "reason": "invalid_or_not_important"}

    dups = find_candidate_duplicates(patient_id, valid.title, valid.content)
    now = _now()

    for d in dups:
        old_content = (d.get("content") or "").strip().lower()
        new_content = valid.content.strip().lower()
        if old_content == new_content:
            # Exact duplicate → touch timestamp, keep single record
            try:
                supabase.table("memories").update({
                    "confidence": max(float(d.get("confidence", 0)), valid.confidence),
                    "updated_at": now,
                }).eq("id", d["id"]).execute()
            except Exception:
                pass
            return {"created": False, "reason": "duplicate", "memory_id": d["id"]}
        # Similar title, different content → potential conflict.
        # Keep old ACTIVE, create new as PENDING_VALIDATION for caregiver review.
        try:
            mid = uuid.uuid4().hex
            row = {
                "id": mid,
                "patient_id": patient_id,
                "title": valid.title,
                "content": valid.content,
                "memory_type": valid.memory_type,
                "importance": valid.importance,
                "confidence": valid.confidence,
                "source_type": source_type,
                "source_id": source_id,
                "status": "PENDING_VALIDATION",
                "created_at": now,
                "updated_at": now,
            }
            supabase.table("memories").insert(row).execute()
            vectorstore.upsert_memory_vector(
                patient_id, mid, f"{valid.title}. {valid.content}", valid.memory_type
            )
            return {"created": True, "memory_id": mid, "status": "PENDING_VALIDATION", "conflict_with": d["id"]}
        except Exception as e:
            return {"created": False, "reason": f"db_error: {e}"}

    try:
        mid = uuid.uuid4().hex
        row = {
            "id": mid,
            "patient_id": patient_id,
            "title": valid.title,
            "content": valid.content,
            "memory_type": valid.memory_type,
            "importance": valid.importance,
            "confidence": valid.confidence,
            "source_type": source_type,
            "source_id": source_id,
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now,
        }
        supabase.table("memories").insert(row).execute()
        vectorstore.upsert_memory_vector(
            patient_id, mid, f"{valid.title}. {valid.content}", valid.memory_type
        )
        return {"created": True, "memory_id": mid, "status": "ACTIVE"}
    except Exception as e:
        return {"created": False, "reason": f"db_error: {e}"}
