# CogniCare: AI-Powered Cognitive Memory & Care Assistant

CogniCare is an intelligent, dual-user cognitive assistive platform designed specifically for individuals living with Mild Cognitive Impairment (MCI) and early-stage Alzheimer’s disease, as well as their family members and professional caregivers.

The system helps patients preserve their independence by assisting them in remembering daily routines, medications, appointments, belongings, and cherished memories. Concurrently, it empowers caregivers with an oversight dashboard to audit conversational activity, validate extracted memories, resolve patient inquiries, and cross-reference medical prescriptions through high-speed OCR.

At the core of CogniCare is an enterprise-grade **Scoring-Based Memory Extraction and Retention Engine**. Rather than treating conversation logs as unstructured text, CogniCare decomposes patient statements into atomic, categorized facts, scores them across five weighted cognitive dimensions, enforces a strict confidence gate, automatically detects contradictions without destructive overwrites, and maintains dual-layer persistence (PostgreSQL as the authoritative source of truth and ChromaDB as a vector search index).

---

## Everything I Used (Technology Stack)

### Backend Architecture
* **Runtime & Framework:** Python 3.12, [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/) (High-performance asynchronous REST API)
* **AI & Orchestration:**
  * **[LangChain](https://www.langchain.com/):** Conversational agent orchestration and custom tool routing
  * **Mistral AI (`langchain-mistralai`):**
    * `mistral-medium-latest`: Primary LLM for empathetic conversational reasoning, clinical extraction, and daily summaries
    * `ministral-3b-latest`: Ultra-fast planner LLM dedicated to dynamic tool-routing with minimal latency
    * `mistral-embed`: 1024-dimensional semantic embedding model powering long-term vector retrieval
* **Databases & Vector Storage:**
  * **[Supabase](https://supabase.com/) (PostgreSQL):** Relational database storing user identities, care relationships, structured routines, audit trails, and memory states
  * **[ChromaDB](https://www.trychroma.com/):** Embedded vector store with patient-scoped collections for semantic memory retrieval
* **Document & Image Processing (OCR):**
  * **[RapidOCR](https://github.com/RapidAI/RapidOCR) (ONNX Runtime):** Sub-300ms offline OCR for pill bottles and prescriptions
  * **[PyMuPDF](https://pymupdf.readthedocs.io/) (`fitz`), Pillow, PyPDF:** PDF parsing and document image preprocessing
* **Security & Communications:**
  * **PyJWT:** Secure JSON Web Tokens with rotating access and refresh tokens
  * **Argon2 / Passlib / Bcrypt:** Cryptographic password hashing
  * **SMTP / Gmail:** Transactional 6-digit email verification for caregiver onboarding
* **Testing & Quality Assurance:**
  * **Pytest (53 Automated Tests):** Comprehensive unit, integration, and regression suites

### Web Frontend
* **Core:** React 18, TypeScript, [Vite](https://vitejs.dev/)
* **Styling & Animation:** Tailwind CSS, Framer Motion
* **UI Components & Icons:** Lucide React, Senior-friendly high-contrast components
* **Networking & State:** Axios (with automatic JWT refresh interceptor), React Context (`AuthContext`)

### Mobile Application
* **Framework:** React Native with [Expo SDK 58](https://expo.dev/) & Expo Router (File-based navigation)
* **Secure Storage:** `expo-secure-store` (Hardware-backed encrypted token storage)
* **Device Features:** `expo-image-picker`, `expo-document-picker`, `expo-haptics` (Tactile feedback for elderly motor support)
* **UI & Styling:** Lucide React Native, accessible high-contrast mobile design system

---

## How I Built It (System Architecture)

CogniCare was engineered with a separation of concerns across presentation, API routing, cognitive intelligence, and relational verification.

```mermaid
flowchart TD
    subgraph Clients["User Experience Layer"]
        WebPatient["Web Patient Portal (React 18)"]
        WebCare["Web Caregiver Portal (React 18)"]
        MobileApp["Mobile App (React Native / Expo)"]
    end

    subgraph Gateway["API & Security Layer (FastAPI)"]
        AuthMiddleware["JWT Auth & Role Enforcement"]
        RateLimiter["Session & Rate Gatekeeper"]
    end

    subgraph CoreServices["Application Services"]
        AgentEngine["Conversational Agent & Tool Planner"]
        ExtractionPipeline["Memory Extraction Pipeline"]
        ScoringEngine["5-Factor Scoring Engine"]
        OCRPipeline["RapidOCR Prescription Scanner"]
        RoutineService["Daily Schedule & Reminders"]
        EscalationService["Caregiver Notification Hub"]
    end

    subgraph StorageLayer["Dual-Storage & Vector Infrastructure"]
        Postgres[("Supabase PostgreSQL\n(Source of Truth)")]
        VectorDB[("ChromaDB\n(Patient-Scoped Vectors)")]
    end

    WebPatient --> AuthMiddleware
    WebCare --> AuthMiddleware
    MobileApp --> AuthMiddleware

    AuthMiddleware --> AgentEngine
    AuthMiddleware --> RoutineService
    AuthMiddleware --> EscalationService
    AuthMiddleware --> OCRPipeline

    AgentEngine --> ExtractionPipeline
    ExtractionPipeline --> ScoringEngine
    ScoringEngine --> Postgres
    ScoringEngine -.->|Sync Active Embeddings| VectorDB
    AgentEngine -.->|Semantic Search (Distance <= 0.30)| VectorDB
```

### 1. Dual-User Experience Paradigm
* **The Patient Experience:** Designed specifically for cognitive accessibility:
  * High-contrast visual hierarchy, large tap targets, and reassuring tone.
  * Direct access to **Today's Routine** with time-grouped slots (Morning, Afternoon, Evening, Night).
  * AI assistant with real-time feedback badges showing actions taken (e.g., *"Checked routine"*, *"Searched memory"*).
  * Medicine bottle camera scanner with instantaneous safety verification.
  * One-tap emergency contact calling directly into the caregiver's phone.
* **The Caregiver Experience:** Built for oversight without caregiver fatigue:
  * Multi-patient roster management with auto-generated credentials (`PAT-XXXXXX`).
  * **AI Activity & Audit Center:** Inspect daily conversation summaries and audit newly extracted memory candidates.
  * **Memory Candidate Validation:** Approve, edit, or reject memories awaiting review.
  * **Caregiver Notification Hub:** Immediate escalation alerts when a patient asks about missing items or unverified medications. Caregiver answers teach the AI instantly.

### 2. Dual-Layer Storage Pattern
* **Relational PostgreSQL (Supabase) is the authoritative Source of Truth (SSOT).** All memories, scores, retention policies, expiration dates, and relationships live here.
* **ChromaDB is a derived search index.** Only verified and active memories are vectorized using `mistral-embed`. Every vector is partitioned with a mandatory `patient_id` metadata filter to guarantee strict multi-tenant isolation.
* If a memory is rejected, expired, or soft-deleted, it is immediately expunged from ChromaDB, preventing hallucinated or stale recollections.

### 3. Local High-Speed OCR Pipeline
Prescription bottles and doctor notes are parsed in <300ms using local ONNX-accelerated RapidOCR:
1. Uploaded images or PDFs are normalized and fed into the OCR engine.
2. The extracted text is parsed for drug names, dosages, and administration frequencies.
3. The results are cross-referenced against the patient’s existing medical documents and prescription table:
   * **Verified Record:** The AI confirms the dosage and time according to doctor orders.
   * **Unverified Record:** The AI cautions the patient and offers to alert the caregiver.

---

## Deep Dive: How Memory Extraction Works

Elderly patients with memory loss often mention critical personal facts, family visits, medication updates, or daily preferences in passing conversation. Storing raw chat logs causes conversational drift, token bloat, and conflicting recollections. CogniCare solves this with a 7-stage deterministic memory pipeline.

```mermaid
flowchart LR
    A["Patient Message"] --> B["1. Atomic Fact Extraction\n(Mistral Medium)"]
    B --> C["2. Date & Entity Resolution\n(Timezone Aware)"]
    C --> D["3. 5-Factor Weighted Scoring\n(0 - 100 Scale)"]
    D --> E{"4. Confidence Gate\n(Min >= 0.70)"}
    E -->|Pass| F{"5. Threshold Decision"}
    E -->|Fail (< 0.70)| G["Status: PENDING_VALIDATION\n(Awaiting Caregiver)"]
    F -->|Score < 40| H["Decision: DISCARD\n(Ephemeral Chat)"]
    F -->|40 - 59| I["TEMPORARY (7 Days)"]
    F -->|60 - 79| J["STANDARD (30 Days)"]
    F -->|80 - 100| K["LONG_TERM (90 Days)"]
    I & J & K --> L["6. Deduplication & Conflict Detection"]
    L -->|Duplicate| M["Touch last_confirmed_at"]
    L -->|Conflict| G
    L -->|New Fact| N["7. Dual Storage\nPostgres + ChromaDB"]
```

### Stage 1: Atomic Fact Decomposition (`backend/agent/extraction.py`)
A single conversational sentence can contain multiple independent facts. CogniCare breaks compound messages into structured Pydantic candidate objects (`ExtractedFactCandidate`).

* **Example input:** *"My daughter Emily is visiting me next Sunday, and I prefer to take my blood pressure medicine after lunch."*
* **Decomposed candidates:**
  1. **Candidate A (`EVENT`):** Daughter Emily visiting next Sunday.
  2. **Candidate B (`MEDICINE` / `PREFERENCE`):** Blood pressure medication taken after lunch.

The extraction engine classifies each candidate into one of 8 standardized memory categories:
`PERSON`, `RELATIONSHIP`, `EVENT`, `APPOINTMENT`, `MEDICINE`, `PREFERENCE`, `IMPORTANT_FACT`, `DAILY_ACTIVITY`.

### Stage 2: Timezone-Aware Date Resolution (`backend/agent/date_resolver.py`)
Relative temporal expressions (e.g., *"tomorrow at 3 PM"*, *"next Friday"*, *"in three days"*) are resolved into deterministic UTC timestamps based on the patient's local timezone. The system computes both the exact `event_date` and an expiration timestamp with a tailored grace period (e.g., 1 day post-event for family visits, 2 days post-appointment for doctor consultations).

### Stage 3: The 5-Factor Weighted Scoring Engine (`backend/agent/scoring_service.py`)
Every extracted candidate is evaluated across five weighted factors producing a deterministic score from $0$ to $100$:

$$\text{Total Score} = (I \times 0.30) + (C \times 0.25) + (U \times 0.20) + (P \times 0.15) + (N \times 0.10)$$

| Factor | Weight | Purpose & Evaluation Criteria |
|---|:---:|---|
| **Importance ($I$)** | **30%** | Clinical criticality, safety, or primary relationships (e.g., spouse name = 95, medicine dosage = 90, casual comment = 20). |
| **Confidence ($C$)** | **25%** | Explicitness of statement, lack of ambiguity, and speech transcription reliability. Penalized when epistemic hedge words appear (*"maybe"*, *"I think"*, *"someone said"*). |
| **Future Usefulness ($U$)** | **20%** | Utility in answering future repetitive queries (e.g., *"Where are my keys?"*, *"What time do I walk?"*). |
| **Persistence ($P$)** | **15%** | Inherent longevity of the fact (e.g., lifelong family relationship vs. one-time grocery need). |
| **Novelty ($N$)** | **10%** | Uniqueness compared to existing records (new facts score 80-100; identical facts score low; updates score moderately). |

### Stage 4: Threshold Decision Routing (`backend/agent/decision_service.py`)
The total score assigns the baseline storage policy:

* **Score $< 40.0$ (`DISCARD`):** Ephemeral chatter (*"Nice weather"*, *"Good morning"*). The candidate is rejected and never stored.
* **Score $40.0 - 59.9$ (`TEMPORARY_MEMORY`):** Short-term items stored for **7 days** (default).
* **Score $60.0 - 79.9$ (`STANDARD_MEMORY`):** Contextual facts stored for **30 days** (default).
* **Score $80.0 - 100.0$ (`LONG_TERM_MEMORY`):** High-importance clinical, biographical, or relationship facts stored for **90 days** (renewable).

### Stage 5: Normalized Confidence Gate ($C \ge 0.70$)
Regardless of how high a total score is, the candidate must pass the **Normalized Confidence Gate**:
* If `confidence < 0.70` (or `requires_confirmation = True`), the memory is **forced into `PENDING_VALIDATION`**.
* The memory is recorded in PostgreSQL but **quarantined from ChromaDB**.
* It immediately appears on the Caregiver's **AI Activity** dashboard (`/caregiver/ai-activity`) for human review.

### Stage 6: Deduplication & Non-Destructive Conflict Resolution (`backend/agent/memory_service.py`)
Before inserting into the database, the candidate is queried against existing active memories in ChromaDB:
* **Exact Duplicate:** If the semantic distance is $< 0.15$ and entities match, the system updates `last_confirmed_at` and boosts confidence. No duplicate rows are created.
* **Semantic Contradiction:** If a contradiction is detected (e.g., *"My daughter Emily lives in Delhi"* vs. *"Emily moved to Mumbai"*), the system **never silently overwrites** existing records. The new statement is marked `PENDING_VALIDATION`, linked to the existing memory ID (`conflict_with_memory_id`), and surfaced to the caregiver to confirm the change.
* **New Fact:** Stored as `ACTIVE` and synchronized to ChromaDB.

### Stage 7: Relevance Decay & Semantic Retrieval Gating
When the AI assistant answers patient queries:
1. **Relevance Gate:** Extracted query embeddings are matched against ChromaDB with a strict cosine distance threshold:
   $$\text{Distance} \le 0.30$$
   Distances $> 0.30$ are rejected as unrelated to prevent hallucinated answers.
2. **Time-Decayed Relevance Ranking:** Stored memories decay over time using a half-life formula:
   $$R(t) = S_0 \cdot 2^{-t / H}$$
   * $H$ (Half-Life): `EVENT` (7 days), `MEDICINE` (30 days), `PREFERENCE` (60 days), `RELATIONSHIP` (60 days).
   * This guarantees that recent confirmations surface first without prematurely deleting long-term knowledge.
3. **Automated Expiration Daemon (`backend/agent/cleanup.py`):** A scheduled background worker checks records where `NOW() > expires_at`, updates their state to `EXPIRED`, and deletes them from ChromaDB.

---

## Project Structure

```
CogniCare/
├── backend/
│   ├── agent/                 # AI Orchestrator, memory scoring, vectorstore & tools
│   │   ├── extraction.py            # Multi-fact candidate extraction from messages
│   │   ├── scoring_service.py       # 5-factor weighted memory scoring engine (0-100)
│   │   ├── decision_service.py      # Threshold routing, confidence gate & retention decay
│   │   ├── date_resolver.py         # Timezone-aware relative date resolution
│   │   ├── memory_service.py        # Deduplication, conflict detection & ChromaDB sync
│   │   ├── vectorstore.py           # Patient-scoped ChromaDB collections & vector deletion
│   │   ├── orchestrator.py          # Conversational LangChain agent & background pipeline
│   │   ├── tools_impl.py            # Dynamic tools (routine, medicines, memories)
│   │   ├── cleanup.py               # Expiration daemon for expired memories
│   │   ├── schemas.py               # Pydantic validation schemas
│   │   └── llm.py                   # Central Mistral factory (Medium, Ministral 3B, Embed)
│   ├── config/                # Settings & memory parameter validators
│   ├── db/                    # Supabase client & SQL migration schemas
│   │   ├── agent_tables.sql         # Base tables (conversations, messages, memories)
│   │   ├── migrate_memory_scoring.sql # Migration for scoring & retention columns
│   │   ├── reminders_table.sql      # Daily routine & reminders table
│   │   ├── notifications_table.sql  # Caregiver inquiry notifications
│   │   └── documents_table.sql      # Medical documents & OCR records
│   ├── routes/                # FastAPI endpoint routers
│   │   ├── assistant.py             # Chat, chat-with-file, escalation
│   │   ├── caretaker_ai.py          # Caregiver memory validation & AI activity
│   │   ├── memories.py              # Memory CRUD, dry-run extraction, score inspection
│   │   ├── auth.py & patientAuth.py # Caregiver and patient authentication
│   │   ├── reminders.py             # Daily routine & reminder endpoints
│   │   ├── notifications.py         # Inquiry notifications
│   │   └── documents.py             # Prescription & document uploads
│   ├── services/              # Local RapidOCR service & record cross-referencing
│   ├── utils/                 # JWT authentication, cookies, email verification
│   ├── test/                  # Pytest test suite (53 tests)
│   │   ├── test_memory_scoring.py   # 30 unit & integration tests for memory system
│   │   └── ...
│   ├── main.py                # FastAPI entry point
│   └── requirements.txt       # Python dependencies
├── frontend/                  # React 18 + Vite + Tailwind CSS Web Application
│   ├── src/
│   │   ├── components/        # Layouts, Senior-accessible UI cards, Navbars
│   │   ├── contexts/          # AuthContext (Caregiver & Patient state)
│   │   ├── pages/             # Web views (AIAssistant, Routine, Caregiver AI Activity, etc.)
│   │   └── lib/               # Axios API client, helper services
│   ├── package.json
│   └── vite.config.ts
├── mobile/                    # React Native + Expo Native Application (iOS & Android)
│   ├── app/                   # Expo Router file-based screens
│   │   ├── (auth)/            # Login, Register, Verify screens
│   │   ├── (patient)/         # Patient Dashboard, Routine, Assistant, Memories
│   │   └── (caregiver)/       # Caregiver Dashboard, Roster, AI Activity, Notifications
│   ├── src/                   # Secure storage, theme, API clients, and tactile UI
│   ├── package.json
│   └── app.json
└── README.md
```

---

## Step-by-Step Setup & Running Guide

### 1. Prerequisites
* **Python 3.11 or 3.12**
* **Node.js 18+** & **npm**
* A **Supabase account** with an active PostgreSQL project
* A **Mistral AI API Key** (from [console.mistral.ai](https://console.mistral.ai))
* For mobile: [Expo Go](https://expo.dev/go) on a physical mobile device, or Android Studio / Xcode

---

### 2. Database Setup (Supabase SQL Editor)
Run the following SQL files located in `backend/db/` inside your Supabase SQL Editor:

1. **Authentication & User Tables:**
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
2. **Routine & Reminders:** Run [`backend/db/reminders_table.sql`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/db/reminders_table.sql)
3. **AI Agent & Memory System:** Run [`backend/db/agent_tables.sql`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/db/agent_tables.sql)
4. **Scoring & Retention Migration:** Run [`backend/db/migrate_memory_scoring.sql`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/db/migrate_memory_scoring.sql)
5. **Caregiver Notifications:** Run [`backend/db/notifications_table.sql`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/db/notifications_table.sql)
6. **Medical Documents & OCR:** Run [`backend/db/documents_table.sql`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/db/documents_table.sql)

---

### 3. Backend Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   * **Windows:**
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   * **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create `backend/.env` (see [`backend/.env.sample`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/.env.sample)):
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-service-or-anon-key

   # LLM: Mistral AI (Chat, Planner & Embeddings)
   MISTRAL_API_KEY=your_mistral_api_key
   MISTRAL_MODEL=mistral-medium-latest
   MISTRAL_EMBED_MODEL=mistral-embed
   MISTRAL_PLANNER_MODEL=ministral-3b-latest
   MISTRAL_TEMPERATURE=0.2
   MISTRAL_MAX_TOKENS=800
   MISTRAL_TIMEOUT=60

   # Security & Verification
   JWT_SECRET=your_32_byte_random_secret
   JWT_REFRESH_SECRET=your_different_32_byte_secret
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=your_app_password

   # Memory Scoring Engine Defaults
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
   ```
5. Start the backend server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   Interactive API Docs: `http://localhost:8000/docs`

---

### 4. Web Frontend Setup
1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Web App is live at: `http://localhost:5173`

---

### 5. Mobile App Setup (React Native + Expo)
1. Navigate to the `mobile/` directory:
   ```bash
   cd mobile
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure `mobile/.env`:
   ```env
   # Leave blank or point to your backend local network IP for physical devices:
   EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:8000
   ```
4. Start the Expo development bundler:
   ```bash
   npx expo start
   ```
   * Press `a` for Android Emulator.
   * Press `i` for iOS Simulator.
   * Scan the terminal QR code with **Expo Go** on a physical phone connected to the same Wi-Fi network.

---

## Testing Credentials

| Role | Username / Identifier | Password | Access Capabilities |
|---|---|---|---|
| **Caregiver** | `akhilmaindola18@gmail.com` | `12345678` | Full patient roster, AI validation dashboard, prescription uploads, inquiry inbox |
| **Patient** | `PAT-E28CB4` | `m-pMiR5dl98` | Daily routine, conversational assistant, medicine safety checker, memories timeline |

---

## Memory REST API Reference

All memory endpoints enforce authenticated ownership (`patient_id` matches current patient, or caller is their registered caregiver):

| Method | Endpoint | Description |
|:---:|---|---|
| `POST` | `/api/v1/memories/extract` | Extract and score candidates from text (supports dry-run or persistence) |
| `GET` | `/api/v1/memories` | List active memories with decay relevance ranking |
| `GET` | `/api/v1/memories/{memory_id}` | Retrieve memory details and metadata |
| `GET` | `/api/v1/memories/search?q={query}` | Semantic search in ChromaDB filtered strictly by `patient_id` |
| `GET` | `/api/v1/memories/{memory_id}/score` | Inspect 5-factor scoring breakdown, weights, and decision reasons |
| `PATCH`| `/api/v1/memories/{memory_id}` | Edit or manually reconfirm a memory |
| `DELETE`| `/api/v1/memories/{memory_id}`| Soft-delete memory in PostgreSQL and delete vector from ChromaDB |
| `GET` | `/caretaker/patients/{patient_id}/memories/pending` | Caregiver pending validation queue |
| `POST`| `/caretaker/memories/{memory_id}/validate` | Caregiver approval (`ACTIVE`) or rejection (`REJECTED`) with optional edits |

---

## Automated Verification & Test Suite

CogniCare includes 53 comprehensive unit and integration tests verifying every component of the system:

```bash
cd backend
.\venv\Scripts\activate      # Windows (or source venv/bin/activate on macOS/Linux)
pytest
```

```
============================= test session starts =============================
platform win32 -- Python 3.12.5, pytest-9.1.1, pluggy-1.6.0
collected 53 items

backend\test\test_memory_scoring.py ..............................       [ 56%]
backend\test\test_agent.py ........                                      [ 71%]
backend\test\test_routine.py .....                                       [ 81%]
backend\test\test_notifications.py .....                                 [ 90%]
backend\test\test_ocr_and_records.py .....                               [100%]

============================== 53 passed in 26.24s =============================
```

* **Memory Scoring & Retention (`test_memory_scoring.py` - 30 tests):** Weighted factor calculation bounds, threshold decisions, multi-fact extraction, speech uncertainty handling, event grace periods, duplicate protection, non-destructive conflict handling, patient-scoped vector isolation, and caregiver review.
* **Agent Orchestrator (`test_agent.py`):** Dynamic tool-routing, fallback answering, tool parameter scoping, and chat retention.
* **Routine & Reminders (`test_routine.py`):** Schedule extraction, daily routine completion toggles, and deduplication.
* **Notifications & Escalation (`test_notifications.py`):** Patient-to-caregiver question routing, affirmative answering, and vector persistence.
* **OCR & Prescription Pipeline (`test_ocr_and_records.py`):** High-speed document OCR and cross-referencing against verified prescriptions.

---

## Disclaimer

CogniCare is an assistive information and memory support tool designed to aid individuals and their caregivers. **It does not provide medical diagnosis, treatment, or professional clinical advice.** Always consult a qualified medical professional for medication and diagnostic inquiries.
