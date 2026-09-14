from fastapi import APIRouter, Response, Request, HTTPException
from pydantic import BaseModel
from db.supabase import supabase
from utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)
from datetime import datetime, timedelta, timezone
import uuid
import secrets

patient_auth_router = APIRouter(prefix="/patient-auth", tags=["Patient Auth"])


class AddPatientRequest(BaseModel):
    name: str
    phone: str
    location: str
    password: str


class PatientLoginRequest(BaseModel):
    patient_id: str
    password: str


@patient_auth_router.post("/add")
def add_patient(data: AddPatientRequest, request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or payload.get("expired"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("role") != "CareTaker":
        raise HTTPException(status_code=403, detail="Only caretakers can add patients")

    patient_id = f"PAT-{secrets.token_hex(3).upper()}"

    supabase.table("patients").insert({
        "id": patient_id,
        "caretaker_id": payload["sub"],
        "name": data.name,
        "phone": data.phone,
        "location": data.location,
        "password": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    return {
        "message": "Patient added successfully",
        "patient_id": patient_id,
    }


@patient_auth_router.post("/login")
def patient_login(data: PatientLoginRequest, response: Response):
    result = supabase.table("patients").select("*").eq("id", data.patient_id).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Invalid patient ID or password")

    patient = result.data[0]

    if not verify_password(data.password, patient["password"]):
        raise HTTPException(status_code=400, detail="Invalid patient ID or password")

    access_token = create_access_token(patient["id"], patient["id"], "Patient")
    refresh_token = create_refresh_token(patient["id"], patient["id"], "Patient")

    supabase.table("refresh_tokens").insert({
        "id": uuid.uuid4().hex,
        "user_id": patient["id"],
        "token": refresh_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    }).execute()

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": "Patient",
        "patient": {
            "id": patient["id"],
            "name": patient["name"],
            "phone": patient["phone"],
            "location": patient["location"],
            "caretaker_id": patient["caretaker_id"],
        },
    }


@patient_auth_router.post("/refresh")
def patient_refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token found")

    payload = decode_refresh_token(token)
    if not payload or payload.get("expired"):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    result = supabase.table("refresh_tokens").select("*") \
        .eq("user_id", payload["sub"]) \
        .eq("token", token) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=401, detail="Refresh token not found")

    patient_result = supabase.table("patients").select("*").eq("id", payload["sub"]).execute()
    if not patient_result.data:
        raise HTTPException(status_code=401, detail="Patient not found")

    patient = patient_result.data[0]

    supabase.table("refresh_tokens").delete().eq("token", token).execute()

    new_access = create_access_token(patient["id"], patient["id"], "Patient")
    new_refresh = create_refresh_token(patient["id"], patient["id"], "Patient")

    supabase.table("refresh_tokens").insert({
        "id": uuid.uuid4().hex,
        "user_id": patient["id"],
        "token": new_refresh,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    }).execute()

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )

    return {
        "access_token": new_access,
        "token_type": "bearer",
    }


@patient_auth_router.post("/logout")
def patient_logout(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if token:
        supabase.table("refresh_tokens").delete().eq("token", token).execute()

    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}


@patient_auth_router.get("/me")
def patient_me(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)

    if not payload or payload.get("expired"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = supabase.table("patients").select("id,name,phone,location,caretaker_id").eq("id", payload["sub"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    return result.data[0]
