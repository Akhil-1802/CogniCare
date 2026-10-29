"""Offline tests for assistant message understanding:
- declarations ("i have placed my wallet at my kitchen slab.") → stored + confirmed
- personal-memory questions → relevance-gated search
- nothing similar found → honest miss + caretaker offer (never a random suggestion)
No live Supabase / Mistral required."""
import sys
import os
import threading

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agent.orchestrator import (
    _classify_message_intent,
    _is_personal_declaration,
    _llm_plan,
    _memory_miss_reply,
    _INTENT_ROUTES,
)
from agent import tools_impl
from agent import orchestrator as orch


# ---------------------------------------------------------------------------
# 1. Understanding what was asked
# ---------------------------------------------------------------------------

def test_declaration_is_understood_as_something_to_store():
    assert _classify_message_intent("i have placed my wallet at my kitchen slab.") == "personal_declaration"
    assert _classify_message_intent("my wallet is in the kitchen") == "personal_declaration"
    assert _classify_message_intent("I kept my keys in the bedroom") == "personal_declaration"
    assert _classify_message_intent("remember that my spectacles are on the table") == "personal_declaration"
    assert _is_personal_declaration("my name is sunita") is True


def test_wallet_questions_are_memory_lookups_even_with_typos():
    for msg in ("where's is my wallet?", "where is my wallet?", "wheres my wallet",
                "wheres my wallet", "where's my wallet", "tell me where my wallet is"):
        assert _classify_message_intent(msg) == "personal_memory", msg
    # forgetting is a lookup, never a new fact
    assert _classify_message_intent("i forgot where i kept my wallet") is None


def test_records_and_creation_requests_keep_their_flows():
    assert _classify_message_intent("What's my appointment today?") == "appointment"
    assert _classify_message_intent("where is my medicine?") == "medicine"  # records ≠ memories
    assert _classify_message_intent("what are my reminders for today?") == "reminder"
    assert _classify_message_intent("what is my routine today?") == "routine"
    # creation/ambiguous statements still go to the LLM planner
    assert _classify_message_intent("I have a doctor appointment today at 3pm with Dr. Smith") is None
    assert _classify_message_intent("remind me to drink water") is None
    assert _classify_message_intent("i have to take my medicine at 8pm") is None


def test_general_chat_and_caregiver_requests():
    assert _classify_message_intent("Hello, how are you?") == "general"
    assert _classify_message_intent("tell me a joke") == "general"
    assert _classify_message_intent("what is diabetes?") == "general"
    assert _classify_message_intent("please ask my caregiver about my appointment") == "caregiver"
    # determinstic routes: no random tools for chat or declarations
    assert _INTENT_ROUTES["general"] == []
    assert _INTENT_ROUTES["personal_declaration"] == []
    assert _INTENT_ROUTES["personal_memory"] == ["search_patient_memories"]


def test_llm_plan_is_deterministic_for_declaration_and_wallet_question():
    p1 = _llm_plan("i have placed my wallet at my kitchen slab.", [])
    p2 = _llm_plan("where's is my wallet?", [])
    assert p1["tools"] == [] and p1["intent"] == "personal_declaration"
    assert p2["tools"] == ["search_patient_memories"] and p2["intent"] == "personal_memory"
    assert p2["memory_query"] == "where's is my wallet?"


# ---------------------------------------------------------------------------
# 2. Relevance gate: never serve an unrelated nearest-neighbour
# ---------------------------------------------------------------------------

_APPT_ROW = {"id": "m1", "patient_id": "PAT-A", "status": "ACTIVE",
             "title": "Medical appointment mentioned",
             "content": "Do i have any appointment today?", "confidence": 0.92}
_WALLET_ROW = {"id": "m2", "patient_id": "PAT-A", "status": "ACTIVE",
               "title": "Wallet location",
               "content": "Patient placed wallet on kitchen slab.", "confidence": 0.9}


def test_unrelated_memory_is_not_relevant_for_wallet_question():
    # the exact screenshot bug: appointment note returned for "where is my wallet?"
    assert tools_impl._is_relevant_memory(_APPT_ROW, "where's is my wallet?", 0.92) is False
    # ...but it IS relevant for an appointment question
    assert tools_impl._is_relevant_memory(_APPT_ROW, "do i have any appointment today?", 0.92) is True
    # lexical overlap keeps the wallet memory even at a larger distance
    assert tools_impl._is_relevant_memory(_WALLET_ROW, "where's is my wallet?", 0.85) is True
    # tight semantic distance covers rephrasings without shared words
    assert tools_impl._is_relevant_memory(_WALLET_ROW, "where are my spectacles?", 0.30) is True


def test_search_patient_memories_drops_unrelated_hits(monkeypatch):
    from agent import vectorstore

    # Chroma returns the nearest neighbour even though it is unrelated
    monkeypatch.setattr(vectorstore, "search_memory_vectors",
                        lambda pid, q, k=5: [{"memory_id": "m1", "distance": 0.92}])

    class _R:
        data = [_APPT_ROW]

    class _T:
        def select(self, *a, **k): return self
        def in_(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def limit(self, *a, **k): return self
        def execute(self): return _R

    monkeypatch.setattr(tools_impl.supabase, "table", lambda name: _T())
    assert tools_impl.search_patient_memories("PAT-A", "where is my wallet?") == []


def test_search_patient_memories_keeps_relevant_hits(monkeypatch):
    from agent import vectorstore

    monkeypatch.setattr(vectorstore, "search_memory_vectors",
                        lambda pid, q, k=5: [{"memory_id": "m2", "distance": 0.85}])

    class _R:
        data = [_WALLET_ROW]

    class _T:
        def select(self, *a, **k): return self
        def in_(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def limit(self, *a, **k): return self
        def execute(self): return _R

    monkeypatch.setattr(tools_impl.supabase, "table", lambda name: _T())
    rows = tools_impl.search_patient_memories("PAT-A", "where's is my wallet?")
    assert rows and rows[0]["id"] == "m2"


# ---------------------------------------------------------------------------
# 3. End-to-end chat behaviour (offline: fakes for DB, threads and LLM)
# ---------------------------------------------------------------------------

class _ImmediateThread:
    """Runs the target synchronously so background work is deterministic in tests."""
    def __init__(self, target=None, args=(), kwargs=None, daemon=None):
        self._target, self._args, self._kw = target, args, kwargs or {}

    def start(self):
        if self._target:
            self._target(*self._args, **self._kw)


class _FakeResult:
    data = []


class _FakeTable:
    def select(self, *a, **k): return self
    def insert(self, *a, **k): return self
    def update(self, *a, **k): return self
    def eq(self, *a, **k): return self
    def in_(self, *a, **k): return self
    def neq(self, *a, **k): return self
    def order(self, *a, **k): return self
    def limit(self, *a, **k): return self
    def execute(self): return _FakeResult()


class _FakeSupabase:
    def table(self, name):
        return _FakeTable()


def _bypass_network(monkeypatch):
    """Patch everything that would touch the network or a real LLM."""
    monkeypatch.setattr(orch, "require_key", lambda: "test-key")
    monkeypatch.setattr(orch, "_ensure_conversation", lambda pid, cid: cid or "conv-test")
    monkeypatch.setattr(orch, "_recent_history", lambda cid, limit=10: [])
    monkeypatch.setattr(orch, "supabase", _FakeSupabase())
    monkeypatch.setattr(orch, "_llm_update_daily_summary", lambda *a, **k: None)
    monkeypatch.setattr(orch, "process_patient_message_memories", lambda **k: [])
    monkeypatch.setattr(orch, "_processed_message_ids", set())
    monkeypatch.setattr(threading, "Thread", _ImmediateThread)
    stored = []

    def _record_store(cid, sender, content, tool_name=None, metadata=None):
        stored.append({"sender": sender, "content": content, "metadata": metadata or {}})
        return f"msg-{len(stored)}"

    monkeypatch.setattr(orch, "_store_message", _record_store)
    return stored


def _fail_answer(*a, **k):
    raise AssertionError("_llm_answer must not be called for this intent")


def test_declaration_is_stored_and_confirmed_without_escalation(monkeypatch):
    from agent.extraction import MemoryExtractionService

    _bypass_network(monkeypatch)
    # Worst case: LLM extraction returns nothing → fallback must still store.
    monkeypatch.setattr(MemoryExtractionService, "extract_candidates",
                        staticmethod(lambda **k: []))
    saved = {}

    def _fake_create(patient_id, cand, **k):
        saved["content"] = cand.content
        return {"created": True, "memory_id": "m1", "status": "ACTIVE",
                "total_score": 82.0, "vector_synced": True}

    monkeypatch.setattr(orch, "create_or_update_memory", _fake_create)
    monkeypatch.setattr(orch, "_llm_answer", _fail_answer)

    res = orch.AgentOrchestrator().chat(
        "PAT-A", "i have placed my wallet at my kitchen slab.", None)

    # stored ...
    assert saved.get("content"), "declaration must create a memory"
    assert "wallet" in saved["content"].lower()
    # ... confirmed, with an honest source label and NO random caregiver offer
    assert "saved" in res["response"].lower()
    assert "caretaker" not in res["response"].lower()
    assert res["suggest_caretaker_escalation"] is False
    assert res["sources"] == ["Long-term memory"]
    assert res["tools_used"] == ["save_to_memory"]


def test_wallet_question_with_no_similar_memory_offers_caretaker(monkeypatch):
    stored = _bypass_network(monkeypatch)
    monkeypatch.setattr(tools_impl, "search_patient_memories", lambda pid, q, k=5: [])
    monkeypatch.setattr(orch, "_llm_answer", _fail_answer)

    res = orch.AgentOrchestrator().chat("PAT-A", "where's is my wallet?", None)

    # honest miss + a REAL next step, wired into the yes/no escalation flow
    assert "couldn't find" in res["response"].lower()
    assert "ask your caretaker" in res["response"].lower()
    assert res["suggest_caretaker_escalation"] is True
    assert res["escalation_question"] == "where's is my wallet?"
    # never a random source label when nothing was found
    assert res["sources"] == []
    assert res["tools_used"] == ["search_patient_memories"]
    # the stored assistant message carries the escalation metadata
    last_asst = [m for m in stored if m["sender"] == "ASSISTANT"][-1]
    assert last_asst["metadata"]["suggest_caretaker_escalation"] is True
    assert last_asst["metadata"]["escalation_question"] == "where's is my wallet?"


def test_wallet_question_answered_from_relevant_memory(monkeypatch):
    _bypass_network(monkeypatch)
    monkeypatch.setattr(tools_impl, "search_patient_memories",
                        lambda pid, q, k=5: [_WALLET_ROW])
    monkeypatch.setattr(
        orch, "_llm_answer",
        lambda *a, **k: "I remember you said your wallet is on the kitchen slab!")

    res = orch.AgentOrchestrator().chat("PAT-A", "where is my wallet?", None)

    assert "kitchen slab" in res["response"].lower()
    assert res["sources"] == ["Long-term memory"]
    assert res["suggest_caretaker_escalation"] is False
