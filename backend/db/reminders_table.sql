-- Run this in the Supabase SQL Editor
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caretaker_id TEXT NOT NULL REFERENCES caretakers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('medicine', 'appointment', 'general')),
  dosage TEXT,
  reminder_date DATE NOT NULL,
  reminder_time TIME NOT NULL,
  notes TEXT,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  done_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_patient_date
  ON reminders (patient_id, reminder_date, reminder_time);

CREATE INDEX IF NOT EXISTS idx_reminders_caretaker_date
  ON reminders (caretaker_id, reminder_date, reminder_time);
