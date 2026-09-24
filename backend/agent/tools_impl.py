"""Backend tools. Every tool receives an already-authorized patient_id.
The LLM never supplies patient_id and never touches the DB directly."""
import uuid
from datetime import datetime, timezone, date
from db.supabase import supabase
from agent import vectorstore


def _today() -> str:
    return date.today().isoformat()


def get_patient_reminders(patient_id: str, reminder_date: str | None = None):
    q = supabase.table("reminders").select("*").eq("patient_id", patient_id)
    if reminder_date:
        q = q.eq("reminder_date", reminder_date)
    q = q.order("reminder_date", desc=False).order("reminder_time", desc=False)
    try:
        return q.execute().data or []
    except Exception:
        return []


def get_today_medicines(patient_id: str):
    return [
        r for r in get_patient_reminders(patient_id, _today())
        if (r.get("type") or "general") == "medicine"
    ]


def get_upcoming_appointments(patient_id: str, limit: int = 5):
    try:
        rows = (
            supabase.table("reminders")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("type", "appointment")
            .gte("reminder_date", _today())
            .order("reminder_date", desc=False)
            .order("reminder_time", desc=False)
            .limit(limit)
            .execute()
        ).data or []
        return rows
    except Exception:
        return []


def search_patient_memories(patient_id: str, query: str, k: int = 5):
    """PostgreSQL source of truth + Chroma semantic ranking, strictly patient-scoped.
    Only returns ACTIVE, unexpired memories."""
    from datetime import datetime, timezone
    now_dt = datetime.now(timezone.utc)
    hits = vectorstore.search_memory_vectors(patient_id, query, k=k * 2)
    ids = [h["memory_id"] for h in hits]
    rows: list = []
    if ids:
        try:
            res = (
                supabase.table("memories")
                .select("*")
                .in_("id", ids)
                .eq("patient_id", patient_id)
                .eq("status", "ACTIVE")
                .execute()
            )
            by_id = {}
            for r in (res.data or []):
                # Filter out expired memories
                if r.get("expires_at"):
                    try:
                        exp_dt = datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00"))
                        if exp_dt < now_dt:
                            continue
                    except Exception:
                        pass
                by_id[r["id"]] = r
            rows = [by_id[i] for i in ids if i in by_id][:k]
        except Exception:
            rows = []
    if not rows:
        # Keyword fallback, always patient-scoped, ACTIVE, unexpired
        try:
            res = (
                supabase.table("memories")
                .select("*")
                .eq("patient_id", patient_id)
                .eq("status", "ACTIVE")
                .limit(30)
                .execute()
            ).data or []
            q = (query or "").lower()
            keys = [w for w in q.split() if len(w) > 2][:8]
            for r in res:
                if r.get("expires_at"):
                    try:
                        exp_dt = datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00"))
                        if exp_dt < now_dt:
                            continue
                    except Exception:
                        pass
                blob = f"{r.get('title','')} {r.get('content','')}".lower()
                if any(k in blob for k in keys):
                    rows.append(r)
            rows = rows[:k]
        except Exception:
            rows = []
    return rows


def get_memory(patient_id: str, memory_id: str):
    try:
        res = supabase.table("memories").select("*").eq("id", memory_id).execute()
    except Exception:
        return None
    if not res.data:
        return None
    row = res.data[0]
    if row.get("patient_id") != patient_id:
        return None
    return row


def search_patient_documents(patient_id: str, query: str, limit: int = 5):
    """Searches patient uploaded medical documents and prescriptions."""
    from services.medical_record_service import get_patient_documents

    docs = get_patient_documents(patient_id, limit=20)
    if not docs:
        return []

    q = (query or "").lower().strip()
    if not q:
        return docs[:limit]

    keywords = [w for w in q.split() if len(w) > 2]
    matched = []
    for doc in docs:
        text_blob = (
            f"{doc.get('title', '')} {doc.get('raw_ocr_text', '')} "
            f"{str(doc.get('structured_data', ''))}"
        ).lower()
        if any(k in text_blob for k in keywords):
            matched.append(doc)

    return matched[:limit] if matched else docs[:2]


def get_document_details(patient_id: str, document_id: str):
    from services.medical_record_service import get_patient_documents

    docs = get_patient_documents(patient_id, limit=50)
    for doc in docs:
        if doc.get("id") == document_id:
            return doc
    return None


def create_reminder(patient_id: str, data: dict):
    """Create a reminder through the existing reminders service shape."""
    allowed = ("medicine", "appointment", "general")
    rtype = (data.get("type") or "general")
    if rtype not in allowed:
        raise ValueError(f"Invalid reminder type: {rtype}")
    title = (data.get("title") or "").strip()
    if not title:
        raise ValueError("Title is required")
    if not data.get("reminder_date") or not data.get("reminder_time"):
        raise ValueError("reminder_date and reminder_time are required")
    try:
        patient = supabase.table("patients").select("id,caretaker_id").eq("id", patient_id).execute()
    except Exception as e:
        raise ValueError(f"Patient lookup failed: {e}")
    if not patient.data:
        raise ValueError("Patient not found")
    caretaker_id = patient.data[0].get("caretaker_id")
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": uuid.uuid4().hex,
        "patient_id": patient_id,
        "caretaker_id": caretaker_id,
        "title": title,
        "type": rtype,
        "dosage": data.get("dosage"),
        "reminder_date": data.get("reminder_date"),
        "reminder_time": data.get("reminder_time"),
        "notes": data.get("notes"),
        "is_done": False,
        "created_at": now,
        "updated_at": now,
    }
    supabase.table("reminders").insert(row).execute()
    return row


def get_patient_routine(patient_id: str, reminder_date: str | None = None):
    """Fetches full daily routine (medicines, appointments, daily tasks) for a patient."""
    target_date = reminder_date or _today()
    try:
        rows = (
            supabase.table("reminders")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("reminder_date", target_date)
            .order("reminder_time", desc=False)
            .execute()
        ).data or []
        return rows
    except Exception:
        return []


def save_to_routine(patient_id: str, data: dict):
    """Saves an appointment, medicine, or daily activity into the patient's routine schedule.
    Prevents exact duplicate entries on the same date/time."""
    r_date = data.get("reminder_date") or _today()
    r_time = (data.get("reminder_time") or "10:00")[:5]
    title = (data.get("title") or "").strip()
    rtype = data.get("type") or "general"
    if rtype not in ("medicine", "appointment", "general"):
        rtype = "general"

    # Check for existing duplicate on the same date
    try:
        existing = (
            supabase.table("reminders")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("reminder_date", r_date)
            .execute()
        ).data or []
        title_lower = title.lower()
        for item in existing:
            item_title = (item.get("title") or "").lower()
            item_time = str(item.get("reminder_time") or "")[:5]
            if (item_title == title_lower and item_time == r_time) or (
                title_lower in item_title and item_time == r_time
            ):
                return item  # Already exists, avoid duplicate
    except Exception:
        pass

    clean_data = {
        "title": title,
        "type": rtype,
        "reminder_date": r_date,
        "reminder_time": r_time,
        "dosage": data.get("dosage"),
        "notes": data.get("notes") or "Saved to daily routine via CogniCare Assistant",
    }
    return create_reminder(patient_id, clean_data)


# Tool registry exposed to the orchestrator (not directly to the LLM).
TOOLS = {
    "get_today_medicines": get_today_medicines,
    "get_upcoming_appointments": get_upcoming_appointments,
    "get_patient_reminders": get_patient_reminders,
    "get_patient_routine": get_patient_routine,
    "save_to_routine": save_to_routine,
    "search_patient_memories": search_patient_memories,
    "get_memory": get_memory,
    "search_patient_documents": search_patient_documents,
    "get_document_details": get_document_details,
    "create_reminder": create_reminder,
}
