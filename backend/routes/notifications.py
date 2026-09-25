from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import uuid
import logging
from datetime import datetime, timezone
from db.supabase import supabase
from agent.authz import get_auth_payload
from agent.memory_service import create_or_update_memory

logger = logging.getLogger("cognicare.notifications")

notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


# In-memory fallback if the Supabase 'notifications' table hasn't been created yet
_LOCAL_NOTIFICATIONS: List[dict] = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_caretaker_for_patient(patient_id: str) -> Optional[dict]:
    try:
        res = supabase.table("patients").select("id,name,caretaker_id").eq("id", patient_id).execute()
        if res.data and res.data[0].get("caretaker_id"):
            cid = res.data[0]["caretaker_id"]
            c_res = supabase.table("caretakers").select("id,name,email,phone").eq("id", cid).execute()
            ct = c_res.data[0] if c_res.data else {"id": cid, "name": "CareTaker"}
            return {
                "patient_name": res.data[0].get("name", "Patient"),
                "caretaker_id": cid,
                "caretaker_name": ct.get("name", "CareTaker"),
                "caretaker_phone": ct.get("phone", ""),
            }
    except Exception as e:
        logger.warning("Could not lookup caretaker for patient %s: %e", patient_id, e)
    return None


def create_inquiry_notification(
    patient_id: str,
    question: str,
    category: str = "general",
    metadata: Optional[dict] = None
) -> dict:
    """Creates a new inquiry notification for the patient's caretaker."""
    info = _get_caretaker_for_patient(patient_id)
    caretaker_id = info["caretaker_id"] if info else "unknown_caretaker"
    patient_name = info["patient_name"] if info else "Patient"

    nid = f"notif_{uuid.uuid4().hex[:12]}"
    row = {
        "id": nid,
        "patient_id": patient_id,
        "caretaker_id": caretaker_id,
        "type": "caregiver_inquiry",
        "question": question.strip(),
        "response": None,
        "category": category,
        "status": "pending",
        "patient_read": True,
        "caretaker_read": False,
        "metadata": {
            **(metadata or {}),
            "patient_name": patient_name,
            "caretaker_name": info.get("caretaker_name", "CareTaker") if info else "CareTaker",
        },
        "created_at": _now(),
        "answered_at": None,
        "updated_at": _now(),
    }

    # Attempt Supabase insert
    saved = False
    try:
        res = supabase.table("notifications").insert(row).execute()
        if res.data:
            saved = True
            logger.info("Created notification %s in Supabase", nid)
    except Exception as e:
        logger.warning(
            "Supabase insert failed for notification (%s). Using in-memory fallback. "
            "Please run backend/db/notifications_table.sql in Supabase.", e
        )

    # Always keep in local fallback as cache / fallback
    _LOCAL_NOTIFICATIONS.insert(0, row)
    return row


class InquiryRequest(BaseModel):
    question: str
    category: Optional[str] = "general"
    metadata: Optional[dict] = None


class RespondRequest(BaseModel):
    response: str
    category: Optional[str] = None


@notifications_router.post("/inquiry")
def post_inquiry(data: InquiryRequest, request: Request):
    """Patient asks AI to escalate an unanswered question to their Caretaker."""
    payload = get_auth_payload(request)
    if payload.get("role") != "Patient":
        raise HTTPException(status_code=403, detail="Only patients can send inquiries")

    patient_id = payload["sub"]
    notif = create_inquiry_notification(
        patient_id=patient_id,
        question=data.question,
        category=data.category or "general",
        metadata=data.metadata or {}
    )
    return {
        "message": "Notification sent to caretaker successfully",
        "notification": notif
    }


@notifications_router.get("/patient")
def get_patient_notifications(request: Request, limit: int = Query(default=30, le=100)):
    """Fetch all notifications for the authenticated patient."""
    payload = get_auth_payload(request)
    if payload.get("role") != "Patient":
        raise HTTPException(status_code=403, detail="Patient access required")

    patient_id = payload["sub"]

    # Try Supabase first
    try:
        res = (
            supabase.table("notifications")
            .select("*")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        if res.data is not None:
            rows = list(res.data)
            existing_ids = {r["id"] for r in rows}
            for n in _LOCAL_NOTIFICATIONS:
                if n.get("patient_id") == patient_id and n["id"] not in existing_ids:
                    rows.append(n)
            return rows[:limit]
    except Exception as e:
        logger.warning("Supabase select failed for notifications (%s), using local fallback", e)

    # Fallback
    matched = [n for n in _LOCAL_NOTIFICATIONS if n.get("patient_id") == patient_id]
    return matched[:limit]


@notifications_router.get("/caretaker")
def get_caretaker_notifications(request: Request, limit: int = Query(default=30, le=100)):
    """Fetch notifications for the authenticated caretaker across their patients."""
    payload = get_auth_payload(request)
    if payload.get("role") != "CareTaker":
        raise HTTPException(status_code=403, detail="CareTaker access required")

    caretaker_id = payload["sub"]

    # Try Supabase first
    try:
        res = (
            supabase.table("notifications")
            .select("*")
            .eq("caretaker_id", caretaker_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        if res.data is not None:
            # Enrich with patient names if needed
            rows = list(res.data)
            existing_ids = {r["id"] for r in rows}
            for n in _LOCAL_NOTIFICATIONS:
                if n.get("caretaker_id") == caretaker_id and n["id"] not in existing_ids:
                    rows.append(n)

            p_ids = list({r["patient_id"] for r in rows if r.get("patient_id")})
            p_names = {}
            if p_ids:
                try:
                    p_res = supabase.table("patients").select("id,name").in_("id", p_ids).execute()
                    p_names = {p["id"]: p["name"] for p in (p_res.data or [])}
                except Exception:
                    pass
            for r in rows:
                if not r.get("metadata", {}).get("patient_name") and r.get("patient_id") in p_names:
                    r.setdefault("metadata", {})["patient_name"] = p_names[r["patient_id"]]
            return rows[:limit]
    except Exception as e:
        logger.warning("Supabase select failed for notifications (%s), using local fallback", e)

    # Fallback
    matched = [n for n in _LOCAL_NOTIFICATIONS if n.get("caretaker_id") == caretaker_id]
    return matched[:limit]


@notifications_router.post("/{notification_id}/respond")
def respond_to_notification(notification_id: str, data: RespondRequest, request: Request):
    """Caretaker responds to a patient inquiry.
    Saves answer in notification AND persists into long-term memory for semantic search.
    """
    payload = get_auth_payload(request)
    if payload.get("role") != "CareTaker":
        raise HTTPException(status_code=403, detail="Only caretakers can respond to notifications")

    caretaker_id = payload["sub"]
    clean_response = (data.response or "").strip()
    if not clean_response:
        raise HTTPException(status_code=400, detail="Response text cannot be empty")

    # Find the notification
    notif = None
    try:
        res = supabase.table("notifications").select("*").eq("id", notification_id).execute()
        if res.data:
            notif = res.data[0]
    except Exception:
        pass

    if not notif:
        for n in _LOCAL_NOTIFICATIONS:
            if n["id"] == notification_id:
                notif = n
                break

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notif.get("caretaker_id") != caretaker_id:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this notification")

    now_iso = _now()
    patient_id = notif["patient_id"]
    question = notif.get("question", "")

    # Derive memory type & title from the question / category
    q_lower = question.lower()
    cat_lower = (data.category or notif.get("category") or "").lower()

    if "medicine" in q_lower or "medicine" in cat_lower or "pill" in q_lower:
        mem_type = "MEDICINE"
        title = f"Medicine: {question[:40]}"
    elif "appointment" in q_lower or "doctor" in q_lower or "appointment" in cat_lower:
        mem_type = "APPOINTMENT"
        title = f"Appointment: {question[:40]}"
    elif any(k in q_lower for k in ("wallet", "keys", "glasses", "spectacles", "watch", "bag", "where")):
        mem_type = "IMPORTANT_FACT"
        # Extract item name
        for item in ("wallet", "keys", "glasses", "spectacles", "watch", "phone", "bag", "purse"):
            if item in q_lower:
                title = f"{item.capitalize()} location"
                break
        else:
            title = f"Item location: {question[:30]}"
    else:
        mem_type = "IMPORTANT_FACT"
        title = f"Answer to: {question[:40]}"

    # Save to memories database (PostgreSQL + ChromaDB vectorstore)
    mem_result = {"created": False}
    try:
        mem_result = create_or_update_memory(
            patient_id=patient_id,
            extraction={
                "title": title,
                "content": clean_response,
                "memory_type": mem_type,
                "importance": "HIGH",
                "confidence": 1.0,
                "should_create_memory": True,
            },
            source_type="caretaker_response",
            source_id=notification_id,
        )
        logger.info("Persisted caretaker answer to memories for patient %s: %s", patient_id, mem_result)
    except Exception as e:
        logger.error("Failed to persist memory for caretaker answer: %e", e)

    # Update notification status
    update_data = {
        "response": clean_response,
        "status": "answered",
        "answered_at": now_iso,
        "updated_at": now_iso,
        "patient_read": False,  # Patient needs to be notified!
        "caretaker_read": True,
    }

    try:
        supabase.table("notifications").update(update_data).eq("id", notification_id).execute()
    except Exception as e:
        logger.warning("Supabase update failed for notification %s: %s", notification_id, e)

    # Update in-memory fallback
    for n in _LOCAL_NOTIFICATIONS:
        if n["id"] == notification_id:
            n.update(update_data)
            break

    return {
        "message": "Response sent to patient and saved to memory database",
        "notification_id": notification_id,
        "memory": mem_result,
        "status": "answered",
    }


@notifications_router.patch("/{notification_id}/read")
def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read by patient or caretaker."""
    payload = get_auth_payload(request)
    role = payload.get("role")

    field = "patient_read" if role == "Patient" else "caretaker_read"
    try:
        supabase.table("notifications").update({field: True, "updated_at": _now()}).eq("id", notification_id).execute()
    except Exception:
        pass

    for n in _LOCAL_NOTIFICATIONS:
        if n["id"] == notification_id:
            n[field] = True
            n["updated_at"] = _now()
            break

    return {"message": "Marked as read"}


@notifications_router.get("/counts")
def get_notification_counts(request: Request):
    """Returns counts of pending and unread notifications for badges."""
    payload = get_auth_payload(request)
    role = payload.get("role")
    user_id = payload.get("sub")

    if role == "CareTaker":
        pending = 0
        try:
            res = (
                supabase.table("notifications")
                .select("id, status")
                .eq("caretaker_id", user_id)
                .execute()
            )
            if res.data is not None:
                db_ids = {r["id"] for r in res.data}
                pending_ids = {
                    r["id"] for r in res.data
                    if (r.get("status") or "").strip().lower() == "pending"
                }
                for n in _LOCAL_NOTIFICATIONS:
                    if n.get("caretaker_id") == user_id and n["id"] not in db_ids:
                        if (n.get("status") or "").strip().lower() == "pending":
                            pending_ids.add(n["id"])
                pending = len(pending_ids)
            else:
                raise Exception("no data")
        except Exception:
            pending = len([
                n for n in _LOCAL_NOTIFICATIONS
                if n.get("caretaker_id") == user_id and (n.get("status") or "").strip().lower() == "pending"
            ])
        return {"pending_questions": pending}

    elif role == "Patient":
        unread = 0
        try:
            res = (
                supabase.table("notifications")
                .select("id, status, patient_read")
                .eq("patient_id", user_id)
                .execute()
            )
            if res.data is not None:
                db_ids = {r["id"] for r in res.data}
                unread_ids = {
                    r["id"] for r in res.data
                    if (r.get("status") or "").strip().lower() == "answered" and not r.get("patient_read")
                }
                for n in _LOCAL_NOTIFICATIONS:
                    if n.get("patient_id") == user_id and n["id"] not in db_ids:
                        if (n.get("status") or "").strip().lower() == "answered" and not n.get("patient_read"):
                            unread_ids.add(n["id"])
                unread = len(unread_ids)
            else:
                raise Exception("no data")
        except Exception:
            unread = len([
                n for n in _LOCAL_NOTIFICATIONS
                if n.get("patient_id") == user_id and (n.get("status") or "").strip().lower() == "answered" and not n.get("patient_read")
            ])
        return {"unread_answers": unread}

    return {"pending_questions": 0, "unread_answers": 0}

