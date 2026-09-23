import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { CareTakerLayout } from "@/components/layout/CareTakerLayout";
import Dashboard from "@/pages/Dashboard";
import AIAssistant from "@/pages/AIAssistant";
import UploadMedicine from "@/pages/UploadMedicine";
import MemoryTimeline from "@/pages/MemoryTimeline";
import MemoryDetails from "@/pages/MemoryDetails";
import ConnectedCareTaker from "@/pages/ConnectedCaregiver";
import NotificationFlow from "@/pages/NotificationFlow";
import CognitiveEngine from "@/pages/CognitiveEngine";
import CareTakerDashboard from "./pages/CareGiverDashboard";
import MyPatients from "./pages/MyPatients";
import CaretakerAiActivity from "./pages/CaretakerAiActivity";
import CaregiverNotifications from "./pages/CaregiverNotifications";
import Auth from "./pages/Auth";
import Home from "./pages/Home";

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">This section is coming soon.</p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />

      {/* Patient routes (AppLayout) */}
      <Route
        path="/patientdashboard"
        element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        }
      />
      <Route
        path="/assistant"
        element={
          <AppLayout>
            <AIAssistant />
          </AppLayout>
        }
      />
      <Route
        path="/upload"
        element={
          <AppLayout>
            <UploadMedicine />
          </AppLayout>
        }
      />
      <Route
        path="/timeline"
        element={
          <AppLayout>
            <MemoryTimeline />
          </AppLayout>
        }
      />
      <Route
        path="/memory/:id"
        element={
          <AppLayout>
            <MemoryDetails />
          </AppLayout>
        }
      />
      <Route
        path="/caregiver"
        element={
          <AppLayout>
            <ConnectedCareTaker />
          </AppLayout>
        }
      />
      <Route
        path="/notifications"
        element={
          <AppLayout>
            <NotificationFlow />
          </AppLayout>
        }
      />
      <Route
        path="/engine"
        element={
          <AppLayout>
            <CognitiveEngine />
          </AppLayout>
        }
      />

      {/* CareTaker routes (CareTakerLayout) */}
      <Route
        path="/caregiverdashboard"
        element={
          <CareTakerLayout>
            <CareTakerDashboard />
          </CareTakerLayout>
        }
      />
      <Route
        path="/caregiver/patients"
        element={
          <CareTakerLayout>
            <MyPatients />
          </CareTakerLayout>
        }
      />
      <Route
        path="/caregiver/upload-records"
        element={
          <CareTakerLayout>
            <UploadMedicine />
          </CareTakerLayout>
        }
      />
      <Route
        path="/caregiver/reminders"
        element={
          <CareTakerLayout>
            <MyPatients />
          </CareTakerLayout>
        }
      />
      <Route
        path="/caregiver/notifications"
        element={
          <CareTakerLayout>
            <CaregiverNotifications />
          </CareTakerLayout>
        }
      />
      <Route
        path="/caregiver/memory-requests"
        element={
          <CareTakerLayout>
            <ComingSoon title="Memory Requests" />
          </CareTakerLayout>
        }
      />
      <Route
        path="/caregiver/ai-activity"
        element={
          <CareTakerLayout>
            <CaretakerAiActivity />
          </CareTakerLayout>
        }
      />
    </Routes>
  );
}

export default App;
