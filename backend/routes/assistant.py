from fastapi import APIRouter, Request, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import logging
import traceback
from db.supabase import supabase
from agent.authz import get_auth_payload, authenticated_patient_id
from agent.orchestrator import orchestrator
from agent.tools_impl import search_patient_memories
from agent.cleanup import delete_expired_conversations
from services.ocr_service import process_document_ocr
from services.medical_record_service import extract_medical_data_from_ocr, compare_medicine_with_records

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
    "get_patient_routine": "Checked daily routine",
    "save_to_routine": "Saved to daily routine",
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


@assistant_router.post("/chat-with-file")
async def chat_with_file(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    conversation_id: Optional[str] = Form(None),
    request: Request = None,
):
    """Processes an uploaded medicine image or document, runs high-speed OCR,
    extracts medication details, compares against patient medical records,
    and returns an AI response grounded in the records (or offering Caretaker escalation).
    """
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 1. High-speed local OCR (<300ms)
    ocr_res = process_document_ocr(file_bytes, file.filename or "uploaded_medicine", file.content_type)
    raw_ocr = ocr_res["text"]

    # 2. Medical entity extraction
    extracted = extract_medical_data_from_ocr(raw_ocr)
    meds = extracted.get("medications", [])

    # 3. Cross-reference against patient medical records
    comp = compare_medicine_with_records(patient_id, meds, raw_ocr)

    user_query = (message or "").strip() or "Should I take this medicine?"
    med_name = comp.get("detected_name", "the scanned medicine")
    med_dose = comp.get("detected_dosage", "")

    # 4. Formulate contextual prompt for orchestrator
    if comp["status"] == "VERIFIED":
        context_prompt = (
            f"[Patient uploaded medicine image/doc '{file.filename}']\n"
            f"Patient asked: {user_query}\n"
            f"OCR detected medicine: {med_name} {med_dose}.\n"
            f"Medical record check: VERIFIED in patient's records ({comp['matched_record'].get('name')}).\n"
            f"Record details: {comp['matched_record'].get('content')}.\n"
            f"Please verify this warmly for the patient, confirm that it matches their prescribed medical records, and mention any instructions."
        )
    else:
        known_str = ", ".join(comp.get("all_active_prescriptions", [])) or "No active prescriptions on file"
        context_prompt = (
            f"[Patient uploaded medicine image/doc '{file.filename}']\n"
            f"Patient asked: {user_query}\n"
            f"OCR detected text/medicine: '{med_name}' (dosage: {med_dose or 'not specified'}).\n"
            f"Medical record check: NOT FOUND in active medical records or prescriptions.\n"
            f"Patient's known active prescriptions on file: {known_str}.\n"
            f"CRITICAL: Inform the patient gently and clearly that '{med_name}' is NOT in their prescribed medical records, "
            f"advise them NOT to take it without confirmation, and ask if they would like you to notify their caretaker regarding it."
        )

    try:
        chat_resp = orchestrator.chat(patient_id, context_prompt, conversation_id)
        # Augment chat response with OCR and match metadata
        chat_resp["detected_medicine"] = comp
        chat_resp["ocr_summary"] = raw_ocr[:200]
        chat_resp["ocr_duration_ms"] = ocr_res["duration_ms"]
        chat_resp["file_name"] = file.filename
        if comp["status"] != "VERIFIED":
            chat_resp["suggest_caretaker_escalation"] = True
            chat_resp["escalation_question"] = f"Can I take {med_name}? (Not found in my medical records)"

        return chat_resp
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error("Assistant chat-with-file failed (RuntimeError): %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Assistant chat-with-file failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


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
def list_memories(request: Request, status: Optional[str] = "ACTIVE"):
    from agent.memory_service import get_patient_memories
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    return get_patient_memories(patient_id, status=status)


@assistant_router.get("/memories/search")
def search_memories(request: Request, q: str = Query(default=""), limit: int = Query(default=5, le=20)):
    from agent.memory_service import search_verified_memories
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    if not q.strip():
        return []
    return search_verified_memories(patient_id, q, limit=limit)


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
