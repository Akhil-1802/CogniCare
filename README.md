# CogniCare

AI-powered cognitive memory assistant designed for individuals with Mild Cognitive Impairment (MCI) and early-stage Alzheimer's disease. CogniCare helps patients remember conversations, medicines, appointments, daily belongings (e.g., wallet, glasses), and important memories, while enabling CareTakers to validate memories, answer escalated patient inquiries, and manage care schedules.

---

## Tech Stack

- **Backend:** FastAPI (Python), Supabase (PostgreSQL), LangChain, Mistral AI, ChromaDB (Vector Store), JWT Auth, SMTP
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons

---

## Project Structure

```
CogniCare/
├── backend/
│   ├── agent/           # AI orchestrator, LLM planner, memory extraction, vectorstore
│   ├── config/          # Environment settings
│   ├── db/              # Supabase client & SQL migration schemas
│   │   ├── agent_tables.sql          # Conversations, messages, memories, daily summaries
│   │   ├── reminders_table.sql       # Medicine, appointment, general reminders
│   │   └── notifications_table.sql   # Caretaker escalation & response notifications
│   ├── routes/          # API routers (auth, patient_auth, reminders, assistant, caretaker_ai, notifications)
│   ├── utils/           # JWT authentication, cookies, password hashing, email service
│   ├── test/            # Pytest test suite
│   ├── main.py          # FastAPI application entry point
│   └── requirements.txt # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/  # Layouts (AppLayout, CareTakerLayout) and UI components
│   │   ├── contexts/    # AuthContext (CareTaker and Patient authentication state)
│   │   ├── pages/       # Patient & Caregiver views (AIAssistant, CaregiverNotifications, Dashboard, etc.)
│   │   ├── lib/         # Axios API client, assistant, reminders, and notifications services
│   │   ├── types/       # TypeScript types
│   │   └── data/        # Mock data & sample questions
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

2. **Reminders Table:**
   - Execute the SQL from [`backend/db/reminders_table.sql`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/db/reminders_table.sql).

3. **AI Agent & Memory Tables:**
   - Execute the SQL from [`backend/db/agent_tables.sql`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/db/agent_tables.sql).

4. **Notifications Table (CareTaker Escalation Flow):**
   - Execute the SQL from [`backend/db/notifications_table.sql`](file:///c:/Users/parah/OneDrive/Desktop/Akhil/CogniCare/backend/db/notifications_table.sql).

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

### 1. AI Assistant & Memory Search
- The patient can chat with CogniCare about medicines, upcoming appointments, reminders, and daily belongings (e.g., *"Where is my wallet?"*, *"Where are my glasses?"*).
- CogniCare retrieves records from PostgreSQL and performs semantic similarity search over ChromaDB embeddings.

### 2. Missing Information Escalation to CareTaker
- If the patient asks an informational question (e.g., *"Where is my wallet?"* or *"Do I have any appointment with doctor?"*) and the information is **not present in the database**, the AI assistant offers:
  > *"I don't have that information in your records. Would you like me to ask your caretaker regarding this?"*
- The patient can click the **[Yes, Ask Caretaker]** button or type *"yes"*.
- The question is escalated to the CareTaker as a pending notification.

### 3. CareTaker Response & Long-Term Memory Learning
- The CareTaker logs in and accesses the **Patient Inquiries** page (`/caregiver/notifications`).
- The CareTaker sees the patient's question and submits an answer (e.g., *"Your wallet is on the dining table next to the keys."*).
- **As soon as the CareTaker responds:**
  1. The answer is saved into the database `memories` table as an active memory and indexed into the Chroma vector database.
  2. The patient receives an answer notification in their **Notifications Center** (`/notifications`).
  3. The next time the patient asks the AI (*"Where is my wallet?"*), the assistant answers immediately from memory.

---

## Running Automated Tests

Run backend unit and integration tests using pytest:

```bash
cd backend
.\venv\Scripts\activate      # Windows
pytest
```
All 13 tests verify tool routing, missing info detection, affirmation detection, API escalation, and memory persistence.
