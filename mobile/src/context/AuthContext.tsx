import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthApi, CaregiverUser } from "../api/auth";
import { TokenStorage } from "../storage/secureStore";
import { initializeAuthTokens } from "../api/client";
import type { Patient } from "../types";

interface AuthContextType {
  user: CaregiverUser | Patient | null;
  role: "CareTaker" | "Patient" | null;
  isLoading: boolean;
  patients: Patient[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  caregiverLogin: (email: string, password: string) => Promise<void>;
  patientLogin: (patientId: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
  }) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  addPatient: (data: {
    name: string;
    phone: string;
    location: string;
    password: string;
  }) => Promise<{ patient_id: string }>;
  refreshPatients: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CaregiverUser | Patient | null>(null);
  const [role, setRole] = useState<"CareTaker" | "Patient" | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on app startup
  useEffect(() => {
    async function restoreSession() {
      try {
        await initializeAuthTokens();
        const savedRole = await TokenStorage.getUserRole();

        if (savedRole === "CareTaker") {
          try {
            const me = await AuthApi.getCaregiverMe();
            setUser(me);
            setRole("CareTaker");
            const patientList = await AuthApi.getPatients();
            setPatients(patientList);
            if (patientList.length > 0) {
              setSelectedPatient(patientList[0]);
            }
          } catch {
            await handleFailedRestore();
          }
        } else if (savedRole === "Patient") {
          try {
            const me = await AuthApi.getPatientMe();
            setUser(me);
            setRole("Patient");
          } catch {
            await handleFailedRestore();
          }
        } else {
          // No role saved: probe caregiver then patient
          try {
            const me = await AuthApi.getCaregiverMe();
            setUser(me);
            setRole("CareTaker");
            const patientList = await AuthApi.getPatients();
            setPatients(patientList);
            if (patientList.length > 0) {
              setSelectedPatient(patientList[0]);
            }
          } catch {
            try {
              const me = await AuthApi.getPatientMe();
              setUser(me);
              setRole("Patient");
            } catch {
              setUser(null);
              setRole(null);
            }
          }
        }
      } catch (err) {
        console.warn("[AuthContext] Session restore error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const handleFailedRestore = async () => {
    setUser(null);
    setRole(null);
    setPatients([]);
    setSelectedPatient(null);
    await TokenStorage.clearAll();
  };

  const caregiverLogin = async (email: string, password: string) => {
    const res = await AuthApi.caregiverLogin(email, password);
    setUser(res.user);
    setRole("CareTaker");
    try {
      const patientList = await AuthApi.getPatients();
      setPatients(patientList);
      if (patientList.length > 0) {
        setSelectedPatient(patientList[0]);
      }
    } catch {
      setPatients([]);
    }
  };

  const patientLogin = async (patientId: string, password: string) => {
    const res = await AuthApi.patientLogin(patientId, password);
    setUser(res.patient);
    setRole("Patient");
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
  }) => {
    await AuthApi.caregiverRegister(data);
  };

  const verifyEmail = async (email: string, code: string) => {
    await AuthApi.verifyEmail(email, code);
  };

  const resendCode = async (email: string) => {
    await AuthApi.resendCode(email);
  };

  const addPatient = async (data: {
    name: string;
    phone: string;
    location: string;
    password: string;
  }) => {
    const res = await AuthApi.addPatient(data);
    await refreshPatients();
    return res;
  };

  const refreshPatients = async () => {
    try {
      const list = await AuthApi.getPatients();
      setPatients(list);
      if (list.length > 0 && !selectedPatient) {
        setSelectedPatient(list[0]);
      }
    } catch {
      setPatients([]);
    }
  };

  const logout = async () => {
    const currentRole = role;
    await AuthApi.logout(currentRole);
    setUser(null);
    setRole(null);
    setPatients([]);
    setSelectedPatient(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        patients,
        selectedPatient,
        setSelectedPatient,
        caregiverLogin,
        patientLogin,
        register,
        verifyEmail,
        resendCode,
        addPatient,
        refreshPatients,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
