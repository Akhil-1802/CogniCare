-- CogniCare Patient Medical Documents Table
-- Run in Supabase SQL Editor if you wish to persist OCR documents directly in PostgreSQL.
-- The backend includes an automatic fallback cache so the app functions even before migration.

CREATE TABLE IF NOT EXISTS patient_documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  uploader_role TEXT NOT NULL CHECK (uploader_role IN ('Patient', 'CareTaker', 'Doctor', 'System')),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'prescription'
    CHECK (document_type IN ('prescription', 'medicine_packaging', 'lab_report', 'discharge_summary', 'other')),
  raw_ocr_text TEXT NOT NULL,
  structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_created
  ON patient_documents (patient_id, created_at DESC);
