"""Pydantic schemas for the CogniCare agent. LLM output is validated here."""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal


MemoryType = Literal[
    "PERSON", "RELATIONSHIP", "EVENT", "APPOINTMENT",
    "MEDICINE", "PREFERENCE", "IMPORTANT_FACT", "DAILY_ACTIVITY",
]
Importance = Literal["LOW", "MEDIUM", "HIGH"]
MemoryStatus = Literal["ACTIVE", "PENDING_VALIDATION", "REJECTED", "ARCHIVED"]

ALLOWED_MEMORY_TYPES = {
    "PERSON", "RELATIONSHIP", "EVENT", "APPOINTMENT",
    "MEDICINE", "PREFERENCE", "IMPORTANT_FACT", "DAILY_ACTIVITY",
}
ALLOWED_IMPORTANCE = {"LOW", "MEDIUM", "HIGH"}


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
