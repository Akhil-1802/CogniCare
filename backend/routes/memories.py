"""REST API Endpoints for Scoring-Based Memory Extraction and Retention System.
Enforces patient ownership and caregiver relationship authorization.
"""
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from db.supabase import supabase
from agent.authz import get_auth_payload, authenticated_patient_id, require_patient_ownership, require_caretaker_patient
from agent.extraction import MemoryExtractionService
from agent.scoring_service import MemoryScoringService
from agent.decision_service import MemoryDecisionService
from agent.memory_service import (
    get_patient_memories,
    search_verified_memories,
    update_patient_memory,
    delete_patient_memory,
    create_or_update_memory,
)

memories_router = APIRouter(prefix="/api/v1/memories", tags=["Memories"])


class MemoryExtractRequest(BaseModel):
    message: str
    assistant_reply: Optional[str] = ""
    speech_confidence: Optional[float] = 1.0
    save: Optional[bool] = False


class MemoryUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    reconfirm: Optional[bool] = False


@memories_router.post("/extract")
def extract_and_score_memories(data: MemoryExtractRequest, request: Request):
    """
    Extracts memory candidates from a patient message, scores each candidate,
    and returns candidates with full score breakdowns and decision policies.
    If save=True, persists eligible memories to PostgreSQL and ChromaDB.
    """
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)

    if not data.message.strip():
        return {"candidates": []}

    candidates = MemoryExtractionService.extract_candidates(
        patient_message=data.message,
        assistant_reply=data.assistant_reply or "",
        speech_confidence=data.speech_confidence or 1.0,
    )

    results = []
    for cand in candidates:
        score_bd = MemoryScoringService.calculate_score(
            candidate=cand,
            speech_confidence=data.speech_confidence or 1.0,
        )
        dec_res = MemoryDecisionService.evaluate_decision(
            candidate=cand,
            score_breakdown=score_bd,
        )
        item: Dict[str, Any] = {
            "candidate": cand.model_dump(),
            "score_breakdown": score_bd.model_dump(),
            "decision": dec_res.decision,
            "status": dec_res.status,
            "retention_policy": dec_res.retention_policy,
            "retention_days": dec_res.retention_days,
            "expires_at": dec_res.expires_at,
            "confidence_gate_passed": dec_res.confidence_gate_passed,
            "requires_review": dec_res.requires_review,
            "reason": dec_res.reason,
        }

        if data.save and dec_res.decision != "DISCARD":
            save_res = create_or_update_memory(
                patient_id=patient_id,
                extraction=cand,
                source_type="direct_extraction",
                speech_confidence=data.speech_confidence or 1.0,
            )
            item["saved"] = save_res

        results.append(item)

    return {"candidates": results}


@memories_router.get("")
def list_memories(
    request: Request,
    status: Optional[str] = "ACTIVE",
    patient_id: Optional[str] = None,
    limit: int = Query(default=50, le=100),
):
    """List memories for an authenticated patient or authorized caregiver."""
    payload = get_auth_payload(request)
    role = payload.get("role")

    if role == "CareTaker":
        if not patient_id:
            raise HTTPException(status_code=400, detail="patient_id is required for CareTaker")
        target_pid = require_caretaker_patient(payload, patient_id)
    else:
        target_pid = authenticated_patient_id(payload)

    return get_patient_memories(target_pid, status=status, limit=limit)


@memories_router.get("/search")
def search_memories(request: Request, q: str = Query(default=""), limit: int = Query(default=5, le=20)):
    """Patient-scoped semantic search over ACTIVE memories."""
    payload = get_auth_payload(request)
    patient_id = authenticated_patient_id(payload)
    if not q.strip():
        return []
    return search_verified_memories(patient_id, q, limit=limit)


@memories_router.get("/{memory_id}")
def get_memory_detail(memory_id: str, request: Request):
    """Retrieve a single memory with ownership and caregiver authorization checks."""
    payload = get_auth_payload(request)
    role = payload.get("role")

    res = supabase.table("memories").select("*").eq("id", memory_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Memory not found")
    mem = res.data[0]
    pid = mem["patient_id"]

    if role == "CareTaker":
        require_caretaker_patient(payload, pid)
    else:
        require_patient_ownership(payload, pid)

    return mem


@memories_router.get("/{memory_id}/score")
def get_memory_score(memory_id: str, request: Request):
    """Retrieve score breakdown and decision factors for a specific memory."""
    payload = get_auth_payload(request)
    role = payload.get("role")

    res = supabase.table("memories").select("*").eq("id", memory_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Memory not found")
    mem = res.data[0]
    pid = mem["patient_id"]

    if role == "CareTaker":
        require_caretaker_patient(payload, pid)
    else:
        require_patient_ownership(payload, pid)

    meta = mem.get("metadata") or {}
    score_breakdown = meta.get("score_breakdown") or {
        "importance": mem.get("importance_score", 0),
        "confidence": mem.get("confidence_score", 0),
        "usefulness": mem.get("usefulness_score", 0),
        "persistence": mem.get("persistence_score", 0),
        "novelty": mem.get("novelty_score", 0),
        "total_score": mem.get("total_score", 0),
    }

    return {
        "memory_id": mem["id"],
        "title": mem["title"],
        "memory_type": mem["memory_type"],
        "status": mem["status"],
        "retention_policy": mem.get("retention_policy"),
        "retention_days": mem.get("retention_days"),
        "created_at": mem.get("created_at"),
        "last_confirmed_at": mem.get("last_confirmed_at"),
        "expires_at": mem.get("expires_at"),
        "score_breakdown": score_breakdown,
        "decision": meta.get("decision"),
        "reason": meta.get("reason"),
    }


@memories_router.patch("/{memory_id}")
def edit_memory(memory_id: str, data: MemoryUpdateRequest, request: Request):
    """Patient or authorized caregiver updates or reconfirms a memory."""
    payload = get_auth_payload(request)
    role = payload.get("role")

    res = supabase.table("memories").select("patient_id").eq("id", memory_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Memory not found")
    pid = res.data[0]["patient_id"]

    if role == "CareTaker":
        require_caretaker_patient(payload, pid)
    else:
        require_patient_ownership(payload, pid)

    update_res = update_patient_memory(
        patient_id=pid,
        memory_id=memory_id,
        title=data.title,
        content=data.content,
        reconfirm=bool(data.reconfirm),
    )
    if not update_res.get("success"):
        raise HTTPException(status_code=400, detail=update_res.get("error", "Update failed"))
    return update_res


@memories_router.delete("/{memory_id}")
def delete_memory(memory_id: str, request: Request):
    """Patient or authorized caregiver soft-deletes (archives) a memory and removes it from ChromaDB."""
    payload = get_auth_payload(request)
    role = payload.get("role")

    res = supabase.table("memories").select("patient_id").eq("id", memory_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Memory not found")
    pid = res.data[0]["patient_id"]

    if role == "CareTaker":
        require_caretaker_patient(payload, pid)
    else:
        require_patient_ownership(payload, pid)

    success = delete_patient_memory(patient_id=pid, memory_id=memory_id, soft_delete=True)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete memory")
    return {"message": "Memory archived successfully"}
