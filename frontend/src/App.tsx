import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import AIAssistant from "@/pages/AIAssistant";
import UploadMedicine from "@/pages/UploadMedicine";
import MemoryTimeline from "@/pages/MemoryTimeline";
import MemoryDetails from "@/pages/MemoryDetails";
import ConnectedCaregiver from "@/pages/ConnectedCaregiver";
import NotificationFlow from "@/pages/NotificationFlow";
import CognitiveEngine from "@/pages/CognitiveEngine";
import CaregiverDashboard from "./pages/CareGiverDashboard";
import Auth from "./pages/Auth";
import Home from "./pages/Home";

function App() {
  
  return (
    <Routes>
      {/* Routes with AppLayout */}
      <Route
        element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        }
        path="/patientdashboard"
      />

      <Route
        element={
          <AppLayout>
            <AIAssistant />
          </AppLayout>
        }
        path="/assistant"
      />

      <Route
        element={
          <AppLayout>
            <UploadMedicine />
          </AppLayout>
        }
        path="/upload"
      />

      <Route
        element={
          <AppLayout>
            <MemoryTimeline />
          </AppLayout>
        }
        path="/timeline"
      />

      <Route
        element={
          <AppLayout>
            <MemoryDetails />
          </AppLayout>
        }
        path="/memory/:id"
      />

      <Route
        element={
          <AppLayout>
            <ConnectedCaregiver />
          </AppLayout>
        }
        path="/caregiver"
      />

      <Route
        element={
          <AppLayout>
            <NotificationFlow />
          </AppLayout>
        }
        path="/notifications"
      />

      <Route
        element={
          <AppLayout>
            <CognitiveEngine />
          </AppLayout>
        }
        path="/engine"
      />

      {/* No layout */}
      <Route
        path="/caregiverdashboard"
        element={<CaregiverDashboard />}
      />
      <Route path="/auth" element={<Auth/>} />
      <Route
        path="/"
        element={<Home />}
      />
    </Routes>
  );
}

export default App;
