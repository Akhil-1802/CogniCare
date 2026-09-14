# CogniCare

AI-powered cognitive memory assistant designed for people with Mild Cognitive Impairment and early-stage Alzheimer's disease. It remembers conversations, medicine, appointments, and important information while enabling CareTakers to validate memories.

## Tech Stack

**Backend:** FastAPI, Supabase (PostgreSQL), JWT Auth, SMTP Email
**Frontend:** React, TypeScript, Vite, Tailwind CSS, Framer Motion

## Project Structure

```
CogniCare/
├── backend/
│   ├── config/          # Environment settings
│   ├── db/              # Supabase client
│   ├── routes/          # API routes (auth, patient auth)
│   ├── utils/           # JWT, password hashing, email service
│   ├── agent/           # AI agent (LangChain)
│   ├── main.py          # FastAPI entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/  # UI components + layouts
│   │   ├── contexts/    # AuthContext
│   │   ├── pages/       # All pages
│   │   ├── lib/         # Axios instance with interceptors
│   │   ├── types/       # TypeScript types
│   │   └── data/        # Mock data
│   └── package.json
└── README.md
```

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.sample .env          # Fill in your values
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8000`.

## Supabase Tables

Run these in the Supabase SQL Editor:

```sql
CREATE TABLE caretakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
);

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  caretaker_id TEXT REFERENCES caretakers(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ
);

CREATE TABLE email_verifications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
```

## Testing Credentials

### CareTaker

```
Email:    akhilmaindola18@gmail.com
Password: 12345678
```

### Patient

```
Patient ID: PAT-E28CB4
Password:   m-pMiR5dl98
```

## Auth Flow

- **CareTaker** registers with name, email, phone, password
- A verification code is sent to the email (SMTP)
- After verification, CareTaker can login
- CareTaker adds patients from the dashboard (sets name, phone, location, password)
- A random `PAT-XXXXXX` ID is generated for the patient
- **Patient** logs in with that ID + password

**Tokens:**
- Access token: 15 minutes, sent in `Authorization: Bearer <token>` header
- Refresh token: 7 days, stored in HttpOnly secure cookie
- Auto-refreshes when access token expires

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | CareTaker registration |
| POST | `/auth/verify-email` | Verify email with code |
| POST | `/auth/resend-code` | Resend verification code |
| POST | `/auth/login` | CareTaker login |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | CareTaker logout |
| GET | `/auth/me` | Get current CareTaker |
| GET | `/auth/patients` | Get CareTaker's patients |
| POST | `/patient-auth/add` | Add patient (CareTaker only) |
| POST | `/patient-auth/login` | Patient login |
| POST | `/patient-auth/refresh` | Refresh patient token |
| POST | `/patient-auth/logout` | Patient logout |
| GET | `/patient-auth/me` | Get current patient |
