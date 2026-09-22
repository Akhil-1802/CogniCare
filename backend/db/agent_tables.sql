-- CogniCare AI Assistant tables. Run in Supabase SQL Editor.
-- PostgreSQL is the source of truth. ChromaDB is only a semantic index.

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_patient_created
  ON conversations (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('PATIENT', 'ASSISTANT', 'SYSTEM', 'TOOL')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tool_name TEXT,
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'IMPORTANT_FACT'
    CHECK (memory_type IN ('PERSON','RELATIONSHIP','EVENT','APPOINTMENT','MEDICINE','PREFERENCE','IMPORTANT_FACT','DAILY_ACTIVITY')),
  importance TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (importance IN ('LOW','MEDIUM','HIGH')),
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source_type TEXT,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','PENDING_VALIDATION','REJECTED','ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_memories_patient_type
  ON memories (patient_id, memory_type, status);

CREATE TABLE IF NOT EXISTS daily_ai_summaries (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  important_events JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, date)
);
