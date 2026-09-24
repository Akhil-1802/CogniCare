"""Pydantic schemas for the CogniCare agent. LLM output is validated here."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal


MemoryType = Literal[
    "PERSON", "RELATIONSHIP", "EVENT", "APPOINTMENT",
    "MEDICINE", "PREFERENCE", "IMPORTANT_FACT", "DAILY_ACTIVITY",
]
Importance = Literal["LOW", "MEDIUM", "HIGH"]
MemoryStatus = Literal["ACTIVE", "PENDING_VALIDATION", "REJECTED", "ARCHIVED", "EXPIRED"]
MemoryDecision = Literal["DISCARD", "TEMPORARY_MEMORY", "STANDARD_MEMORY", "LONG_TERM_MEMORY"]

ALLOWED_MEMORY_TYPES = {
    "PERSON", "RELATIONSHIP", "EVENT", "APPOINTMENT",
    "MEDICINE", "PREFERENCE", "IMPORTANT_FACT", "DAILY_ACTIVITY",
}
ALLOWED_IMPORTANCE = {"LOW", "MEDIUM", "HIGH"}
ALLOWED_STATUSES = {"ACTIVE", "PENDING_VALIDATION", "REJECTED", "ARCHIVED", "EXPIRED"}


class ExtractedFactCandidate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    content: str = Field(..., min_length=5, max_length=2000)
    memory_type: MemoryType = "IMPORTANT_FACT"
    entities: List[str] = Field(default_factory=list)
    event_date: Optional[str] = None  # YYYY-MM-DD or ISO
    relative_date_text: Optional[str] = None  # e.g., "next Sunday", "tomorrow"
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    requires_confirmation: bool = False
    importance_estimate: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    usefulness_estimate: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    persistence_estimate: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    source_conversation_id: Optional[str] = None
    source_message_id: Optional[str] = None


class MultiCandidateExtractionResult(BaseModel):
    candidates: List[ExtractedFactCandidate] = Field(default_factory=list)


class ScoreBreakdown(BaseModel):
    importance: float = Field(..., ge=0.0, le=100.0)
    confidence: float = Field(..., ge=0.0, le=100.0)
    usefulness: float = Field(..., ge=0.0, le=100.0)
    persistence: float = Field(..., ge=0.0, le=100.0)
    novelty: float = Field(..., ge=0.0, le=100.0)
    total_score: float = Field(..., ge=0.0, le=100.0)
    weights: Dict[str, float] = Field(default_factory=dict)


class MemoryDecisionResult(BaseModel):
    decision: MemoryDecision
    status: MemoryStatus
    retention_policy: str
    retention_days: int
    expires_at: Optional[str] = None
    confidence_gate_passed: bool
    requires_review: bool
    reason: str
    score_breakdown: ScoreBreakdown
    candidate: ExtractedFactCandidate


class MemoryExtractionResult(BaseModel):
    should_create_memory: bool = False
    memory_type: MemoryType = "IMPORTANT_FACT"
    title: str = ""
    content: str = ""
    importance: Importance = "MEDIUM"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ToolCallLog(BaseModel):
    tool_name: str
    success: bool = True
    detail: str = ""


def validate_candidate(data: dict) -> Optional[ExtractedFactCandidate]:
    """Validate a single candidate dictionary. Returns None if invalid."""
    try:
        return ExtractedFactCandidate(**data)
    except Exception:
        return None


def validate_extraction_payload(data: dict) -> Optional[MemoryExtractionResult]:
    """Validate raw LLM JSON. Returns None when invalid or should not create."""
    try:
        parsed = MemoryExtractionResult(**data)
    except Exception:
        return None
    if not parsed.should_create_memory:
        return None
    if parsed.memory_type not in ALLOWED_MEMORY_TYPES:
        return None
    if parsed.importance not in ALLOWED_IMPORTANCE:
        return None
    title = (parsed.title or "").strip()
    content = (parsed.content or "").strip()
    if len(title) < 3 or len(content) < 10 or len(content) > 2000:
        return None
    if not (0 < parsed.confidence <= 1.0):
        return None
    parsed.title = title
    parsed.content = content
    return parsed


class ReminderCreateData(BaseModel):
    title: str
    type: str = "general"
    dosage: Optional[str] = None
    reminder_date: str
    reminder_time: str
    notes: Optional[str] = None

