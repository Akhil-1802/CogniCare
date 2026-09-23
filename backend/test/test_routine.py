"""Tests for patient routine and appointment tracking, extraction, and deduplication."""
import sys
import os
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agent.orchestrator import (
    _route_tools,
    _template_answer,
    extract_routine_or_appointment,
)
from agent import tools_impl


def test_routine_and_appointment_tool_routing():
    # Appointment queries route to get_upcoming_appointments
    tools_appt = _route_tools("What's my appointment today?")
    assert "get_upcoming_appointments" in tools_appt

    tools_doc = _route_tools("Do I have any appointment with Dr. Sharma?")
    assert "get_upcoming_appointments" in tools_doc

    # Routine & schedule queries route to get_patient_routine
    tools_routine = _route_tools("What is my routine today?")
    assert "get_patient_routine" in tools_routine

    tools_sched = _route_tools("Can you tell me my daily schedule?")
    assert "get_patient_routine" in tools_sched

    # Pure chit chat routes to no tools
    assert _route_tools("Hello, good morning") == []


def test_extract_routine_or_appointment():
    today_str = date.today().isoformat()

    # Pure inquiries without specifics should NOT create new items
    assert extract_routine_or_appointment("What's my appointment today?", today_str) is None
    assert extract_routine_or_appointment("What is my routine today?", today_str) is None
    assert extract_routine_or_appointment("Do I have any appointments?", today_str) is None

    # Specific appointments mentioned should be extracted cleanly
    item1 = extract_routine_or_appointment("I have a doctor appointment today at 3pm with Dr. Smith", today_str)
    assert item1 is not None
    assert item1["type"] == "appointment"
    assert "Dr. Smith" in item1["title"]
    assert item1["reminder_time"] == "15:00"
    assert item1["reminder_date"] == today_str

    # Inquiries that ALSO state an appointment
    item2 = extract_routine_or_appointment("What's my appointment today? It's Dr. John at 4:30 pm", today_str)
    assert item2 is not None
    assert item2["type"] == "appointment"
    assert "Dr. John" in item2["title"]
    assert item2["reminder_time"] == "16:30"

    # Routine activities like walk or exercise
    item3 = extract_routine_or_appointment("Add morning walk at 7:00 AM to my daily routine", today_str)
    assert item3 is not None
    assert item3["type"] == "general"
    assert "Walk" in item3["title"]
    assert item3["reminder_time"] == "07:00"

    # Medicine reminders
    item4 = extract_routine_or_appointment("Take blood pressure pill at 8pm", today_str)
    assert item4 is not None
    assert item4["type"] == "medicine"
    assert item4["reminder_time"] == "20:00"


def test_template_answer_routine():
    # Empty routine
    ans_empty = _template_answer("What is my routine today?", {"routine": []})
    assert "routine" in ans_empty.lower()
    assert "don't have any items scheduled" in ans_empty.lower() or "no activities" in ans_empty.lower()

    # Routine with items
    ans_filled = _template_answer("What is my routine today?", {
        "routine": [
            {"title": "Morning Walk", "type": "general", "reminder_time": "07:00:00"},
            {"title": "Dr. Smith Visit", "type": "appointment", "reminder_time": "15:00:00"},
        ]
    })
    assert "Morning Walk" in ans_filled
    assert "Dr. Smith Visit" in ans_filled
    assert "07:00" in ans_filled


def test_save_to_routine_deduplication(monkeypatch):
    class FakeTable:
        def __init__(self):
            self.rows = [
                {
                    "id": "existing_1",
                    "patient_id": "P_TEST",
                    "title": "Doctor Appointment with Dr. Smith",
                    "type": "appointment",
                    "reminder_date": "2026-09-23",
                    "reminder_time": "15:00:00",
                }
            ]

        def select(self, *a, **k):
            return self

        def eq(self, col, val):
            return self

        def insert(self, row):
            self.rows.append(row)
            return self

        def execute(self):
            class R:
                data = [
                    {
                        "id": "existing_1",
                        "patient_id": "P_TEST",
                        "title": "Doctor Appointment with Dr. Smith",
                        "type": "appointment",
                        "reminder_date": "2026-09-23",
                        "reminder_time": "15:00:00",
                    }
                ]
            return R()

    monkeypatch.setattr(tools_impl.supabase, "table", lambda name="": FakeTable())

    # Should detect existing duplicate and return it without error
    res = tools_impl.save_to_routine("P_TEST", {
        "title": "Doctor Appointment with Dr. Smith",
        "type": "appointment",
        "reminder_date": "2026-09-23",
        "reminder_time": "15:00",
    })
    assert res["id"] == "existing_1"
