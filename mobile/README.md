# CogniCare Mobile (React Native + Expo)

A native mobile application for Android and iOS that provides cognitive assistance, memory retention scoring, medication schedules, and caregiver coordination for Alzheimer's / dementia patients and their caregivers.

Built as the mobile counterpart to the CogniCare web application, communicating with the existing FastAPI + Supabase backend.

---

## Prerequisites

- Node.js (v18+) & npm
- [Expo Go](https://expo.dev/go) on physical Android or iOS device, or Android Studio / Xcode emulators
- Existing CogniCare FastAPI backend running

---

## Getting Started

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Start the Expo development server:
   ```bash
   npm start
   # or
   npx expo start
   ```

3. Launch on your preferred platform:
   - **Android Emulator**: Press `a` in the terminal
   - **iOS Simulator**: Press `i` in the terminal
   - **Physical Device**: Scan the QR code displayed in the terminal using the **Expo Go** app on your phone.

---

## Backend Connectivity & Network Configuration

When running locally, your mobile device needs to reach your computer's FastAPI backend:

| Environment | Default API Base URL | Notes |
| :--- | :--- | :--- |
| **Android Emulator** | `http://10.0.2.2:8000` | Automatically configured by default. |
| **iOS Simulator** | `http://localhost:8000` | Automatically configured by default. |
| **Physical Phone (Expo Go)** | `http://<YOUR_LOCAL_IP>:8000` | Start backend with `--host 0.0.0.0`. You can configure the URL inside the app by tapping **"Backend Server URL"** on the Sign In screen, or by setting `EXPO_PUBLIC_API_URL` in `.env`. |

> **Tip for Physical Device Testing:** Run your backend like this so devices on your Wi-Fi can reach it:
> ```bash
> cd backend
> uvicorn main:app --host 0.0.0.0 --port 8000 --reload
> ```

---

## Feature Mapping & Architecture

### 1. Dual-Role Authentication
- **Caregiver Login**: Email + Password.
- **Caregiver Registration & Email Verification**: 6-digit verification code with resend capability.
- **Patient Login**: Auto-generated Patient ID (e.g., `PAT-1E0BB4`) + Password.
- **Security**: Tokens stored securely in platform-backed storage via `expo-secure-store`. Automatic session restoration on app launch.

### 2. Patient Experience (`app/(patient)`)
- **Dashboard (`/`)**: Daily medication progress track, large one-tap trigger for AI Assistant, upcoming reminders, recent memories, and emergency caregiver call button.
- **Daily Routine (`/routine`)**: Grouped time slots (Morning, Afternoon, Evening, Night) with tactile haptic check-offs.
- **AI Voice Assistant (`/assistant`)**: Conversational chat, tool execution indicators ("Checked medicine schedule", "Searched long-term memories"), photo attachment for medicine bottle OCR with verification against prescriptions.
- **Prescription Scanner (`/upload`)**: Native camera capture and document picker with fast OCR entity parsing.
- **Memory Timeline (`/memories`)**: Chronological grouping (Today, Yesterday, Earlier), semantic search, and retention badges.
- **Memory Insight (`/memories/[id]`)**: Full cognitive score factor visualization (Importance, Confidence, Usefulness, Persistence, Novelty).
- **Connected Caregiver (`/caregiver`)**: Caregiver contact details, direct telephone dialer (`tel:...`), and direct inquiry modal.

### 3. Caregiver Experience (`app/(caregiver)`)
- **Dashboard (`/`)**: Total patients, pending review counts, urgent inquiry metrics, and active patient selector.
- **My Patients (`/patients`)**: Linked patient cards, add patient dialog with automatic `PAT-` credential generation.
- **Patient Schedule (`/patients/[id]`)**: Manage patient daily reminders, dosages, and timings.
- **AI Activity & Audits (`/activity`)**: Daily AI summaries, audit conversation sessions, and approve/reject newly extracted memory candidates.
- **Prescription Scanner (`/upload`)**: Scan prescriptions for assigned patients and bulk-save to their routine.
- **Alerts & Inquiries (`/notifications`)**: Respond to patient questions; responses are automatically embedded into the patient's long-term memory.
