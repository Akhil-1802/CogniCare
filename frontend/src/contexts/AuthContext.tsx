import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAccessToken } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
  location: string;
  caretaker_id: string;
}

interface AuthContextType {
  user: User | Patient | null;
  role: "CareTaker" | "Patient" | null;
  isLoading: boolean;
  patients: Patient[];
  login: (email: string, password: string) => Promise<{ role: string }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
  }) => Promise<void>;
  patientLogin: (patientId: string, password: string) => Promise<{ role: string }>;
  addPatient: (data: {
    name: string;
    phone: string;
    location: string;
    password: string;
  }) => Promise<{ patient_id: string }>;
  fetchPatients: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | Patient | null>(null);
  const [role, setRole] = useState<"CareTaker" | "Patient" | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
        setRole("CareTaker");
        fetchPatients();
      } catch {
        try {
          const res = await api.get("/patient-auth/me");
          setUser(res.data);
          setRole("Patient");
        } catch {
          setUser(null);
          setRole(null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    setAccessToken(res.data.access_token);
    setUser(res.data.user);
    setRole("CareTaker");
    await fetchPatients();
    return { role: "CareTaker" };
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
  }) => {
    await api.post("/auth/register", data);
  };

  const patientLogin = async (patientId: string, password: string) => {
    const res = await api.post("/patient-auth/login", {
      patient_id: patientId,
      password,
    });
    setAccessToken(res.data.access_token);
    setUser(res.data.patient);
    setRole("Patient");
    return { role: "Patient" };
  };

  const addPatient = async (data: {
    name: string;
    phone: string;
    location: string;
    password: string;
  }) => {
    const res = await api.post("/patient-auth/add", data);
    await fetchPatients();
    return { patient_id: res.data.patient_id };
  };

  const fetchPatients = async () => {
    try {
      const res = await api.get("/auth/patients");
      setPatients(res.data);
    } catch {
      setPatients([]);
    }
  };

  const logout = async () => {
    if (role === "CareTaker") {
      await api.post("/auth/logout");
    } else if (role === "Patient") {
      await api.post("/patient-auth/logout");
    }
    setAccessToken(null);
    setUser(null);
    setRole(null);
    setPatients([]);
    navigate("/");
  };

  return (
    <AuthContext.Provider
      value={{ user, role, isLoading, patients, login, register, patientLogin, addPatient, fetchPatients, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
