"""Retention cleanup. Deletes expired chat detail, never long-term memories."""
from datetime import datetime, timedelta, timezone
from db.supabase import supabase
from config.settings import (
    CHAT_RETENTION_DAYS,
    CHAT_CLEANUP_ENABLED,
    MEMORY_CLEANUP_ENABLED,
)
from agent import vectorstore


def delete_expired_conversations(enabled: bool | None = None) -> dict:
    should_run = CHAT_CLEANUP_ENABLED if enabled is None else enabled
    if not should_run:
        return {"cleaned": 0, "reason": "cleanup_disabled"}
    cutoff = (datetime.now(timezone.utc) - timedelta(days=CHAT_RETENTION_DAYS)).isoformat()
    try:
        old = supabase.table("conversations").select("id").lt("created_at", cutoff).execute()
    except Exception as e:
        return {"cleaned": 0, "reason": f"lookup_failed: {e}"}
    ids = [r["id"] for r in (old.data or [])]
    cleaned = 0
    for cid in ids:
        try:
            # Messages cascade via FK; memories + daily summaries are untouched.
            supabase.table("messages").delete().eq("conversation_id", cid).execute()
            supabase.table("conversations").delete().eq("id", cid).execute()
            cleaned += 1
        except Exception:
            continue
    return {"cleaned": cleaned, "cutoff": cutoff}


def expire_outdated_memories(enabled: bool | None = None, force: bool = False) -> dict:
    """
    Idempotent memory expiration worker:
    1. Finds ACTIVE memories whose expires_at is in the past.
    2. Updates their status to EXPIRED in PostgreSQL.
    3. Removes their vector records from ChromaDB.
    4. Preserves medicines, reminders, appointments, documents, and chat records.
    """
    should_run = force or (MEMORY_CLEANUP_ENABLED if enabled is None else enabled)
    if not should_run:
        return {"expired_count": 0, "reason": "memory_cleanup_disabled"}

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        # Find active memories that have passed expiration
        res = (
            supabase.table("memories")
            .select("id, patient_id, expires_at, status, retention_policy")
            .eq("status", "ACTIVE")
            .lte("expires_at", now_iso)
            .execute()
        )
        expired_rows = res.data or []
    except Exception as e:
        return {"expired_count": 0, "reason": f"lookup_failed: {e}"}

    expired_ids = []
    for r in expired_rows:
        mid = r["id"]
        pid = r["patient_id"]
        try:
            # Update status in PostgreSQL (never deletes patient's audit trail)
            supabase.table("memories").update({
                "status": "EXPIRED",
                "updated_at": now_iso,
            }).eq("id", mid).execute()

            # Remove or disable in ChromaDB so it is excluded from semantic retrieval
            vectorstore.delete_memory_vector(patient_id=pid, memory_id=mid)
            expired_ids.append(mid)
        except Exception:
            continue

    return {
        "expired_count": len(expired_ids),
        "expired_ids": expired_ids,
        "timestamp": now_iso,
    }

