# CogniCare

AI-powered cognitive memory assistant designed for individuals with Mild Cognitive Impairment (MCI) and early-stage Alzheimer's disease. CogniCare helps patients remember daily routines, medicines, doctor appointments, belongings (e.g., wallet, glasses), and important memories, while enabling CareTakers to validate memories, answer escalated patient inquiries, upload medical records, and manage care schedules.

---

## Tech Stack

- **Backend:** FastAPI (Python), Supabase (PostgreSQL), LangChain, Mistral AI, ChromaDB (Vector Store), PyMuPDF, Pillow, JWT Auth, SMTP
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons

---

## Project Structure

```
CogniCare/
├── backend/
│   ├── agent/                 # AI orchestrator, LLM planner, memory extraction, vectorstore, tools
│   ├── config/                # Environment settings
│   ├── db/                    # Supabase client & SQL migration schemas
│   │   ├── agent_tables.sql         # Conversations, messages, memories, daily summaries
│   │   ├── reminders_table.sql      # Medicine, appointment, general routine reminders
│   │   ├── notifications_table.sql  # Caretaker escalation & response notifications
│   │   └── documents_table.sql      # Patient medical documents & OCR records
│   ├── routes/                # API routers (auth, patient_auth, reminders, assistant, caretaker_ai, notifications, documents)
│   ├── services/              # Local OCR service & medical record cross-referencing
│   ├── utils/                 # JWT authentication, cookies, password hashing, email service
│   ├── test/                  # Pytest test suite (agent, routine, notifications, OCR pipeline)
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
- A **Supabase account** (free tier works) with a PostgreSQL project
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
   - Execute the SQL from [`backend/db/reminders_table.sql`](backend/db/reminders_table.sql).

3. **AI Agent & Memory Tables:**
   - Execute the SQL from [`backend/db/agent_tables.sql`](backend/db/agent_tables.sql).

4. **Notifications Table (CareTaker Escalation Flow):**
   - Execute the SQL from [`backend/db/notifications_table.sql`](backend/db/notifications_table.sql).

5. **Medical Documents Table (OCR & Prescriptions):**
   - Execute the SQL from [`backend/db/documents_table.sql`](backend/db/documents_table.sql).

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
   - Open `.env` and fill in your values:
     ```env
     # Supabase
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_KEY=your-supabase-anon-key

     # JWT Secrets (generate with: python -c "import secrets; print(secrets.token_hex(32))")
     JWT_SECRET=your_jwt_secret_here
     JWT_REFRESH_SECRET=your_jwt_refresh_secret_here

     # SMTP Email Verification (Gmail App Password or custom SMTP)
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=your_email@gmail.com
     SMTP_PASSWORD=your_app_password

     # AI Assistant (Mistral AI)
     MISTRAL_API_KEY=your_mistral_api_key
     MISTRAL_MODEL=mistral-small-latest
     MISTRAL_EMBED_MODEL=mistral-embed
     MISTRAL_PLANNER_MODEL=ministral-3b-latest
     ```

5. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend will be live at `http://localhost:8000`.
   Interactive Swagger API documentation: `http://localhost:8000/docs`.

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

You can use the following default test accounts or create your own:

### CareTaker
- **Email:** `akhilmaindola18@gmail.com`
- **Password:** `12345678`

### Patient
- **Patient ID:** `PAT-E28CB4`
- **Password:** `m-pMiR5dl98`

---

## Key Features & User Flows

### 1. Automatic Routine & Appointment Tracking (Conversation-to-Schedule)
- When a patient asks about their routine or appointments (e.g., *"What's my appointment today?"*, *"What is my routine today?"*), CogniCare queries live database records and provides a grounded, gentle summary.
- If the patient mentions, declares, or asks to save an appointment or day-to-day routine activity (e.g., *"I have a doctor appointment today at 3 PM with Dr. Smith"*, *"My routine is morning walk at 7:30 AM"*):
  1. The AI Assistant automatically extracts the event title, category (`appointment`, `medicine`, `general`), date, and 24-hour timestamp.
  2. The item is saved to the patient's routine schedule in PostgreSQL with automatic deduplication.
  3. The chat UI renders a prominent **"Saved to Daily Routine"** visual confirmation card with an instant link to the routine manager.

### 2. Dedicated Daily Routine Manager (`/routine`)
- An accessible, high-contrast interface designed specifically for elderly and MCI patients:
  - **Date Selector:** Quickly switch between Today, Tomorrow, or pick any calendar date.
  - **Category Tabs:** Filter between *All Items*, *Appointments 📅*, *Medicines 💊*, and *Daily Activities 🏃‍♂️*.
  - **Interactive Checkboxes:** One-tap toggle to mark tasks completed or pending.
  - **Add to Routine:** Manual modal allowing patients and caregivers to schedule activities anytime.
  - **Dashboard Widget:** Live **Today's Routine & Appointments** card right on the Patient Dashboard (`/patientdashboard`) displaying today's progress.

### 3. High-Speed Medicine OCR & Prescription Verification
- Patients and Caregivers can upload photos of medicines, pill packaging, or prescription documents directly in the AI Assistant (`/assistant`) or Document Upload (`/upload`).
- A local high-speed OCR pipeline extracts medication entities (name, dosage, frequency) in <300ms.
- Extracted medications are compared against active prescriptions in the patient's medical records:
  - **Verified:** Reassures the patient with dosage and instructions grounded in their doctor's prescription.
  - **Unverified / Unknown:** Warns the patient and automatically prompts to escalate to their CareTaker for review.

### 4. Missing Information Escalation to CareTaker
- If the patient asks an informational question (e.g., *"Where is my wallet?"* or *"Where are my glasses?"*) and the information is **not present in the database**, the AI assistant offers:
  > *"I don't have that information in your records. Would you like me to ask your caretaker regarding this?"*
- The patient can click the **[Yes, Ask Caretaker]** button or type *"yes"*.
- The question is escalated to the CareTaker as a pending notification.

### 5. CareTaker Response & Long-Term Memory Learning
- The CareTaker logs in and accesses the **Patient Inquiries** page (`/caregiver/notifications`).
- The CareTaker sees the patient's question and submits an answer (e.g., *"Your wallet is on the dining table next to the keys."*).
- **As soon as the CareTaker responds:**
  1. The answer is saved into the database `memories` table as an active memory and indexed into the Chroma vector database.
  2. The patient receives an answer notification in their **Notifications Center** (`/notifications`).
  3. The next time the patient asks the AI (*"Where is my wallet?"*), the assistant answers immediately from memory.

---

## Running Automated Tests

Run the full backend test suite using pytest:

```bash
cd backend
.\venv\Scripts\activate      # Windows (or source venv/bin/activate on Unix)
pytest
```

All 22 unit and integration tests verify:
- Agent planning, small-talk handling, and grounded template fallback
- Routine & appointment extraction, tool routing, and deduplication
- Caregiver notification escalation, affirmative intent parsing, and memory persistence
- Local document OCR extraction and medical record cross-referencing
