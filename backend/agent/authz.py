"""Authorization helpers. The LLM NEVER decides permissions."""
from fastapi import Request, HTTPException
from db.supabase import supabase
from utils.auth import decode_access_token


def get_auth_payload(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(auth_header.split(" ")[1])
    if not payload or payload.get("expired"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def caretaker_owns_patient(caretaker_id: str, patient_id: str) -> bool:
    result = (
        supabase.table("patients")
        .select("id")
        .eq("id", patient_id)
        .eq("caretaker_id", caretaker_id)
        .execute()
    )
    return bool(result.data)


def require_patient_ownership(payload: dict, patient_id: str) -> str:
    """Patient role: may access only their own data."""
    if payload.get("role") != "Patient":
        raise HTTPException(status_code=403, detail="Patient access required")
    if payload.get("sub") != patient_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return patient_id


def require_caretaker_patient(payload: dict, patient_id: str) -> str:
    """CareTaker role: may access only explicitly connected patients."""
    if payload.get("role") != "CareTaker":
        raise HTTPException(status_code=403, detail="CareTaker access required")
    if not caretaker_owns_patient(payload["sub"], patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient_id


def resolve_patient_id(payload: dict, patient_id: str) -> str:
    """Resolve + authorize a patient_id from an authenticated identity.
    Never trust patient_id coming from the LLM — only from auth context."""
    role = payload.get("role")
    if role == "Patient":
        return require_patient_ownership(payload, patient_id)
    if role == "CareTaker":
        return require_caretaker_patient(payload, patient_id)
    raise HTTPException(status_code=403, detail="Not authorized")


def authenticated_patient_id(payload: dict) -> str:
    if payload.get("role") != "Patient":
        raise HTTPException(status_code=403, detail="Patient access required")
    return payload["sub"]
