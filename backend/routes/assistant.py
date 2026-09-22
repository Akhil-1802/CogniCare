from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging
import traceback
from db.supabase import supabase
from agent.authz import get_auth_payload, authenticated_patient_id
from agent.orchestrator import orchestrator
from agent.tools_impl import search_patient_memories
from agent.cleanup import delete_expired_conversations

logger = logging.getLogger("cognicare.assistant")

assistant_router = APIRouter(prefix="/assistant", tags=["Assistant"])


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class EscalateRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


TOOL_LABELS = {
    "get_today_medicines": "Checked medicine schedule",
    "get_upcoming_appointments": "Checked appointments",
    "get_patient_reminders": "Checked reminders",
    "search_patient_memories": "Searched long-term memories",
    "search_patient_documents": "Searched documents",
    "create_reminder": "Created a reminder",
    "none": "General chat",
}


@assistant_router.post("/chat")
def chat(data: ChatRequest, request: Request):
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    try:
        return orchestrator.chat(patient_id, data.message, data.conversation_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error("Assistant chat failed (RuntimeError): %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Assistant chat failed (%s): %s\n%s", type(e).__name__, e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


@assistant_router.post("/escalate")
def escalate_question(data: EscalateRequest, request: Request):
    """Directly escalate an unanswered question to the patient's Caretaker."""
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    from routes.notifications import create_inquiry_notification
    notif = create_inquiry_notification(
        patient_id=patient_id,
        question=data.question,
        category="general",
        metadata={"conversation_id": data.conversation_id}
    )
    reply = (
        f"I've sent a notification to your caretaker asking: '{data.question}'. "
        "As soon as they reply, you'll receive a notification and it will be saved in your records."
    )
    if data.conversation_id:
        try:
            from agent.orchestrator import _store_message
            _store_message(
                data.conversation_id,
                "ASSISTANT",
                reply,
                metadata={"notification_id": notif["id"], "escalation_fulfilled": True}
            )
        except Exception:
            pass
    return {
        "message": "Caretaker notified",
        "notification": notif,
        "reply": reply,
    }


@assistant_router.get("/health")
def assistant_health(request: Request):
    """Diagnose chat readiness: key, models, DB tables, vector index."""
    from config.settings import MISTRAL_API_KEY, MISTRAL_MODEL, MISTRAL_EMBED_MODEL
    from agent import vectorstore

    checks: dict = {
        "mistral_key_configured": bool(MISTRAL_API_KEY),
        "chat_model": MISTRAL_MODEL,
        "embed_model": MISTRAL_EMBED_MODEL,
    }
    # DB tables (read-only probe; patient-scoped check happens per-request)
    for table in ("conversations", "messages", "memories", "daily_ai_summaries", "reminders", "notifications"):
        try:
            supabase.table(table).select("id").limit(1).execute()
            checks[f"db_{table}"] = "ok"
        except Exception as e:
            checks[f"db_{table}"] = f"ERROR: {type(e).__name__}: {str(e)[:200]}"
    # Mistral reachability (cheap: no tokens if key bad — error surfaces here, not in chat)
    try:
        from agent.llm import chat_llm

        llm = chat_llm()
        resp = llm.invoke("Reply with exactly: ok")
        checks["mistral_chat"] = f"ok: {str(getattr(resp, 'content', ''))[:50]}"
    except Exception as e:
        checks["mistral_chat"] = f"ERROR: {type(e).__name__}: {str(e)[:300]}"
    # Chroma
    try:
        col = vectorstore.get_collection()
        checks["chroma"] = "ok" if col is not None else "ERROR: collection unavailable"
    except Exception as e:
        checks["chroma"] = f"ERROR: {type(e).__name__}: {str(e)[:200]}"
    return checks


@assistant_router.get("/conversations")
def list_conversations(request: Request, limit: int = Query(default=20, le=50)):
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    res = (
        supabase.table("conversations").select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True).limit(limit).execute()
    )
    return res.data or []


@assistant_router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, request: Request):
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    conv = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
    if not conv.data or conv.data[0].get("patient_id") != patient_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = (
        supabase.table("messages").select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False).execute()
    )
    out = []
    for m in (msgs.data or []):
        # Never expose internal prompts / keys / reasoning
        item = {
            "id": m["id"], "sender_type": m["sender_type"],
            "content": m["content"], "created_at": m["created_at"],
        }
        if m.get("tool_name"):
            tools = (m.get("tool_name") or "").split("+")
            item["tools_used"] = [TOOL_LABELS.get(t, t) for t in tools if t]
        out.append(item)
    return {"conversation": conv.data[0], "messages": out}


@assistant_router.get("/memories")
def list_memories(request: Request, status: Optional[str] = None):
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    q = supabase.table("memories").select("*").eq("patient_id", patient_id)
    if status:
        q = q.eq("status", status)
    res = q.order("created_at", desc=True).limit(100).execute()
    return res.data or []


@assistant_router.get("/memories/search")
def search_memories(request: Request, q: str = Query(default="")):
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    if not q.strip():
        return []
    return search_patient_memories(patient_id, q)


@assistant_router.get("/daily-summary")
def daily_summary(request: Request, date: Optional[str] = None):
    from datetime import date as d

    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    day = date or d.today().isoformat()
    res = (
        supabase.table("daily_ai_summaries").select("*")
        .eq("patient_id", patient_id).eq("date", day).execute()
    )
    return res.data[0] if res.data else {"patient_id": patient_id, "date": day, "summary": "", "important_events": []}


@assistant_router.post("/cleanup")
def run_cleanup(request: Request):
    payload = get_auth_payload(request)
    if payload.get("role") != "CareTaker":
        raise HTTPException(status_code=403, detail="CareTaker access required")
    return delete_expired_conversations()
