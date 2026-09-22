"""Retention cleanup. Deletes expired chat detail, never long-term memories."""
from datetime import datetime, timedelta, timezone
from db.supabase import supabase
from config.settings import CHAT_RETENTION_DAYS, CHAT_CLEANUP_ENABLED


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
