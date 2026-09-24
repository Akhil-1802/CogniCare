"""Comprehensive test suite for CogniCare Scoring-Based Memory Extraction and Retention System.
Covers all 30 specified test cases:
- Scoring tests (1-5)
- Extraction tests (6-10)
- Retention tests (11-16)
- Memory management tests (17-21)
- Security tests (22-25)
- Integration tests (26-30)
"""
import sys
import os
from datetime import datetime, timezone, timedelta, date
import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import settings
from config.settings import validate_memory_config
from agent.schemas import (
    ExtractedFactCandidate,
    ScoreBreakdown,
    MemoryDecisionResult,
    validate_candidate,
    validate_extraction_payload,
)
from agent.scoring_service import MemoryScoringService
from agent.decision_service import MemoryDecisionService, calculate_memory_relevance
from agent.extraction import MemoryExtractionService, extract_memory_candidate
from agent import memory_service as ms
from agent import vectorstore
from agent import cleanup as cleanup_mod
from agent import authz


# ==========================================
# 1. SCORING TESTS (Cases 1 - 5)
# ==========================================

def test_01_correct_weighted_score_calculation():
    """Test weighted score formula: (Imp*0.30) + (Conf*0.25) + (Use*0.20) + (Pers*0.15) + (Nov*0.10)."""
    weights = {"importance": 0.30, "confidence": 0.25, "usefulness": 0.20, "persistence": 0.15, "novelty": 0.10}
    score = MemoryScoringService.calculate_custom_score(
        importance=85.0,
        confidence=95.0,
        usefulness=90.0,
        persistence=25.0,
        novelty=100.0,
        weights_override=weights,
    )
    expected = (85 * 0.30) + (95 * 0.25) + (90 * 0.20) + (25 * 0.15) + (100 * 0.10)
    assert abs(score.total_score - round(expected, 2)) < 0.01
    assert score.importance == 85.0
    assert score.confidence == 95.0
    assert score.usefulness == 90.0
    assert score.persistence == 25.0
    assert score.novelty == 100.0


def test_02_score_always_remains_between_0_and_100():
    """Test score bounds clamping to [0, 100] even with extreme values."""
    score_high = MemoryScoringService.calculate_custom_score(
        importance=200.0, confidence=500.0, usefulness=150.0, persistence=150.0, novelty=150.0
    )
    assert 0.0 <= score_high.total_score <= 100.0
    assert score_high.total_score == 100.0
    assert score_high.importance == 100.0

    score_low = MemoryScoringService.calculate_custom_score(
        importance=-50.0, confidence=-20.0, usefulness=-10.0, persistence=-10.0, novelty=-10.0
    )
    assert 0.0 <= score_low.total_score <= 100.0
    assert score_low.total_score == 0.0



def test_03_invalid_scoring_configuration_rejected():
    """Test that invalid configuration (negative weights, wrong sum, bad thresholds) raises ValueError."""
    orig_imp = settings.MEMORY_IMPORTANCE_WEIGHT
    try:
        settings.MEMORY_IMPORTANCE_WEIGHT = -0.1
        with pytest.raises(ValueError, match="non-negative"):
            validate_memory_config()

        settings.MEMORY_IMPORTANCE_WEIGHT = 0.5  # sum != 1.0
        with pytest.raises(ValueError, match="must sum to 1.0"):
            validate_memory_config()
    finally:
        settings.MEMORY_IMPORTANCE_WEIGHT = orig_imp
        assert validate_memory_config() is True


def test_04_configuration_weights_applied_correctly():
    """Test that configured weights from settings are correctly used by MemoryScoringService."""
    weights = MemoryScoringService.get_weights()
    assert weights["importance"] == settings.MEMORY_IMPORTANCE_WEIGHT
    assert weights["confidence"] == settings.MEMORY_CONFIDENCE_WEIGHT
    assert weights["usefulness"] == settings.MEMORY_USEFULNESS_WEIGHT
    assert weights["persistence"] == settings.MEMORY_PERSISTENCE_WEIGHT
    assert weights["novelty"] == settings.MEMORY_NOVELTY_WEIGHT
    assert abs(sum(weights.values()) - 1.0) < 1e-4


def test_05_threshold_decisions_are_correct():
    """Test mapping of scores to DISCARD, TEMPORARY_MEMORY, STANDARD_MEMORY, and LONG_TERM_MEMORY."""
    cand = ExtractedFactCandidate(title="Sample title", content="Sample content here", memory_type="IMPORTANT_FACT", confidence=0.9)

    # Score < 40 -> DISCARD
    bd_discard = ScoreBreakdown(importance=20, confidence=20, usefulness=20, persistence=20, novelty=20, total_score=25.0)
    dec_discard = MemoryDecisionService.evaluate_decision(cand, bd_discard)
    assert dec_discard.decision == "DISCARD"
    assert dec_discard.retention_days == 0

    # Score 40-59 -> TEMPORARY_MEMORY
    bd_temp = ScoreBreakdown(importance=50, confidence=50, usefulness=50, persistence=50, novelty=50, total_score=50.0)
    dec_temp = MemoryDecisionService.evaluate_decision(cand, bd_temp)
    assert dec_temp.decision == "TEMPORARY_MEMORY"
    assert dec_temp.retention_days == settings.MEMORY_TEMPORARY_RETENTION_DAYS

    # Score 60-79 -> STANDARD_MEMORY
    bd_std = ScoreBreakdown(importance=70, confidence=70, usefulness=70, persistence=70, novelty=70, total_score=70.0)
    dec_std = MemoryDecisionService.evaluate_decision(cand, bd_std)
    assert dec_std.decision == "STANDARD_MEMORY"
    assert dec_std.retention_days == settings.MEMORY_STANDARD_RETENTION_DAYS

    # Score 80-100 -> LONG_TERM_MEMORY
    bd_long = ScoreBreakdown(importance=90, confidence=90, usefulness=90, persistence=90, novelty=90, total_score=90.0)
    dec_long = MemoryDecisionService.evaluate_decision(cand, bd_long)
    assert dec_long.decision == "LONG_TERM_MEMORY"
    assert dec_long.retention_days == settings.MEMORY_LONG_TERM_RETENTION_DAYS


# ==========================================
# 2. EXTRACTION TESTS (Cases 6 - 10)
# ==========================================

def test_06_important_info_creates_memory_candidate():
    """Test that important family relationship statements produce valid candidates."""
    candidates = MemoryExtractionService.extract_candidates("My daughter Emily is visiting me next Sunday.")
    assert len(candidates) >= 1
    c = candidates[0]
    assert c.memory_type in ("EVENT", "RELATIONSHIP", "PERSON")
    assert "Emily" in c.title or "visit" in c.title.lower() or "Emily" in c.content


def test_07_casual_conversation_does_not_create_memory():
    """Test that greetings and casual chit-chat yield 0 candidates."""
    for greeting in ["Hello!", "Hi there", "Good morning", "Thanks so much!", "Bye"]:
        cands = MemoryExtractionService.extract_candidates(greeting)
        assert len(cands) == 0


def test_08_message_with_multiple_facts_produces_multiple_candidates():
    """Test extracting multiple distinct facts from a compound patient message."""
    msg = "My daughter Emily is visiting me next Sunday, and I prefer to take my evening walk at 6 PM."
    cands = MemoryExtractionService.extract_candidates(msg)
    assert len(cands) >= 2
    types = [c.memory_type for c in cands]
    assert "EVENT" in types or "RELATIONSHIP" in types
    assert "PREFERENCE" in types


def test_09_invalid_llm_output_rejected_safely():
    """Test that invalid candidate payloads fail validation and return None."""
    assert validate_candidate({}) is None
    assert validate_candidate({"title": "ab"}) is None  # too short
    assert validate_candidate({"title": "Valid title", "content": "tiny", "memory_type": "UNKNOWN"}) is None
    assert validate_extraction_payload({"should_create_memory": False}) is None


def test_10_uncertain_speech_transcription_handled_appropriately():
    """Test that low speech confidence (<0.70) reduces score and flags for review."""
    msg = "I think my appointment is tomorrow."
    cands = MemoryExtractionService.extract_candidates(msg, speech_confidence=0.50)
    assert len(cands) >= 1
    c = cands[0]
    assert c.confidence < 0.70
    assert c.requires_confirmation is True

    # Scoring and decision must enforce PENDING_VALIDATION
    score = MemoryScoringService.calculate_score(c, speech_confidence=0.50)
    decision = MemoryDecisionService.evaluate_decision(c, score)
    assert decision.confidence_gate_passed is False
    assert decision.status == "PENDING_VALIDATION"
    assert decision.requires_review is True


# ==========================================
# 3. RETENTION TESTS (Cases 11 - 16)
# ==========================================

def test_11_temporary_memory_receives_correct_expiration():
    """Test temporary memory gets MEMORY_TEMPORARY_RETENTION_DAYS (7 days)."""
    cand = ExtractedFactCandidate(title="Temporary Plan", content="Going to market later", memory_type="IMPORTANT_FACT", confidence=0.8)
    bd = ScoreBreakdown(importance=50, confidence=50, usefulness=50, persistence=50, novelty=50, total_score=50.0)
    ref_dt = datetime(2026, 9, 24, 12, 0, 0, tzinfo=timezone.utc)
    dec = MemoryDecisionService.evaluate_decision(cand, bd, reference_dt=ref_dt)
    assert dec.retention_days == 7
    exp_dt = datetime.fromisoformat(dec.expires_at)
    assert (exp_dt - ref_dt).days == 7


def test_12_standard_memory_receives_correct_expiration():
    """Test standard memory gets MEMORY_STANDARD_RETENTION_DAYS (30 days)."""
    cand = ExtractedFactCandidate(title="Book Preference", content="Patient likes reading mystery books", memory_type="PREFERENCE", confidence=0.85)
    bd = ScoreBreakdown(importance=70, confidence=70, usefulness=70, persistence=70, novelty=70, total_score=70.0)
    ref_dt = datetime(2026, 9, 24, 12, 0, 0, tzinfo=timezone.utc)
    dec = MemoryDecisionService.evaluate_decision(cand, bd, reference_dt=ref_dt)
    assert dec.retention_days == 30
    exp_dt = datetime.fromisoformat(dec.expires_at)
    assert (exp_dt - ref_dt).days == 30


def test_13_longer_term_memory_receives_correct_expiration():
    """Test long term memory gets MEMORY_LONG_TERM_RETENTION_DAYS (90 days)."""
    cand = ExtractedFactCandidate(title="Daughter Emily", content="Emily is the patient's daughter", memory_type="RELATIONSHIP", confidence=0.95)
    bd = ScoreBreakdown(importance=90, confidence=90, usefulness=90, persistence=90, novelty=90, total_score=90.0)
    ref_dt = datetime(2026, 9, 24, 12, 0, 0, tzinfo=timezone.utc)
    dec = MemoryDecisionService.evaluate_decision(cand, bd, reference_dt=ref_dt)
    assert dec.retention_days == 90
    exp_dt = datetime.fromisoformat(dec.expires_at)
    assert (exp_dt - ref_dt).days == 90


def test_14_event_specific_expiration_is_respected():
    """Test that events with explicit event_date expire after event_date + 1-day grace period."""
    event_date_str = "2026-10-05"
    cand = ExtractedFactCandidate(
        title="Dr Visit", content="Visiting Dr. Smith", memory_type="EVENT",
        event_date=event_date_str, confidence=0.9
    )
    bd = ScoreBreakdown(importance=80, confidence=80, usefulness=80, persistence=30, novelty=100, total_score=75.0)
    ref_dt = datetime(2026, 9, 24, 12, 0, 0, tzinfo=timezone.utc)
    dec = MemoryDecisionService.evaluate_decision(cand, bd, reference_dt=ref_dt)
    assert dec.retention_policy == "EVENT_EXPIRATION"
    exp_dt = datetime.fromisoformat(dec.expires_at)
    assert exp_dt.date() == date(2026, 10, 6)  # 2026-10-05 + 1 day grace period


def test_15_expired_memories_excluded_from_retrieval(monkeypatch):
    """Test that memories past expires_at are excluded from active retrieval."""
    now_dt = datetime.now(timezone.utc)
    past_exp = (now_dt - timedelta(days=2)).isoformat()
    future_exp = (now_dt + timedelta(days=10)).isoformat()

    rows = [
        {"id": "m_active", "patient_id": "P1", "title": "Fresh memory", "content": "Content fresh", "status": "ACTIVE", "expires_at": future_exp, "total_score": 80},
        {"id": "m_expired", "patient_id": "P1", "title": "Old memory", "content": "Content old", "status": "ACTIVE", "expires_at": past_exp, "total_score": 80},
    ]

    class FakeQuery:
        def __init__(self, data):
            self._data = data
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def order(self, *a, **k): return self
        def limit(self, *a, **k): return self
        def execute(self):
            class R:
                data = rows
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeQuery(rows))
    memories = ms.get_patient_memories("P1", status="ACTIVE")
    ids = [m["id"] for m in memories]
    assert "m_active" in ids
    assert "m_expired" not in ids


def test_16_cleanup_does_not_delete_structured_medicines_or_documents(monkeypatch):
    """Test that cleanup worker only expires memories and never touches reminders or documents."""
    deleted_tables = []
    updated_rows = []

    class FakeTable:
        def __init__(self, name=""):
            self.name = name
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def lte(self, *a, **k): return self
        def update(self, row):
            updated_rows.append((self.name, row))
            return self
        def delete(self):
            deleted_tables.append(self.name)
            return self
        def execute(self):
            class R:
                data = [{"id": "mem_exp_1", "patient_id": "P1", "expires_at": "2020-01-01T00:00:00Z", "status": "ACTIVE", "retention_policy": "STANDARD_MEMORY"}]
            return R()

    monkeypatch.setattr(cleanup_mod.supabase, "table", lambda name="": FakeTable(name))
    monkeypatch.setattr(cleanup_mod.vectorstore, "delete_memory_vector", lambda *a, **k: True)

    res = cleanup_mod.expire_outdated_memories(force=True)
    assert res["expired_count"] == 1
    assert "memories" in [t[0] for t in updated_rows]
    assert "reminders" not in deleted_tables
    assert "documents" not in deleted_tables


# ==========================================
# 4. MEMORY MANAGEMENT TESTS (Cases 17 - 21)
# ==========================================

def test_17_duplicate_memories_handled_correctly(monkeypatch):
    """Test exact duplicates update confirmation without creating redundant rows."""
    existing = {"id": "m_dup", "patient_id": "P1", "title": "Evening walk preference",
                "content": "The patient prefers to take an evening walk at 6 PM.", "confidence": 0.8}
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [existing])
    updated = {}

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def update(self, row):
            updated.update(row)
            return self
        def execute(self):
            class R: data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    res = ms.create_or_update_memory("P1", {
        "should_create_memory": True, "memory_type": "PREFERENCE",
        "title": "Evening walk preference", "content": "The patient prefers to take an evening walk at 6 PM.",
        "importance": "HIGH", "confidence": 0.95,
    })
    assert res["created"] is False
    assert res["reason"] == "duplicate"
    assert res["memory_id"] == "m_dup"


def test_18_conflicting_memories_not_silently_overwritten(monkeypatch):
    """Test that conflicting memories are marked as PENDING_VALIDATION for review."""
    existing = {"id": "m_city", "patient_id": "P1", "title": "Emily Residence",
                "content": "Emily lives in Delhi.", "confidence": 0.9, "memory_type": "IMPORTANT_FACT"}
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [existing])
    inserted = {}

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def insert(self, row):
            inserted.update(row)
            return self
        def execute(self):
            class R: data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    res = ms.create_or_update_memory("P1", {
        "should_create_memory": True, "memory_type": "IMPORTANT_FACT",
        "title": "Emily Residence", "content": "Emily moved to Mumbai last week.",
        "importance": "HIGH", "confidence": 0.95,
    })
    assert res["created"] is True
    assert res["status"] == "PENDING_VALIDATION"
    assert res["conflict_with"] == "m_city"
    assert inserted["status"] == "PENDING_VALIDATION"


def test_19_memory_updates_preserve_source_references(monkeypatch):
    """Test that source_id (conversation_id) and source_message_id are stored."""
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [])
    inserted = {}

    class FakeTable:
        def insert(self, row):
            inserted.update(row)
            return self
        def execute(self):
            class R: data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    cand = ExtractedFactCandidate(title="Memory with Source", content="Testing source retention", memory_type="IMPORTANT_FACT", confidence=0.85)
    res = ms.create_or_update_memory("P1", cand, source_type="conversation", source_id="conv_123", source_message_id="msg_456")
    assert res["created"] is True
    assert inserted["source_type"] == "conversation"
    assert inserted["source_id"] == "conv_123"
    assert inserted["source_message_id"] == "msg_456"


def test_20_patient_correction_updates_appropriate_memory(monkeypatch):
    """Test patient updating and reconfirming their existing memory."""
    mem_row = {"id": "mem_corr", "patient_id": "P1", "title": "Old Walk", "content": "Walk at 5 PM", "status": "ACTIVE", "memory_type": "PREFERENCE"}
    updated = {}

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def update(self, row):
            updated.update(row)
            return self
        def execute(self):
            class R: data = [mem_row]
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    monkeypatch.setattr(ms.vectorstore, "upsert_memory_vector", lambda *a, **k: True)

    res = ms.update_patient_memory("P1", "mem_corr", title="New Walk", content="Walk at 6 PM", reconfirm=True)
    assert res["success"] is True
    assert updated["title"] == "New Walk"
    assert updated["content"] == "Walk at 6 PM"
    assert "last_confirmed_at" in updated


def test_21_expired_memory_removed_from_chromadb(monkeypatch):
    """Test that deleting/expiring a memory invokes delete_memory_vector in ChromaDB."""
    deleted_vectors = []
    monkeypatch.setattr(vectorstore, "delete_memory_vector", lambda pid, mid: deleted_vectors.append((pid, mid)) or True)

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def update(self, row): return self
        def execute(self):
            class R: data = [{"id": "m_to_del", "patient_id": "PAT_1"}]
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    success = ms.delete_patient_memory("PAT_1", "m_to_del", soft_delete=True)
    assert success is True
    assert ("PAT_1", "m_to_del") in deleted_vectors


# ==========================================
# 5. SECURITY TESTS (Cases 22 - 25)
# ==========================================

def test_22_patient_a_cannot_access_patient_b_memories():
    """Test authz prevents Patient A from requesting Patient B's memories."""
    payload_a = {"role": "Patient", "sub": "PAT_A"}
    assert authz.require_patient_ownership(payload_a, "PAT_A") == "PAT_A"
    with pytest.raises(HTTPException) as exc:
        authz.require_patient_ownership(payload_a, "PAT_B")
    assert exc.value.status_code == 403


def test_23_patient_a_cannot_retrieve_patient_b_vector_records(monkeypatch):
    """Test that ChromaDB search is strictly filtered by authenticated patient_id."""
    queries_run = []

    class FakeCollection:
        def query(self, query_embeddings=None, n_results=5, where=None):
            queries_run.append(where)
            return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

    monkeypatch.setattr(vectorstore, "get_collection", lambda: FakeCollection())
    monkeypatch.setattr(vectorstore, "_embed", lambda texts: [[0.1] * 32 for _ in texts])

    vectorstore.search_memory_vectors("PAT_A", "daughter")
    assert queries_run[-1] == {"patient_id": "PAT_A"}

    vectorstore.search_memory_vectors("PAT_B", "daughter")
    assert queries_run[-1] == {"patient_id": "PAT_B"}


def test_24_caregiver_cannot_access_unrelated_patient(monkeypatch):
    """Test caregiver can only access patients they are assigned to."""
    monkeypatch.setattr(authz, "caretaker_owns_patient", lambda ct, pt: ct == "CT_1" and pt == "PAT_A")
    ct_payload = {"role": "CareTaker", "sub": "CT_1"}

    assert authz.require_caretaker_patient(ct_payload, "PAT_A") == "PAT_A"
    with pytest.raises(HTTPException) as exc:
        authz.require_caretaker_patient(ct_payload, "PAT_UNASSIGNED")
    assert exc.value.status_code in (403, 404)

    # Unauthorized role
    patient_payload = {"role": "Patient", "sub": "PAT_A"}
    with pytest.raises(HTTPException) as exc2:
        authz.require_caretaker_patient(patient_payload, "PAT_A")
    assert exc2.value.status_code == 403


def test_25_unauthorized_user_cannot_modify_or_delete_memories(monkeypatch):
    """Test that updating/deleting memories fails if patient_id doesn't match record owner."""
    mem_record = [{"id": "m_secure", "patient_id": "PAT_OWNER"}]

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def execute(self):
            class R: data = mem_record
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    # Attacker PAT_ATTACKER tries to update PAT_OWNER's memory
    res_up = ms.update_patient_memory("PAT_ATTACKER", "m_secure", title="Hacked")
    assert res_up["success"] is False
    assert res_up["error"] == "not_found"

    res_del = ms.delete_patient_memory("PAT_ATTACKER", "m_secure")
    assert res_del is False


# ==========================================
# 6. INTEGRATION TESTS (Cases 26 - 30)
# ==========================================

def test_26_ai_assistant_triggers_memory_extraction(monkeypatch):
    """Test process_patient_message_memories extracts and evaluates candidates from conversation."""
    saved_rows = []

    def mock_save(patient_id, extraction, **kwargs):
        saved_rows.append(extraction)
        return {"created": True, "memory_id": "mem_ai_1", "status": "ACTIVE"}

    monkeypatch.setattr(ms, "create_or_update_memory", mock_save)
    results = ms.process_patient_message_memories(
        patient_id="PAT_TEST",
        patient_message="My daughter Emily is visiting me next Sunday.",
        conversation_id="conv_test_1",
    )
    assert len(results) >= 1
    assert len(saved_rows) >= 1
    assert any("visit" in r.get("candidate_title", "").lower() or "emily" in r.get("candidate_title", "").lower() for r in results)


def test_27_scoring_decisions_persisted_correctly(monkeypatch):
    """Test that score breakdown and retention details are properly persisted in row dictionary."""
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [])
    inserted_row = {}

    class FakeTable:
        def insert(self, row):
            inserted_row.update(row)
            return self
        def execute(self):
            class R: data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    cand = ExtractedFactCandidate(title="Important Fact", content="Blood type is O positive", memory_type="IMPORTANT_FACT", confidence=0.92)
    res = ms.create_or_update_memory("PAT_1", cand)
    assert res["created"] is True
    assert "importance_score" in inserted_row
    assert "confidence_score" in inserted_row
    assert "usefulness_score" in inserted_row
    assert "persistence_score" in inserted_row
    assert "novelty_score" in inserted_row
    assert "total_score" in inserted_row
    assert "retention_policy" in inserted_row
    assert "expires_at" in inserted_row


def test_28_chromadb_synchronization_failures_recoverable(monkeypatch):
    """Test that ChromaDB failures do not prevent PostgreSQL memory insertion."""
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [])

    class FakeTable:
        def insert(self, row): return self
        def execute(self):
            class R: data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    # ChromaDB raises error
    monkeypatch.setattr(vectorstore, "upsert_memory_vector", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("Chroma down")))

    cand = ExtractedFactCandidate(title="Resilient Memory", content="Must not be lost on Chroma failure", memory_type="IMPORTANT_FACT", confidence=0.9)
    res = ms.create_or_update_memory("PAT_1", cand)
    # Postgres insertion succeeds even though ChromaDB failed
    assert res["created"] is True
    assert "memory_id" in res


def test_29_low_confidence_memories_require_review(monkeypatch):
    """Test high scoring candidate with low confidence is gated to PENDING_VALIDATION."""
    cand = ExtractedFactCandidate(
        title="Uncertain Statement",
        content="Maybe Emily said she lives in London now",
        memory_type="IMPORTANT_FACT",
        confidence=0.55,  # Below MEMORY_MIN_CONFIDENCE=0.70
        requires_confirmation=True,
    )
    score = MemoryScoringService.calculate_score(cand)
    decision = MemoryDecisionService.evaluate_decision(cand, score)
    assert decision.confidence_gate_passed is False
    assert decision.status == "PENDING_VALIDATION"
    assert decision.requires_review is True


def test_30_assistant_can_answer_normally_when_no_memory_stored(monkeypatch):
    """Test that greetings/questions produce 0 candidates and normal reply flow continues without errors."""
    cands = MemoryExtractionService.extract_candidates("Hello CogniCare, what is the weather like?")
    assert len(cands) == 0
    res = ms.process_patient_message_memories("PAT_1", "Hello CogniCare, what is the weather like?")
    assert len(res) == 0
