-- CogniCare Memory Scoring & Retention System Migration
-- Run this in Supabase SQL Editor if the memories table already exists.

ALTER TABLE memories ADD COLUMN IF NOT EXISTS importance_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS usefulness_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS persistence_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS novelty_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS total_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS retention_policy TEXT NOT NULL DEFAULT 'STANDARD_MEMORY';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE memories ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source_message_id TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- Update status constraint to include EXPIRED
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_status_check;
ALTER TABLE memories ADD CONSTRAINT memories_status_check
  CHECK (status IN ('ACTIVE','PENDING_VALIDATION','REJECTED','ARCHIVED','EXPIRED'));

-- New indexes for retention filtering and fast lookup
CREATE INDEX IF NOT EXISTS idx_memories_patient_status_expires
  ON memories (patient_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_memories_expires_at
  ON memories (expires_at);
CREATE INDEX IF NOT EXISTS idx_memories_created_at
  ON memories (created_at DESC);
