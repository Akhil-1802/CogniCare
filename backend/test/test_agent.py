"""Offline tests for the CogniCare agent architecture.
No live Supabase / Mistral required."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agent.schemas import validate_extraction_payload
from agent.extraction import extract_memory_candidate
from agent import vectorstore
from agent.orchestrator import _template_answer, _route_tools
from agent import cleanup as cleanup_mod


def test_06_important_info_creates_memory_candidate():
    out = extract_memory_candidate("My daughter Emily is visiting me next Sunday.", "")
    assert out.get("should_create_memory") is True
    valid = validate_extraction_payload({**out, "confidence": 0.94})
    assert valid is not None
    assert valid.memory_type in ("PERSON", "EVENT", "RELATIONSHIP")


def test_07_normal_chit_chat_creates_no_memory():
    out = extract_memory_candidate("Hi, thanks!", "")
    assert out.get("should_create_memory") is False
    assert validate_extraction_payload(out) is None


def test_15_invalid_llm_output_rejected():
    assert validate_extraction_payload({"should_create_memory": True}) is None
    assert validate_extraction_payload({
        "should_create_memory": True, "memory_type": "NOPE",
        "title": "x", "content": "short", "importance": "HIGH", "confidence": 0.9,
    }) is None
    assert validate_extraction_payload({
        "should_create_memory": True, "memory_type": "PERSON",
        "title": "ab", "content": "short", "importance": "HIGH", "confidence": 5.0,
    }) is None
    assert validate_extraction_payload({"should_create_memory": False}) is None


def test_05_vector_search_is_patient_scoped(monkeypatch):
    calls = {}

    class FakeCol:
        def query(self, query_embeddings=None, n_results=5, where=None):
            calls["where"] = where
            return {"ids": [["m1"]], "documents": [["doc"]],
                    "metadatas": [[{"memory_id": "m1"}]], "distances": [[0.1]]}

    monkeypatch.setattr(vectorstore, "get_collection", lambda: FakeCol())
    monkeypatch.setattr(vectorstore, "_embed", lambda texts: [[0.1] * 32 for _ in texts])
    out = vectorstore.search_memory_vectors("PAT-A", "Emily", k=5)
    assert calls["where"] == {"patient_id": "PAT-A"}
    assert out and out[0]["memory_id"] == "m1"
    # Different patient → different filter, never global
    vectorstore.search_memory_vectors("PAT-B", "Emily")
    assert calls["where"] == {"patient_id": "PAT-B"}


def test_08_09_duplicate_and_conflict_handling(monkeypatch):
    import agent.memory_service as ms

    existing = {"id": "old1", "patient_id": "P1", "title": "Emily visit",
                "content": "Emily lives in Delhi.", "confidence": 0.8}
    monkeypatch.setattr(ms, "find_candidate_duplicates", lambda *a, **k: [existing])
    inserted = {}
    updated = {}

    class FakeTable:
        def __init__(self, name=""):
            self.name = name

        def insert(self, row):
            inserted.update(row if isinstance(row, dict) else {})
            return self

        def update(self, row):
            updated.update(row)
            return self

        def eq(self, *a, **k):
            return self

        def execute(self):
            class R:
                data = []
            return R()

    monkeypatch.setattr(ms.supabase, "table", lambda name="": FakeTable(name))
    monkeypatch.setattr(ms.vectorstore, "upsert_memory_vector", lambda *a, **k: True)

    # Exact duplicate → no new memory
    res = ms.create_or_update_memory("P1", {
        "should_create_memory": True, "memory_type": "PERSON",
        "title": "Emily visit", "content": "Emily lives in Delhi.",
        "importance": "HIGH", "confidence": 0.9,
    })
    assert res["created"] is False and res["reason"] == "duplicate"

    # Conflicting info → new PENDING_VALIDATION, old kept
    res2 = ms.create_or_update_memory("P1", {
        "should_create_memory": True, "memory_type": "PERSON",
        "title": "Emily visit", "content": "Emily moved to Mumbai last week for work.",
        "importance": "HIGH", "confidence": 0.9,
    })
    assert res2["created"] is True
    assert res2["status"] == "PENDING_VALIDATION"
    assert res2["conflict_with"] == "old1"


def test_01_04_authz_patient_and_caretaker_scoping():
    from fastapi import HTTPException
    from agent import authz

    # Patient can access own id, not another's
    assert authz.require_patient_ownership({"role": "Patient", "sub": "PAT-A"}, "PAT-A") == "PAT-A"
    try:
        authz.require_patient_ownership({"role": "Patient", "sub": "PAT-A"}, "PAT-B")
        raise AssertionError("should have raised")
    except HTTPException as e:
        assert e.status_code == 403

    # CareTaker scoping delegates to ownership check
    import agent.authz as az
    orig = az.caretaker_owns_patient
    az.caretaker_owns_patient = lambda c, p: (c == "CT1" and p == "PAT-A")
    try:
        assert az.require_caretaker_patient({"role": "CareTaker", "sub": "CT1"}, "PAT-A") == "PAT-A"
        try:
            az.require_caretaker_patient({"role": "CareTaker", "sub": "CT1"}, "PAT-B")
            raise AssertionError("should have raised")
        except HTTPException:
            pass
    finally:
        az.caretaker_owns_patient = orig


def test_10_cleanup_disabled_by_default():
    res = cleanup_mod.delete_expired_conversations(enabled=False)
    assert res["cleaned"] == 0 and res["reason"] == "cleanup_disabled"


def test_11_13_14_tool_scoping_and_safe_empty_answers(monkeypatch):
    from agent import tools_impl

    # Document search never leaks: always empty
    assert tools_impl.search_patient_documents("PAT-A", "report") == []
    assert tools_impl.get_document_details("PAT-A", "doc1") is None

    # Reminder creation validates input before DB
    try:
        tools_impl.create_reminder("P1", {"title": "", "reminder_date": "2026-09-19", "reminder_time": "10:00"})
        raise AssertionError("should have raised")
    except ValueError:
        pass

    # Empty retrieval → honest answer, no hallucination
    ans = _template_answer("What medicine do I take tonight?", {"medicines": []})
    assert "don't have" in ans.lower()
    ans2 = _template_answer("What did my latest report say?", {"documents": []})
    assert "couldn't find" in ans2.lower()

    # Routing picks relevant tools without exposing patient_id to LLM,
    # and uses NO tools for pure greetings (no bogus sources).
    tools = _route_tools("What medicine do I take tonight?")
    assert "get_today_medicines" in tools
    assert _route_tools("hi") == []
    assert _route_tools("Hello, how are you?") == []
    assert "Source" not in _template_answer("hi", {"reminders": [{"title": "x"}]})
