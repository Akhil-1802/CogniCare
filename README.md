# CogniCare

AI-powered cognitive memory assistant designed for individuals with Mild Cognitive Impairment (MCI) and early-stage Alzheimer's disease. CogniCare helps patients remember daily routines, medicines, doctor appointments, belongings (e.g., wallet, glasses), and important memories, while enabling CareTakers to validate memories, answer escalated patient inquiries, upload medical records, and manage care schedules.

The system features an enterprise-grade **Scoring-Based Memory Extraction and Retention System** that prevents conversational clutter, extracts individual structured facts, scores them across 5 weighted factors, routes them through a normalized confidence gate, assigns category-specific retention, detects conflicts without silent overwrites, and synchronizes semantic embeddings to ChromaDB while keeping PostgreSQL as the sole source of truth.

---

## Tech Stack

- **Backend:** FastAPI (Python), Supabase (PostgreSQL), LangChain, Mistral AI, ChromaDB (Vector Store), PyMuPDF, Pillow, RapidOCR, JWT Auth, SMTP
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons

---

## Project Structure

```
CogniCare/
├── backend/
│   ├── agent/                 # AI orchestrator, LLM planner, memory extraction, vectorstore, tools
│   │   ├── scoring_service.py       # 5-factor weighted memory scoring engine (0-100)
│   │   ├── decision_service.py      # Threshold routing, confidence gate, category retention & decay
│   │   ├── date_resolver.py         # Timezone-aware relative date resolution
│   │   ├── memory_service.py        # Deduplication, conflict detection, ChromaDB sync & CRUD
│   │   ├── extraction.py            # Multi-fact candidate extraction from compound messages
│   │   ├── vectorstore.py           # Patient-scoped ChromaDB semantic index & deletion
│   │   ├── cleanup.py               # Chat & memory expiration workers
│   │   ├── orchestrator.py          # Conversational agent & background extraction pipeline
│   │   ├── schemas.py               # Pydantic validation schemas
│   │   ├── tools_impl.py            # Tool implementations (medicines, routine, verified memories)
│   │   └── llm.py                   # Dynamic Mistral integration with offline fallbacks
│   ├── config/                # Environment settings & configuration validators
│   ├── db/                    # Supabase client & SQL migration schemas
│   │   ├── agent_tables.sql         # Base agent schema (conversations, messages, memories, daily summaries)
│   │   ├── migrate_memory_scoring.sql # Idempotent migration for scoring & retention fields
│   │   ├── reminders_table.sql      # Medicine, appointment, general routine reminders
│   │   ├── notifications_table.sql  # Caretaker escalation & response notifications
│   │   └── documents_table.sql      # Patient medical documents & OCR records
│   ├── routes/                # API routers
│   │   ├── memories.py              # /api/v1/memories CRUD, extraction dry-run, search & score inspect
│   │   ├── assistant.py             # Chat, chat-with-file, escalation, conversations
│   │   ├── caretaker_ai.py          # Caregiver validation, pending memories, AI activity
│   │   ├── auth.py & patientAuth.py # Caregiver and patient authentication
│   │   ├── reminders.py             # Routine & reminders management
│   │   ├── notifications.py         # Inquiry notifications
│   │   └── documents.py             # Document & prescription uploads
│   ├── services/              # Local OCR service & medical record cross-referencing
│   ├── utils/                 # JWT authentication, cookies, password hashing, email service
│   ├── test/                  # Pytest test suite (53 tests: memory scoring, agent, routine, OCR, auth)
│   │   ├── test_memory_scoring.py   # 30 comprehensive unit & integration tests for memory system
│   │   └── ...
│   ├── main.py                # FastAPI application entry point
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/        # Layouts (AppLayout, CareTakerLayout) and UI components
│   │   ├── contexts/          # AuthContext (CareTaker and Patient authentication state)
│   │   ├── pages/             # Patient & Caregiver views:
│   │   │   ├── AIAssistant.tsx            # AI Chat with OCR upload & routine confirmation
│   │   │   ├── PatientRoutine.tsx         # Dedicated daily routine & appointment manager
│   │   │   ├── Dashboard.tsx              # Patient dashboard with live today's routine
│   │   │   ├── CareGiverDashboard.tsx     # Caregiver dashboard & patient stats
│   │   │   ├── CaretakerAiActivity.tsx    # Caregiver pending memory validation with score inspection
│   │   │   ├── MyPatients.tsx             # Caregiver patient reminder & routine manager
│   │   │   ├── CaregiverNotifications.tsx # Caregiver inquiry response center
│   │   │   └── UploadMedicine.tsx         # Prescription upload & OCR extraction
│   │   ├── lib/               # Axios API client, assistant, reminders, and notifications services
│   │   ├── types/             # TypeScript types
│   │   └── data/              # Mock data & sample questions
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## Prerequisites

Before running the project, ensure you have:
- **Python 3.10+** (recommended: Python 3.11 or 3.12)
- **Node.js 18+** & **npm**
- A **Supabase account** with a PostgreSQL project
- A **Mistral AI API Key** (from [console.mistral.ai](https://console.mistral.ai))

---

## How to Run the Project

### 1. Database Setup (Supabase)

Open your Supabase project dashboard, navigate to the **SQL Editor**, and run the database setup scripts:

1. **Base Tables & Authentication:**
   ```sql
   CREATE TABLE IF NOT EXISTS caretakers (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT UNIQUE NOT NULL,
     password TEXT NOT NULL,
     phone TEXT NOT NULL,
     is_verified BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS patients (
     id TEXT PRIMARY KEY,
     caretaker_id TEXT REFERENCES caretakers(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     phone TEXT NOT NULL,
     location TEXT NOT NULL,
     password TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS email_verifications (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL,
     code TEXT NOT NULL,
     expires_at TIMESTAMPTZ NOT NULL,
     used BOOLEAN DEFAULT FALSE
   );

   CREATE TABLE IF NOT EXISTS refresh_tokens (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     token TEXT NOT NULL,
     expires_at TIMESTAMPTZ NOT NULL
   );
   ```

2. **Reminders & Routine Table:**
   - Execute [`backend/db/reminders_table.sql`](backend/db/reminders_table.sql).

3. **AI Agent & Memory Tables:**
   - Execute [`backend/db/agent_tables.sql`](backend/db/agent_tables.sql).
   - If migrating an existing database, run [`backend/db/migrate_memory_scoring.sql`](backend/db/migrate_memory_scoring.sql) to add the memory scoring and retention columns.

4. **Notifications Table (CareTaker Escalation Flow):**
   - Execute [`backend/db/notifications_table.sql`](backend/db/notifications_table.sql).

5. **Medical Documents Table (OCR & Prescriptions):**
   - Execute [`backend/db/documents_table.sql`](backend/db/documents_table.sql).

---

### 2. Backend Setup & Startup

1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows:**
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   - Copy the sample file to `.env`:
     ```bash
     cp .env.sample .env
     ```
   - Fill in your values:
     ```env
     # Supabase
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_KEY=your-supabase-anon-key

     # JWT Secrets
     JWT_SECRET=your_64_hex_char_jwt_secret
     JWT_REFRESH_SECRET=your_64_hex_char_jwt_refresh_secret

     # SMTP Email Verification
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=your_email@gmail.com
     SMTP_PASSWORD=your_app_password

     # AI Assistant (Mistral AI)
     MISTRAL_API_KEY=your_mistral_api_key
     MISTRAL_MODEL=mistral-small-latest
     MISTRAL_EMBED_MODEL=mistral-embed
     MISTRAL_PLANNER_MODEL=ministral-3b-latest

     # Scoring-Based Memory Extraction & Retention System
     MEMORY_IMPORTANCE_WEIGHT=0.30
     MEMORY_CONFIDENCE_WEIGHT=0.25
     MEMORY_USEFULNESS_WEIGHT=0.20
     MEMORY_PERSISTENCE_WEIGHT=0.15
     MEMORY_NOVELTY_WEIGHT=0.10

     MEMORY_DISCARD_THRESHOLD=40.0
     MEMORY_TEMPORARY_THRESHOLD=60.0
     MEMORY_STANDARD_THRESHOLD=80.0

     MEMORY_MIN_CONFIDENCE=0.70

     MEMORY_TEMPORARY_RETENTION_DAYS=7
     MEMORY_STANDARD_RETENTION_DAYS=30
     MEMORY_LONG_TERM_RETENTION_DAYS=90

     MEMORY_CLEANUP_ENABLED=false
     ```

5. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend will be live at `http://localhost:8000`.
   Interactive Swagger documentation: `http://localhost:8000/docs`.

---

### 3. Frontend Setup & Startup

1. Open a separate terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will be live at `http://localhost:5173`.

---

## Testing Credentials

### CareTaker
- **Email:** `akhilmaindola18@gmail.com`
- **Password:** `12345678`

### Patient
- **Patient ID:** `PAT-E28CB4`
- **Password:** `m-pMiR5dl98`

---

## Key Features & Architecture

### 1. Scoring-Based Memory Extraction and Retention System

CogniCare follows the principle:
$$\text{Extract} \longrightarrow \text{Score} \longrightarrow \text{Validate} \longrightarrow \text{Decide} \longrightarrow \text{Store} \longrightarrow \text{Retrieve} \longrightarrow \text{Expire or Review}$$

#### A. Multi-Fact Candidate Extraction
- A single conversational message can contain multiple independent facts. Rather than storing entire chat messages as a single memory, the extraction engine breaks statements into atomic, categorized facts:
  - Categories: `PERSON`, `RELATIONSHIP`, `EVENT`, `APPOINTMENT`, `MEDICINE`, `PREFERENCE`, `IMPORTANT_FACT`, `DAILY_ACTIVITY`.
  - Example: *"My daughter Emily is visiting me next Sunday, and I prefer to take my evening walk at 6 PM"* produces:
    - **Candidate 1 (EVENT):** Emily's visit, resolved to upcoming Sunday, expires post-event.
    - **Candidate 2 (PREFERENCE):** Evening walk at 6 PM, 30-90 day retention.
- Resolves relative dates (`"tomorrow"`, `"next Sunday"`, `"in 3 days"`) with patient timezone awareness.
- Flags uncertain or vague statements with `requires_confirmation=True`.

#### B. 5-Factor Weighted Scoring Engine
Produces an overall score between $0$ and $100$:
$$\text{Total Score} = (\text{Importance} \times 0.30) + (\text{Confidence} \times 0.25) + (\text{Future Usefulness} \times 0.20) + (\text{Persistence} \times 0.15) + (\text{Novelty} \times 0.10)$$
- **Importance (30%):** Clinical, safety, or relationship importance.
- **Confidence (25%):** Explicitness, ambiguity penalty, and speech transcription reliability.
- **Future Usefulness (20%):** Reusability for future answers and daily assistance.
- **Persistence (15%):** Expected duration (lifelong relationship vs. one-time visit).
- **Novelty (10%):** Checks existing store (duplicate = low, contradiction/update = moderate, new fact = high).

#### C. Decision Routing & Thresholds
- **Score $< 40$ (`DISCARD`):** Casual chit-chat and greetings are discarded from long-term memory.
- **Score $40 - 59$ (`TEMPORARY_MEMORY`):** Stored for 7 days (default).
- **Score $60 - 79$ (`STANDARD_MEMORY`):** Stored for 30 days (default).
- **Score $80 - 100$ (`LONG_TERM_MEMORY`):** Stored for 90 days (default).

#### D. Normalized Confidence Gate
- Configured at `MEMORY_MIN_CONFIDENCE=0.70` ($0.0 - 1.0$).
- If normalized confidence $< 0.70$, the candidate is forced to `PENDING_VALIDATION` requiring caregiver review or patient clarification. High scores cannot bypass this gate.

#### E. Duplicate & Conflict Detection
- **Exact Duplicate:** Updates `last_confirmed_at` and confidence; prevents duplicate rows.
- **Conflict / Correction:** E.g., *"Emily lives in Delhi"* vs *"Emily moved to Mumbai"*. Contradictory statements are **never silently overwritten**. They are saved as `PENDING_VALIDATION` linked to the original memory for caregiver review.
- **New Fact:** Stored and indexed independently.

#### F. Expiration Worker & Time-Decayed Relevance
- **Relevance Decay:** $R(t) = S_0 \cdot 2^{-t/H}$ prioritizes fresh, frequently confirmed memories during semantic search without deleting data.
- **Expiration Worker:** `expire_outdated_memories()` scans for memories past `expires_at`, marks them `EXPIRED`, and removes them from ChromaDB. Structured medicine schedules and documents are protected.

#### G. Caregiver Validation Dashboard
- Caregivers can view pending memories with full 5-factor score breakdowns, confidence percentages, retention periods, and conversational context on the **AI Activity** page (`/caregiver/ai-activity`).
- Caregivers can **Approve** (activates memory & syncs to ChromaDB), **Edit**, or **Reject** (removes from vector store).

---

### 2. Automatic Routine & Appointment Tracking
- When a patient mentions an appointment or daily routine activity (e.g., *"I have a doctor appointment today at 3 PM with Dr. Smith"*):
  1. The AI Assistant automatically routes to `save_to_routine`.
  2. The schedule item is saved in PostgreSQL with automatic deduplication.
  3. The chat UI renders a **"Saved to Daily Routine"** visual confirmation card.

### 3. Dedicated Daily Routine Manager (`/routine`)
- High-contrast, senior-friendly interface:
  - Fast toggle between Today, Tomorrow, or custom calendar dates.
  - Category filters (*All*, *Appointments 📅*, *Medicines 💊*, *Activities 🏃‍♂️*).
  - One-tap task completion checkboxes.
  - Live **Today's Routine** widget directly on the Patient Dashboard (`/patientdashboard`).

### 4. High-Speed Medicine OCR & Prescription Verification
- Upload pill bottles, prescriptions, or documents in AI Chat (`/assistant`) or Document Upload (`/upload`).
- High-speed local OCR pipeline parses drug names, dosages, and frequencies in <300ms.
- Cross-references patient medical records:
  - **Verified:** Reassures the patient with doctor-prescribed dosage instructions.
  - **Unverified / Unknown:** Flags caution and offers one-click escalation to the caregiver.

### 5. Missing Information Escalation Flow
- When asked a question whose answer is absent from records (e.g., *"Where is my wallet?"*), the assistant offers:
  > *"I don't have that information in your records. Would you like me to ask your caretaker regarding this?"*
- Once escalated, the CareTaker responds via `/caregiver/notifications`. The response is saved as an active memory in PostgreSQL and vectorized in ChromaDB. Future patient questions are answered immediately.

---

## Memory REST API Endpoints

All endpoints enforce patient ownership and caregiver relationship authorization:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/memories/extract` | Extract and score memory candidates from text (dry-run or persist) |
| `GET` | `/api/v1/memories` | List active memories with decay relevance ranking |
| `GET` | `/api/v1/memories/{memory_id}` | Retrieve memory details |
| `GET` | `/api/v1/memories/search?q={query}` | Semantic search filtered strictly by patient ID |
| `GET` | `/api/v1/memories/{memory_id}/score` | Inspect 5-factor scoring breakdown, weights, and decision reasons |
| `PATCH`| `/api/v1/memories/{memory_id}` | Patient or Caregiver edit / reconfirmation |
| `DELETE`| `/api/v1/memories/{memory_id}`| Soft-delete memory (archives row and purges ChromaDB vector) |
| `GET` | `/caretaker/patients/{patient_id}/memories/pending` | Caregiver list of memories awaiting review |
| `POST`| `/caretaker/memories/{memory_id}/validate` | Caregiver validation (`ACTIVE` or `REJECTED`, optional edit) |

---

## Running Automated Tests

Run the full backend test suite using pytest:

```bash
cd backend
.\venv\Scripts\activate      # Windows (or source venv/bin/activate on Unix)
pytest
```

**All 53 automated unit and integration tests pass:**
- **Memory Scoring & Retention (`test_memory_scoring.py`):** 30 tests covering weighted calculation bounds, threshold decisions, multi-fact extraction, speech uncertainty, event grace periods, duplicate protection, non-destructive conflict handling, patient-scoped vector isolation, and caregiver review.
- **Agent Orchestrator (`test_agent.py`):** Planning, fallback answering, tool scoping, and chat retention.
- **Notifications & Escalation (`test_notifications.py`):** Caretaker inquiry flow, affirmative answering, and memory persistence.
- **Routine & Schedule (`test_routine.py`):** Routine parsing, completion toggles, and deduplication.
- **OCR & Document Verification (`test_ocr_and_records.py`, `test_integration_ocr_pipeline.py`):** High-speed OCR and prescription cross-referencing.

To run only the memory scoring test suite:
```bash
pytest test/test_memory_scoring.py
```

