from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from db.supabase import supabase
from agent.authz import get_auth_payload, require_caretaker_patient
from routes.assistant import TOOL_LABELS

caretaker_ai_router = APIRouter(prefix="/caretaker", tags=["CareTaker AI"])


class ValidateMemoryRequest(BaseModel):
    status: str  # ACTIVE | REJECTED
    edit_title: Optional[str] = None
    edit_content: Optional[str] = None


def _summarize_conversation(messages: list) -> str:
    for m in messages:
        if m.get("sender_type") == "PATIENT" and (m.get("content") or "").strip():
            c = m["content"].strip()
            return (c[:80] + "...") if len(c) > 80 else c
    return "Conversation"


@caretaker_ai_router.get("/patients/{patient_id}/memories/pending")
def caretaker_pending_memories(patient_id: str, request: Request):
    """List memories awaiting caregiver validation with score breakdown and source context."""
    payload = get_auth_payload(request)
    require_caretaker_patient(payload, patient_id)

    pending = (
        supabase.table("memories").select("*")
        .eq("patient_id", patient_id).eq("status", "PENDING_VALIDATION")
        .order("created_at", desc=True).execute()
    ).data or []

    out = []
    for m in pending:
        source_conv = None
        if m.get("source_id"):
            try:
                c = supabase.table("messages").select("content, sender_type").eq("conversation_id", m["source_id"]).limit(3).execute()
                if c.data:
                    source_conv = " / ".join(f"{x.get('sender_type')}: {x.get('content')[:60]}" for x in c.data)
            except Exception:
                pass
        out.append({
            **m,
            "source_preview": source_conv,
            "score_breakdown": (m.get("metadata") or {}).get("score_breakdown"),
        })
    return out


@caretaker_ai_router.get("/patients/{patient_id}/conversations")
def caretaker_conversations(patient_id: str, request: Request, limit: int = Query(default=20, le=50)):
    payload = get_auth_payload(request)
    require_caretaker_patient(payload, patient_id)
    convs = (
        supabase.table("conversations").select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True).limit(limit).execute()
    ).data or []
    out = []
    for c in convs:
        msgs = (
            supabase.table("messages").select("*")
            .eq("conversation_id", c["id"])
            .order("created_at", desc=False).limit(10).execute()
        ).data or []
        out.append({**c, "preview": _summarize_conversation(msgs)})
    return out


@caretaker_ai_router.get("/patients/{patient_id}/conversations/{conversation_id}")
def caretaker_conversation_detail(patient_id: str, conversation_id: str, request: Request):
    payload = get_auth_payload(request)
    require_caretaker_patient(payload, patient_id)
    conv = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
    if not conv.data or conv.data[0].get("patient_id") != patient_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = (
        supabase.table("messages").select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False).execute()
    ).data or []
    out = []
    for m in msgs:
        item = {
            "id": m["id"], "sender_type": m["sender_type"],
            "content": m["content"], "created_at": m["created_at"],
        }
        if m.get("tool_name"):
            tools = (m.get("tool_name") or "").split("+")
            item["tools_used"] = [TOOL_LABELS.get(t, t) for t in tools if t]
        out.append(item)
    return {"conversation": conv.data[0], "messages": out}


@caretaker_ai_router.get("/patients/{patient_id}/ai-activity")
def ai_activity(patient_id: str, request: Request, date: Optional[str] = None):
    from datetime import date as d

    payload = get_auth_payload(request)
    require_caretaker_patient(payload, patient_id)
    day = date or d.today().isoformat()
    daily = (
        supabase.table("daily_ai_summaries").select("*")
        .eq("patient_id", patient_id).eq("date", day).execute()
    )
    convs = (
        supabase.table("conversations").select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True).limit(10).execute()
    ).data or []
    recent = []
    for c in convs:
        msgs = (
            supabase.table("messages").select("*")
            .eq("conversation_id", c["id"])
            .order("created_at", desc=False).limit(5).execute()
        ).data or []
        recent.append({"id": c["id"], "created_at": c["created_at"], "preview": _summarize_conversation(msgs)})
    memories = (
        supabase.table("memories").select("*")
        .eq("patient_id", patient_id).eq("status", "ACTIVE")
        .order("created_at", desc=True).limit(10).execute()
    ).data or []
    pending = (
        supabase.table("memories").select("*")
        .eq("patient_id", patient_id).eq("status", "PENDING_VALIDATION")
        .order("created_at", desc=True).execute()
    ).data or []
    return {
        "date": day,
        "daily_summary": daily.data[0] if daily.data else None,
        "recent_conversations": recent,
        "important_memories": memories[:5],
        "pending_validation": pending,
    }


@caretaker_ai_router.get("/patients/{patient_id}/daily-summary")
def caretaker_daily_summary(patient_id: str, request: Request, date: Optional[str] = None):
    from datetime import date as d

    payload = get_auth_payload(request)
    require_caretaker_patient(payload, patient_id)
    day = date or d.today().isoformat()
    res = (
        supabase.table("daily_ai_summaries").select("*")
        .eq("patient_id", patient_id).eq("date", day).execute()
    )
    return res.data[0] if res.data else {"patient_id": patient_id, "date": day, "summary": "", "important_events": []}


@caretaker_ai_router.post("/memories/{memory_id}/validate")
def validate_memory(memory_id: str, data: ValidateMemoryRequest, request: Request):
    """
    Caregiver approves, edits, or rejects a pending memory.
    If ACTIVE: synchronizes memory to ChromaDB.
    If REJECTED: removes vector from ChromaDB.
    """
    from datetime import datetime, timezone
    from agent import vectorstore

    payload = get_auth_payload(request)
    if payload.get("role") != "CareTaker":
        raise HTTPException(status_code=403, detail="CareTaker access required")
    if data.status not in ("ACTIVE", "REJECTED"):
        raise HTTPException(status_code=400, detail="status must be ACTIVE or REJECTED")

    mem_res = supabase.table("memories").select("*").eq("id", memory_id).execute()
    if not mem_res.data:
        raise HTTPException(status_code=404, detail="Memory not found")
    mem = mem_res.data[0]
    pid = mem["patient_id"]
    require_caretaker_patient(payload, pid)

    now_iso = datetime.now(timezone.utc).isoformat()
    updates = {
        "status": data.status,
        "updated_at": now_iso,
    }

    if data.edit_title:
        updates["title"] = data.edit_title.strip()
    if data.edit_content:
        updates["content"] = data.edit_content.strip()

    if data.status == "ACTIVE":
        updates["last_confirmed_at"] = now_iso
        final_title = updates.get("title", mem.get("title", ""))
        final_content = updates.get("content", mem.get("content", ""))
        final_type = mem.get("memory_type", "IMPORTANT_FACT")

        supabase.table("memories").update(updates).eq("id", memory_id).execute()
        # Synchronize to ChromaDB vector store
        vectorstore.upsert_memory_vector(
            patient_id=pid,
            memory_id=memory_id,
            text=f"{final_title}. {final_content}",
            memory_type=final_type,
            status="ACTIVE",
        )
    else:
        supabase.table("memories").update(updates).eq("id", memory_id).execute()
        # Remove from vector store
        vectorstore.delete_memory_vector(patient_id=pid, memory_id=memory_id)

    return {"message": f"Memory {data.status.lower()}", "memory_id": memory_id, "status": data.status}

