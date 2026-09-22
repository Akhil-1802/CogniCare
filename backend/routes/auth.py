from fastapi import APIRouter, Response, Request, HTTPException
from pydantic import BaseModel, EmailStr
from db.supabase import supabase
from utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    generate_verification_code,
)
from utils.email import send_verification_email
from utils.cookies import set_refresh_cookie, clear_refresh_cookie
from datetime import datetime, timedelta, timezone
import uuid

auth_router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


@auth_router.post("/register")
def register(data: RegisterRequest):
    existing = supabase.table("caretakers").select("*").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(data.password)
    user_id = uuid.uuid4().hex

    supabase.table("caretakers").insert({
        "id": user_id,
        "name": data.name,
        "email": data.email,
        "password": hashed,
        "phone": data.phone,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    supabase.table("email_verifications").insert({
        "id": uuid.uuid4().hex,
        "email": data.email,
        "code": code,
        "expires_at": expires_at.isoformat(),
        "used": False,
    }).execute()

    send_verification_email(data.email, code)

    return {"message": "Account created. Please verify your email."}


@auth_router.post("/verify-email")
def verify_email(data: VerifyEmailRequest):
    result = supabase.table("email_verifications").select("*") \
        .eq("email", data.email) \
        .eq("code", data.code) \
        .eq("used", False) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    record = result.data[0]

    if datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code expired")

    supabase.table("email_verifications").update({"used": True}).eq("id", record["id"]).execute()
    supabase.table("caretakers").update({"is_verified": True}).eq("email", data.email).execute()

    return {"message": "Email verified successfully"}


@auth_router.post("/resend-code")
def resend_code(data: ResendCodeRequest):
    supabase.table("email_verifications").update({"used": True}) \
        .eq("email", data.email) \
        .eq("used", False) \
        .execute()

    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    supabase.table("email_verifications").insert({
        "id": uuid.uuid4().hex,
        "email": data.email,
        "code": code,
        "expires_at": expires_at.isoformat(),
        "used": False,
    }).execute()

    send_verification_email(data.email, code)

    return {"message": "Verification code sent"}


@auth_router.post("/login")
def login(data: LoginRequest, response: Response):
    result = supabase.table("caretakers").select("*").eq("email", data.email).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    user = result.data[0]

    if not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if not user.get("is_verified"):
        raise HTTPException(status_code=403, detail="Please verify your email first")

    access_token = create_access_token(user["id"], user["email"], "CareTaker")
    refresh_token = create_refresh_token(user["id"], user["email"], "CareTaker")

    supabase.table("refresh_tokens").insert({
        "id": uuid.uuid4().hex,
        "user_id": user["id"],
        "token": refresh_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    }).execute()

    set_refresh_cookie(response, refresh_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": "CareTaker",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"],
        },
    }


@auth_router.post("/refresh")
def refresh_token(request: Request, response: Response):
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

    user_result = supabase.table("caretakers").select("*").eq("id", payload["sub"]).execute()
    if not user_result.data:
        raise HTTPException(status_code=401, detail="User not found")

    user = user_result.data[0]

    supabase.table("refresh_tokens").delete().eq("token", token).execute()

    new_access = create_access_token(user["id"], user["email"], "CareTaker")
    new_refresh = create_refresh_token(user["id"], user["email"], "CareTaker")

    supabase.table("refresh_tokens").insert({
        "id": uuid.uuid4().hex,
        "user_id": user["id"],
        "token": new_refresh,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    }).execute()

    set_refresh_cookie(response, new_refresh)

    return {
        "access_token": new_access,
        "token_type": "bearer",
    }


@auth_router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if token:
        supabase.table("refresh_tokens").delete().eq("token", token).execute()

    clear_refresh_cookie(response)
    return {"message": "Logged out"}


@auth_router.get("/me")
def get_me(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)

    if not payload or payload.get("expired"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = supabase.table("caretakers").select("id,name,email,phone").eq("id", payload["sub"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    return result.data[0]


@auth_router.get("/patients")
def get_patients(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)

    if not payload or payload.get("expired"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("role") != "CareTaker":
        raise HTTPException(status_code=403, detail="Only caretakers can view patients")

    result = supabase.table("patients").select("id,name,phone,location,caretaker_id").eq("caretaker_id", payload["sub"]).execute()

    return result.data
