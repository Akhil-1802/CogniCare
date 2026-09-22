"""Tests for Caretaker notification escalation and response persistence."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agent.orchestrator import (
    _route_tools,
    _template_answer,
    _is_affirmation,
    _is_negation,
    _find_pending_escalation,
)
from routes.notifications import (
    create_inquiry_notification,
    _LOCAL_NOTIFICATIONS,
)


def test_belongings_and_appointments_routed_to_tools():
    tools = _route_tools("Where is my wallet?")
    assert "search_patient_memories" in tools

    tools_keys = _route_tools("Where are my glasses?")
    assert "search_patient_memories" in tools_keys

    tools_appt = _route_tools("Do I have any appointment with doctor?")
    assert "get_upcoming_appointments" in tools_appt


def test_missing_records_suggest_caretaker():
    # Empty memories for wallet query
    answer_wallet = _template_answer("Where is my wallet?", {"memories": []})
    assert "ask your caretaker" in answer_wallet.lower()
    assert "wallet" in answer_wallet.lower()

    # Empty appointments
    answer_appt = _template_answer("Do I have an appointment with doctor?", {"appointments": []})
    assert "ask your caretaker" in answer_appt.lower()

    # Empty medicine
    answer_med = _template_answer("What medicine do I take tonight?", {"medicines": []})
    assert "ask your caretaker" in answer_med.lower()


def test_affirmation_and_negation_detection():
    assert _is_affirmation("yes") is True
    assert _is_affirmation("Yes please") is True
    assert _is_affirmation("Sure, ask them") is True
    assert _is_affirmation("ask my caretaker") is True
    assert _is_affirmation("yeah") is True

    assert _is_negation("no") is True
    assert _is_negation("no thanks") is True
    assert _is_negation("No thank you") is True
    assert _is_negation("never mind") is True

    assert _is_affirmation("hello") is False
    assert _is_affirmation("where is my wallet") is False


def test_find_pending_escalation():
    history = [
        {"sender_type": "PATIENT", "content": "Where is my wallet?"},
        {
            "sender_type": "ASSISTANT",
            "content": "I don't have information about your wallet in your records. Would you like me to ask your caretaker regarding this?",
            "metadata": {"suggest_caretaker_escalation": True, "escalation_question": "Where is my wallet?"}
        },
        {"sender_type": "PATIENT", "content": "yes"}
    ]
    is_pending, question = _find_pending_escalation(history)
    assert is_pending is True
    assert "wallet" in question.lower()


def test_inquiry_notification_creation():
    notif = create_inquiry_notification(
        patient_id="PAT-TEST1",
        question="Where is my wallet?",
        category="belongings"
    )
    assert notif["id"].startswith("notif_")
    assert notif["status"] == "pending"
    assert notif["question"] == "Where is my wallet?"
    assert notif in _LOCAL_NOTIFICATIONS


def test_api_escalate_and_respond_flow(monkeypatch):
    from fastapi.testclient import TestClient
    from main import app
    from utils.auth import create_access_token

    client = TestClient(app)

    # Generate test tokens
    patient_token = create_access_token("PAT-100", "patient@test.com", "Patient")
    caretaker_token = create_access_token("CT-200", "caretaker@test.com", "CareTaker")

    # 1. Patient escalates question
    res = client.post(
        "/assistant/escalate",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={"question": "Where is my wallet?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "notification" in data
    notif_id = data["notification"]["id"]
    # Manually associate test caretaker
    for n in _LOCAL_NOTIFICATIONS:
        if n["id"] == notif_id:
            n["caretaker_id"] = "CT-200"

    # 2. Caretaker checks notifications
    res_ct = client.get(
        "/notifications/caretaker",
        headers={"Authorization": f"Bearer {caretaker_token}"}
    )
    assert res_ct.status_code == 200
    ct_notifs = res_ct.json()
    assert any(n["id"] == notif_id for n in ct_notifs)

    # 3. Caretaker responds
    res_resp = client.post(
        f"/notifications/{notif_id}/respond",
        headers={"Authorization": f"Bearer {caretaker_token}"},
        json={"response": "Your wallet is on the dining table next to the keys."}
    )
    assert res_resp.status_code == 200
    assert res_resp.json()["status"] == "answered"

    # 4. Patient checks notifications and sees the response
    res_pt = client.get(
        "/notifications/patient",
        headers={"Authorization": f"Bearer {patient_token}"}
    )
    assert res_pt.status_code == 200
    pt_notifs = res_pt.json()
    answered_item = next(n for n in pt_notifs if n["id"] == notif_id)
    assert answered_item["status"] == "answered"
    assert "dining table" in answered_item["response"]

