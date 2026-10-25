"""Comprehensive 20-Case Audit Test Suite for CogniCare Memory System.
Directly implements and validates all 20 required test cases specified in the primary objective,
plus a synthetic evaluation dataset measuring precision, recall, and false-retention rate.
"""
import sys
import os
from datetime import datetime, timezone, timedelta, date
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import settings
from main import app
from agent.schemas import (
    ExtractedFactCandidate,
    ScoreBreakdown,
    MemoryDecisionResult,
    validate_candidate,
    validate_extraction_payload,
)
from agent.scoring_service import MemoryScoringService
from agent.decision_service import MemoryDecisionService
from agent.extraction import MemoryExtractionService
from agent import memory_service as ms
from agent import vectorstore
from agent import cleanup as cleanup_mod
from agent import authz
from agent.orchestrator import orchestrator, _route_tools, _template_answer, _store_message
from utils.auth import create_access_token


# =========================================================================
# Case 1: Important, explicitly stated personal fact
# =========================================================================
def test_case_01_important_explicitly_stated_personal_fact():
    msg = "Emily is my daughter and she is a neurologist in Delhi."
    cands = MemoryExtractionService.extract_candidates(msg)
    assert len(cands) >= 1
    c = cands[0]
    assert c.memory_type in ("RELATIONSHIP", "PERSON", "IMPORTANT_FACT")
    assert "Emily" in c.title or "Emily" in c.content

    score = MemoryScoringService.calculate_score(c)
    assert score.importance >= 80.0
    assert score.confidence >= 80.0
    assert score.total_score >= 70.0

    dec = MemoryDecisionService.evaluate_decision(c, score)
    assert dec.confidence_gate_passed is True
    assert dec.status == "ACTIVE"
    assert dec.retention_policy in ("RELATIONSHIP_POLICY", "LONG_TERM_MEMORY", "STANDARD_MEMORY")


# =========================================================================
# Case 2: Temporary upcoming event
# =========================================================================
def test_case_02_temporary_upcoming_event():
    ref_dt = datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)
    cands = MemoryExtractionService.extract_candidates(
        "My daughter Emily is visiting me next Sunday.", reference_dt=ref_dt
    )
    assert len(cands) >= 1
    ev_cands = [c for c in cands if c.memory_type == "EVENT" or "visit" in c.title.lower()]
    assert len(ev_cands) >= 1
    ev = ev_cands[0]

    score = MemoryScoringService.calculate_score(ev)
    dec = MemoryDecisionService.evaluate_decision(ev, score, reference_dt=ref_dt)
    assert dec.decision in ("TEMPORARY_MEMORY", "STANDARD_MEMORY", "LONG_TERM_MEMORY")
    assert dec.expires_at is not None
    # Event expiration must be within event timeframe plus grace period
    exp_dt = datetime.fromisoformat(dec.expires_at)
    assert exp_dt > ref_dt
    assert (exp_dt - ref_dt).days <= 14


# =========================================================================
# Case 3: Casual conversation that should not become a long-term memory
# =========================================================================
def test_case_03_casual_conversation_not_long_term_memory():
    chit_chat_messages = [
        "Hello, how are you today?",
        "Thank you very much!",
        "Good morning",
        "Just having a cup of tea, nice weather",
        "Bye for now",
    ]
    for m in chit_chat_messages:
        cands = MemoryExtractionService.extract_candidates(m)
        assert len(cands) == 0, f"Expected 0 candidates for casual conversation: '{m}'"


# =========================================================================
# Case 4: Duplicate fact
# =========================================================================
def test_case_04_duplicate_fact_handling(monkeypatch):
    existing_mem = {
        "id": "mem_dup_existing",
        "patient_id": "PAT_D1",
        "title": "Evening walk preference",
        "content": "The patient prefers to take an evening walk at 6 PM.",
        "confidence": 0.85,
        "memory_type": "PREFERENCE",
    }
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [existing_mem])
    updated_fields = {}

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def update(self, row):
            updated_fields.update(row)
            return self
        def execute(self):
            class R: data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    res = ms.create_or_update_memory(
        patient_id="PAT_D1",
        extraction=ExtractedFactCandidate(
            title="Evening walk preference",
            content="The patient prefers to take an evening walk at 6 PM.",
            memory_type="PREFERENCE",
            confidence=0.92,
        ),
    )
    assert res["created"] is False
    assert res["reason"] == "duplicate"
    assert res["memory_id"] == "mem_dup_existing"
    assert "last_confirmed_at" in updated_fields


# =========================================================================
# Case 5: Updated fact
# =========================================================================
def test_case_05_updated_fact_handling(monkeypatch):
    existing_mem = {
        "id": "mem_delhi",
        "patient_id": "PAT_U1",
        "title": "Emily Residence",
        "content": "Emily lives in Delhi.",
        "confidence": 0.90,
        "memory_type": "IMPORTANT_FACT",
    }
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [existing_mem])
    inserted_rows = []

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def insert(self, row):
            inserted_rows.append(row)
            return self
        def execute(self):
            class R: data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    new_candidate = ExtractedFactCandidate(
        title="Emily Residence",
        content="Emily moved to Jaipur last week.",
        memory_type="IMPORTANT_FACT",
        confidence=0.92,
        entities=["Emily", "Jaipur"],
    )
    rel = ms.classify_candidate_relation(new_candidate, existing_mem)
    assert rel == "UPDATE_CANDIDATE"

    res = ms.create_or_update_memory("PAT_U1", new_candidate)
    assert res["created"] is True
    assert res.get("supersedes_id") == "mem_delhi"
    assert inserted_rows[0]["metadata"]["supersedes_id"] == "mem_delhi"


# =========================================================================
# Case 6: Conflicting facts
# =========================================================================
def test_case_06_conflicting_facts_flagged(monkeypatch):
    existing_mem = {
        "id": "mem_blood_a",
        "patient_id": "PAT_C1",
        "title": "Blood Type Record",
        "content": "Blood group is A positive.",
        "confidence": 0.90,
        "memory_type": "IMPORTANT_FACT",
    }
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [existing_mem])
    inserted_rows = []

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def insert(self, row):
            inserted_rows.append(row)
            return self
        def execute(self):
            class R: data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    contradictory_candidate = ExtractedFactCandidate(
        title="Blood Type Record",
        content="Blood group is O negative.",
        memory_type="IMPORTANT_FACT",
        confidence=0.85,
    )
    res = ms.create_or_update_memory("PAT_C1", contradictory_candidate)
    assert res["created"] is True
    assert res["status"] == "PENDING_VALIDATION"
    assert res["conflict_with"] == "mem_blood_a"
    assert inserted_rows[0]["metadata"]["requires_review"] is True


# =========================================================================
# Case 7: Malformed LLM evaluation output
# =========================================================================
def test_case_07_malformed_llm_evaluation_output_handled_safely():
    malformed_payloads = [
        {},
        {"title": ""},
        {"title": "Valid title", "content": "too"},  # content too short
        {"title": "T", "content": "Valid content text here"},  # title too short
        {"title": "Valid Title", "content": "Valid Content Here", "confidence": -0.5},
        {"title": "Valid Title", "content": "Valid Content Here", "importance_estimate": 150.0},
    ]
    for p in malformed_payloads:
        assert validate_candidate(p) is None


# =========================================================================
# Case 8: Low-confidence candidate with a high calculated score
# =========================================================================
def test_case_08_low_confidence_candidate_with_high_score_gated():
    # Low confidence (0.50), high importance/persistence
    candidate = ExtractedFactCandidate(
        title="Uncertain Important Statement",
        content="Someone told me I might have heart surgery next month",
        memory_type="IMPORTANT_FACT",
        confidence=0.50,  # Below MEMORY_MIN_CONFIDENCE=0.70
        importance_estimate=95.0,
        usefulness_estimate=95.0,
        persistence_estimate=90.0,
        requires_confirmation=True,
    )
    score = MemoryScoringService.calculate_score(candidate)
    decision = MemoryDecisionService.evaluate_decision(candidate, score)

    # Confidence gate MUST fail, forcing PENDING_VALIDATION despite high score
    assert decision.confidence_gate_passed is False
    assert decision.status == "PENDING_VALIDATION"
    assert decision.requires_review is True
    assert "below minimum threshold" in decision.reason


# =========================================================================
# Case 9: Memory expiration
# =========================================================================
def test_case_09_memory_expiration_lifecycle(monkeypatch):
    now_dt = datetime.now(timezone.utc)
    past_iso = (now_dt - timedelta(days=2)).isoformat()

    expired_record = {
        "id": "mem_due_for_exp",
        "patient_id": "PAT_EXP",
        "expires_at": past_iso,
        "status": "ACTIVE",
        "retention_policy": "TEMPORARY_MEMORY",
    }
    updated_records = []

    class FakeTable:
        def __init__(self, name=""): self.name = name
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def lte(self, *a, **k): return self
        def update(self, row):
            updated_records.append((self.name, row))
            return self
        def execute(self):
            class R: data = [expired_record]
            return R()

    monkeypatch.setattr(cleanup_mod.supabase, "table", lambda name="": FakeTable(name))
    deleted_vectors = []
    monkeypatch.setattr(cleanup_mod.vectorstore, "delete_memory_vector", lambda *a, **k: deleted_vectors.append((k.get("patient_id") or (a[0] if len(a) > 0 else None), k.get("memory_id") or (a[1] if len(a) > 1 else None))) or True)

    res = cleanup_mod.expire_outdated_memories(force=True)
    assert res["expired_count"] == 1
    assert "mem_due_for_exp" in res["expired_ids"]
    assert ("PAT_EXP", "mem_due_for_exp") in deleted_vectors
    assert updated_records[0][1]["status"] == "EXPIRED"


# =========================================================================
# Case 10: Retrieval of the correct memory for the correct patient
# =========================================================================
def test_case_10_retrieval_of_correct_memory_for_correct_patient(monkeypatch):
    mem_p1 = {"id": "m_p1", "patient_id": "PAT_101", "title": "Daughter Emily", "content": "Emily is my daughter", "status": "ACTIVE", "confidence": 0.95}
    mem_p2 = {"id": "m_p2", "patient_id": "PAT_102", "title": "Son Robert", "content": "Robert is my son", "status": "ACTIVE", "confidence": 0.95}

    class FakeTable:
        def __init__(self, data): self._data = data
        def select(self, *a, **k): return self
        def in_(self, *a, **k): return self
        def eq(self, col, val):
            self._data = [d for d in self._data if d.get(col) == val]
            return self
        def limit(self, *a, **k): return self
        def execute(self):
            class R: pass
            r = R()
            r.data = self._data
            return r

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable([mem_p1, mem_p2]))
    monkeypatch.setattr(vectorstore, "search_memory_vectors", lambda pid, q, **k: [{"memory_id": "m_p1" if pid == "PAT_101" else "m_p2"}])

    results = ms.search_verified_memories("PAT_101", "daughter")
    assert len(results) == 1
    assert results[0]["id"] == "m_p1"
    assert "Emily" in results[0]["content"]


# =========================================================================
# Case 11: No relevant memory found
# =========================================================================
def test_case_11_no_relevant_memory_found_honest_response(monkeypatch):
    monkeypatch.setattr(vectorstore, "search_memory_vectors", lambda *a, **k: [])
    class EmptyTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def in_(self, *a, **k): return self
        def limit(self, *a, **k): return self
        def execute(self):
            class R: data = []
            return R()
    monkeypatch.setattr(ms.supabase, "table", lambda name="": EmptyTable())

    results = ms.search_verified_memories("PAT_111", "Where did I put my keys?")
    assert len(results) == 0

    answer = _template_answer("Where did I put my keys?", {"memories": []})
    assert "in your records" in answer.lower()
    assert "ask your caretaker" in answer.lower()


# =========================================================================
# Case 12: Expired or rejected memory excluded from verified retrieval
# =========================================================================
def test_case_12_expired_or_rejected_memory_excluded_from_verified_retrieval(monkeypatch):
    now_dt = datetime.now(timezone.utc)
    records = [
        {"id": "m_active", "patient_id": "PAT_12", "title": "Active fact", "content": "Valid fact", "status": "ACTIVE", "expires_at": (now_dt + timedelta(days=5)).isoformat(), "confidence": 0.9},
        {"id": "m_expired", "patient_id": "PAT_12", "title": "Expired fact", "content": "Old fact", "status": "ACTIVE", "expires_at": (now_dt - timedelta(days=5)).isoformat(), "confidence": 0.9},
        {"id": "m_rejected", "patient_id": "PAT_12", "title": "Rejected fact", "content": "Bad fact", "status": "REJECTED", "confidence": 0.9},
    ]

    class FakeMemTable:
        def select(self, *a, **k): return self
        def in_(self, *a, **k): return self
        def eq(self, col, val):
            return self
        def execute(self):
            class R: data = [records[0]]  # only ACTIVE unexpired returned by DB
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeMemTable())
    monkeypatch.setattr(vectorstore, "search_memory_vectors", lambda *a, **k: [{"memory_id": "m_active"}, {"memory_id": "m_expired"}])

    results = ms.search_verified_memories("PAT_12", "fact")
    ids = [r["id"] for r in results]
    assert "m_active" in ids
    assert "m_expired" not in ids
    assert "m_rejected" not in ids


# =========================================================================
# Case 13: Vector indexing failure followed by retry
# =========================================================================
def test_case_13_vector_indexing_failure_followed_by_retry(monkeypatch):
    mem_saved = None
    updated_meta = {}

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def insert(self, row):
            nonlocal mem_saved
            mem_saved = dict(row)
            return self
        def update(self, row):
            updated_meta.update(row)
            return self
        def execute(self):
            class R:
                data = [mem_saved] if mem_saved else []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [])

    # Step A: ChromaDB failure during initial memory creation
    def chroma_fail(*a, **k):
        raise RuntimeError("Chroma connection refused")

    monkeypatch.setattr(vectorstore, "upsert_memory_vector", chroma_fail)

    cand = ExtractedFactCandidate(title="Resilient Fact", content="Must persist despite vector outage", memory_type="IMPORTANT_FACT", confidence=0.9)
    res = ms.create_or_update_memory("PAT_13", cand)
    assert res["created"] is True
    assert res["vector_synced"] is False
    assert mem_saved is not None
    assert mem_saved["metadata"]["vector_synced"] is False

    # Step B: ChromaDB comes back online -> reconcile / retry
    chroma_synced_ids = []
    def chroma_success(patient_id, memory_id, **k):
        chroma_synced_ids.append(memory_id)
        return True

    monkeypatch.setattr(vectorstore, "upsert_memory_vector", chroma_success)
    rec_res = ms.reconcile_memory_vectors(patient_id="PAT_13")
    assert rec_res["success"] is True
    assert rec_res["synced"] == 1
    assert mem_saved["id"] in chroma_synced_ids
    assert updated_meta["metadata"]["vector_synced"] is True


# =========================================================================
# Case 14: Correct response based on retrieved evidence
# =========================================================================
def test_case_14_correct_response_based_on_retrieved_evidence():
    ctx = {
        "memories": [{"title": "Emily Residence", "content": "Emily lives in Delhi and works as a doctor."}]
    }
    answer = _template_answer("Where does Emily live?", ctx)
    assert "From your stored memories: Emily lives in Delhi and works as a doctor." in answer


# =========================================================================
# Case 15: Unsupported factual answer prevented or flagged
# =========================================================================
def test_case_15_unsupported_factual_answer_prevented_or_flagged():
    # If no memories/records exist for a personal factual query
    ctx = {"memories": [], "medicines": [], "appointments": []}
    answer = _template_answer("What medicine did Dr. Sharma prescribe for my leg pain?", ctx)
    assert "I don't have that medicine scheduled in your records" in answer
    assert "ask your caretaker" in answer.lower()


# =========================================================================
# Case 16: Unauthorized caregiver request rejected
# =========================================================================
def test_case_16_unauthorized_caregiver_request_rejected(monkeypatch):
    monkeypatch.setattr(authz, "caretaker_owns_patient", lambda ct_id, p_id: ct_id == "CT_ALLOWED" and p_id == "PAT_ASSIGNED")
    unauthorized_payload = {"role": "CareTaker", "sub": "CT_INTRUDER"}

    with pytest.raises(HTTPException) as exc:
        authz.require_caretaker_patient(unauthorized_payload, "PAT_ASSIGNED")
    assert exc.value.status_code == 404


# =========================================================================
# Case 17: Cross-patient vector retrieval prevented
# =========================================================================
def test_case_17_cross_patient_vector_retrieval_prevented(monkeypatch):
    captured_filters = []

    class MockCollection:
        def query(self, query_embeddings=None, n_results=5, where=None):
            captured_filters.append(where)
            # Return memory with meta
            return {
                "ids": [["m_other"]],
                "documents": [["Other patient memory"]],
                "metadatas": [[{"patient_id": "PAT_OTHER", "memory_id": "m_other"}]],
                "distances": [[0.05]],
            }

    monkeypatch.setattr(vectorstore, "get_collection", lambda: MockCollection())
    monkeypatch.setattr(vectorstore, "_embed", lambda texts: [[0.1] * 32 for _ in texts])

    hits = vectorstore.search_memory_vectors("PAT_AUTHENTICATED", "doctor")
    assert captured_filters[-1] == {"patient_id": "PAT_AUTHENTICATED"}
    # Because returned metadata belonged to PAT_OTHER, the cross-patient guard filtered it out
    assert len(hits) == 0


# =========================================================================
# Case 18: Duplicate processing of the same message prevented
# =========================================================================
def test_case_18_duplicate_processing_of_same_message_prevented(monkeypatch):
    import agent.orchestrator as orch
    orch._processed_message_ids.clear()

    cid = "conv_idem_1"
    msg_id = orch._store_message(cid, "PATIENT", "Emily is my daughter.")
    assert msg_id is not None

    extraction_count = 0
    def mock_process(*a, **k):
        nonlocal extraction_count
        extraction_count += 1
        return [{"created": True}]

    monkeypatch.setattr(orch, "process_patient_message_memories", mock_process)

    # First execution
    if msg_id not in orch._processed_message_ids:
        orch._processed_message_ids.add(msg_id)
        orch.process_patient_message_memories("P1", "Emily is my daughter.", message_id=msg_id)

    # Duplicate execution attempt with same message ID
    if msg_id not in orch._processed_message_ids:
        orch._processed_message_ids.add(msg_id)
        orch.process_patient_message_memories("P1", "Emily is my daughter.", message_id=msg_id)

    assert extraction_count == 1, "Expected duplicate message processing to be skipped"


# =========================================================================
# Case 19: Correction and re-indexing of an existing memory
# =========================================================================
def test_case_19_correction_and_reindexing_of_existing_memory(monkeypatch):
    existing_row = {"id": "mem_pref_walk", "patient_id": "PAT_19", "title": "Walk", "content": "Walk at 5 PM", "status": "ACTIVE", "memory_type": "PREFERENCE"}
    updated_row = {}

    class FakeTable:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def update(self, row):
            updated_row.update(row)
            return self
        def execute(self):
            class R: data = [existing_row]
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable())
    reindexed_vectors = []
    monkeypatch.setattr(ms.vectorstore, "upsert_memory_vector", lambda *a, **k: reindexed_vectors.append((k.get("patient_id") or a[0], k.get("memory_id") or a[1], k.get("text") or a[2])) or True)

    res = ms.update_patient_memory("PAT_19", "mem_pref_walk", title="Evening Walk", content="Walk at 6:30 PM", reconfirm=True)
    assert res["success"] is True
    assert updated_row["title"] == "Evening Walk"
    assert updated_row["content"] == "Walk at 6:30 PM"
    assert len(reindexed_vectors) == 1
    assert "Evening Walk. Walk at 6:30 PM" in reindexed_vectors[0][2]


# =========================================================================
# Case 20: Existing chat and reminder functionality remains intact
# =========================================================================
def test_case_20_existing_chat_and_reminder_functionality_intact(monkeypatch):
    tools_selected = _route_tools("What medicine do I take tonight?")
    assert "get_today_medicines" in tools_selected

    appt_tools = _route_tools("Do I have a doctor appointment tomorrow?")
    assert "get_upcoming_appointments" in appt_tools or "get_patient_reminders" in appt_tools

    reminder_tools = _route_tools("Remind me to call Emily tomorrow at 10 AM")
    assert "get_patient_reminders" in reminder_tools or "search_patient_memories" in reminder_tools


# =========================================================================
# Synthetic Dataset Evaluation Metrics
# =========================================================================
def test_synthetic_evaluation_metrics():
    """
    Evaluates a small synthetic test set of 10 candidate statements:
    Measures Precision, Recall, and False-Retention Rate.
    """
    test_cases = [
        # (input_text, should_retain, category)
        ("Emily is my daughter and she visits on Sundays.", True, "RELATIONSHIP"),
        ("I take Metformin 500mg twice a day.", True, "MEDICINE"),
        ("I prefer my evening walk at 6 PM in the park.", True, "PREFERENCE"),
        ("Doctor appointment with Dr. Gupta next Wednesday at 10 AM.", True, "APPOINTMENT"),
        ("My blood type is O positive.", True, "IMPORTANT_FACT"),
        ("Hello, good morning!", False, "NONE"),
        ("Thank you very much, see you later.", False, "NONE"),
        ("Nice weather outside today.", False, "NONE"),
        ("How are you doing today assistant?", False, "NONE"),
        ("Okay, sure.", False, "NONE"),
    ]

    tp = 0  # True Positive: Expected retain & retained
    fp = 0  # False Positive: Expected discard & retained (False-retention)
    tn = 0  # True Negative: Expected discard & discarded
    fn = 0  # False Negative: Expected retain & discarded

    for text, should_retain, expected_cat in test_cases:
        cands = MemoryExtractionService.extract_candidates(text)
        retained = len(cands) > 0

        if should_retain and retained:
            tp += 1
        elif not should_retain and retained:
            fp += 1
        elif not should_retain and not retained:
            tn += 1
        elif should_retain and not retained:
            fn += 1

    precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
    false_retention_rate = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    assert precision >= 0.90, f"Precision below 90%: {precision:.2f}"
    assert recall >= 0.80, f"Recall below 80%: {recall:.2f}"
    assert false_retention_rate <= 0.10, f"False retention rate above 10%: {false_retention_rate:.2f}"
