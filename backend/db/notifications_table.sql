-- CogniCare Notifications Table
-- Run this in the Supabase SQL Editor.
-- This table tracks questions escalated from the AI Assistant to the Caretaker,
-- along with Caretaker responses that get saved to long-term memory.

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caretaker_id TEXT NOT NULL REFERENCES caretakers(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'caregiver_inquiry' 
    CHECK (type IN ('caregiver_inquiry', 'inquiry_response', 'reminder_alert', 'general')),
  question TEXT NOT NULL,
  response TEXT,
  category TEXT DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'answered', 'dismissed')),
  patient_read BOOLEAN NOT NULL DEFAULT FALSE,
  caretaker_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_patient
  ON notifications (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_caretaker
  ON notifications (caretaker_id, status, created_at DESC);
