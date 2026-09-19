from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from db.supabase import supabase
from utils.auth import decode_access_token
import uuid


reminders_router = APIRouter(prefix="/reminders", tags=["Reminders"])

ALLOWED_TYPES = ("medicine", "appointment", "general")


def _payload(request: Request, allowed_roles: tuple):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or payload.get("expired"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized")
    return payload


def _ensure_caretaker_owns_patient(caretaker_id: str, patient_id: str):
    result = (
        supabase.table("patients")
        .select("id")
        .eq("id", patient_id)
        .eq("caretaker_id", caretaker_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")
    return True


def _serialize(row: dict) -> dict:
    return {
        "id": row["id"],
        "patient_id": row["patient_id"],
        "caretaker_id": row["caretaker_id"],
        "title": row["title"],
        "type": row.get("type", "general"),
        "dosage": row.get("dosage"),
        "reminder_date": str(row["reminder_date"]),
        "reminder_time": str(row["reminder_time"])[:5],
        "notes": row.get("notes"),
        "is_done": row.get("is_done", False),
        "done_at": row.get("done_at"),
        "done_by": row.get("done_by"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


class CreateReminderRequest(BaseModel):
    patient_id: str
    title: str
    type: str = "general"
    dosage: Optional[str] = None
    reminder_date: str  # YYYY-MM-DD
    reminder_time: str  # HH:MM
    notes: Optional[str] = None


class BulkReminderItem(BaseModel):
    title: str
    type: str = "general"
    dosage: Optional[str] = None
    reminder_time: str
    notes: Optional[str] = None


class BulkCreateRequest(BaseModel):
    patient_id: str
    reminder_date: str
    reminders: List[BulkReminderItem]


class UpdateReminderRequest(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    dosage: Optional[str] = None
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    notes: Optional[str] = None
    is_done: Optional[bool] = None


def _validate_type(t: str):
    if t not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type. Must be one of: {', '.join(ALLOWED_TYPES)}",
        )


@reminders_router.post("/")
def create_reminder(data: CreateReminderRequest, request: Request):
    payload = _payload(request, ("CareTaker",))
    _validate_type(data.type)
    _ensure_caretaker_owns_patient(payload["sub"], data.patient_id)

    now = datetime.now(timezone.utc).isoformat()
    reminder_id = uuid.uuid4().hex
    row = {
        "id": reminder_id,
        "patient_id": data.patient_id,
        "caretaker_id": payload["sub"],
        "title": data.title.strip(),
        "type": data.type,
        "dosage": data.dosage,
        "reminder_date": data.reminder_date,
        "reminder_time": data.reminder_time,
        "notes": data.notes,
        "is_done": False,
        "created_at": now,
        "updated_at": now,
    }
    if not row["title"]:
        raise HTTPException(status_code=400, detail="Title is required")

    supabase.table("reminders").insert(row).execute()
    return {"message": "Reminder added", "reminder_id": reminder_id}


@reminders_router.post("/bulk")
def create_reminders_bulk(data: BulkCreateRequest, request: Request):
    payload = _payload(request, ("CareTaker",))
    _ensure_caretaker_owns_patient(payload["sub"], data.patient_id)
    if not data.reminders:
        raise HTTPException(status_code=400, detail="No reminders provided")

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for item in data.reminders:
        _validate_type(item.type)
        if not item.title.strip():
            raise HTTPException(status_code=400, detail="Title is required")
        rows.append(
            {
                "id": uuid.uuid4().hex,
                "patient_id": data.patient_id,
                "caretaker_id": payload["sub"],
                "title": item.title.strip(),
                "type": item.type,
                "dosage": item.dosage,
                "reminder_date": data.reminder_date,
                "reminder_time": item.reminder_time,
                "notes": item.notes,
                "is_done": False,
                "created_at": now,
                "updated_at": now,
            }
        )

    supabase.table("reminders").insert(rows).execute()
    return {"message": f"{len(rows)} reminders added", "count": len(rows)}


@reminders_router.get("/patient/{patient_id}")
def list_patient_reminders(
    patient_id: str,
    request: Request,
    date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
):
    payload = _payload(request, ("CareTaker", "Patient"))
    role = payload.get("role")

    if role == "CareTaker":
        _ensure_caretaker_owns_patient(payload["sub"], patient_id)
    else:
        if payload["sub"] != patient_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    query = (
        supabase.table("reminders")
        .select("*")
        .eq("patient_id", patient_id)
        .order("reminder_time", desc=False)
    )
    if date:
        query = query.eq("reminder_date", date)
    else:
        query = query.order("reminder_date", desc=False)

    result = query.execute()
    return [_serialize(r) for r in (result.data or [])]


@reminders_router.get("/")
def list_my_reminders(
    request: Request,
    date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
):
    """CareTaker: all reminders across own patients (optional date filter).
    Patient: own reminders (optional date filter)."""
    payload = _payload(request, ("CareTaker", "Patient"))
    role = payload.get("role")

    if role == "CareTaker":
        query = (
            supabase.table("reminders")
            .select("*")
            .eq("caretaker_id", payload["sub"])
            .order("reminder_date", desc=False)
            .order("reminder_time", desc=False)
        )
    else:
        query = (
            supabase.table("reminders")
            .select("*")
            .eq("patient_id", payload["sub"])
            .order("reminder_date", desc=False)
            .order("reminder_time", desc=False)
        )

    if date:
        query = query.eq("reminder_date", date)

    result = query.execute()
    return [_serialize(r) for r in (result.data or [])]


def _is_past(reminder_date: str, reminder_time: str) -> bool:
    try:
        dt = datetime.strptime(
            f"{reminder_date} {reminder_time[:5]}", "%Y-%m-%d %H:%M"
        )
        return dt < datetime.now()
    except Exception:
        return False


@reminders_router.patch("/{reminder_id}")
def update_reminder(reminder_id: str, data: UpdateReminderRequest, request: Request):
    payload = _payload(request, ("CareTaker", "Patient"))
    role = payload.get("role")

    existing = supabase.table("reminders").select("*").eq("id", reminder_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder = existing.data[0]

    if role == "CareTaker":
        if reminder["caretaker_id"] != payload["sub"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        if reminder["patient_id"] != payload["sub"]:
            raise HTTPException(status_code=403, detail="Not authorized")

    updates: dict = {}

    # Done / undone toggle is always allowed for both roles
    if data.is_done is not None and data.is_done != reminder.get("is_done"):
        updates["is_done"] = data.is_done
        if data.is_done:
            updates["done_at"] = datetime.now(timezone.utc).isoformat()
            updates["done_by"] = role
        else:
            updates["done_at"] = None
            updates["done_by"] = None

    # Content edits only allowed when not done and time is in the future
    wants_content_edit = any(
        v is not None
        for v in [data.title, data.type, data.dosage, data.reminder_date, data.reminder_time, data.notes]
    )
    if wants_content_edit:
        if reminder.get("is_done"):
            raise HTTPException(
                status_code=400,
                detail="Completed reminders cannot be edited. Mark as not done first.",
            )
        if _is_past(str(reminder["reminder_date"]), str(reminder["reminder_time"])[:5]):
            raise HTTPException(
                status_code=400,
                detail="Past reminders cannot be edited. Only completion status can change.",
            )
        if data.title is not None:
            if not data.title.strip():
                raise HTTPException(status_code=400, detail="Title is required")
            updates["title"] = data.title.strip()
        if data.type is not None:
            _validate_type(data.type)
            updates["type"] = data.type
        if data.dosage is not None:
            updates["dosage"] = data.dosage
        if data.reminder_date is not None:
            updates["reminder_date"] = data.reminder_date
        if data.reminder_time is not None:
            updates["reminder_time"] = data.reminder_time
        if data.notes is not None:
            updates["notes"] = data.notes

    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("reminders").update(updates).eq("id", reminder_id).execute()
    return {"message": "Reminder updated"}


@reminders_router.delete("/{reminder_id}")
def delete_reminder(reminder_id: str, request: Request):
    payload = _payload(request, ("CareTaker",))
    existing = supabase.table("reminders").select("*").eq("id", reminder_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder = existing.data[0]
    if reminder["caretaker_id"] != payload["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if reminder.get("is_done"):
        raise HTTPException(status_code=400, detail="Completed reminders cannot be deleted")
    supabase.table("reminders").delete().eq("id", reminder_id).execute()
    return {"message": "Reminder deleted"}
