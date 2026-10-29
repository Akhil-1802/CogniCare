import api, { setAccessToken, setRefreshToken } from "./client";
import { TokenStorage } from "../storage/secureStore";
import type { Patient } from "../types";

export interface CaregiverUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export const AuthApi = {
  async caregiverLogin(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, user } = res.data;
    setAccessToken(access_token);
    await TokenStorage.setUserRole("CareTaker");

    // Extract refresh token from Set-Cookie header if present
    const setCookie = res.headers["set-cookie"];
    if (setCookie && Array.isArray(setCookie)) {
      const match = setCookie.find((c: string) => c.startsWith("refresh_token="));
      if (match) {
        const token = match.split(";")[0].replace("refresh_token=", "");
        setRefreshToken(token);
      }
    }

    return { user, role: "CareTaker" as const, token: access_token };
  },

  async caregiverRegister(data: {
    name: string;
    email: string;
    password: string;
    phone: string;
  }) {
    const res = await api.post("/auth/register", data);
    return res.data;
  },

  async verifyEmail(email: string, code: string) {
    const res = await api.post("/auth/verify-email", { email, code });
    return res.data;
  },

  async resendCode(email: string) {
    const res = await api.post("/auth/resend-code", { email });
    return res.data;
  },

  async patientLogin(patientId: string, password: string) {
    const res = await api.post("/patient-auth/login", {
      patient_id: patientId,
      password,
    });
    const { access_token, patient } = res.data;
    setAccessToken(access_token);
    await TokenStorage.setUserRole("Patient");
    await TokenStorage.setActivePatientId(patient.id);

    // Extract refresh token from Set-Cookie header if present
    const setCookie = res.headers["set-cookie"];
    if (setCookie && Array.isArray(setCookie)) {
      const match = setCookie.find((c: string) => c.startsWith("refresh_token="));
      if (match) {
        const token = match.split(";")[0].replace("refresh_token=", "");
        setRefreshToken(token);
      }
    }

    return { patient, role: "Patient" as const, token: access_token };
  },

  async addPatient(data: {
    name: string;
    phone: string;
    location: string;
    password: string;
  }) {
    const res = await api.post<{ message: string; patient_id: string }>(
      "/patient-auth/add",
      data
    );
    return res.data;
  },

  async getCaregiverMe(): Promise<CaregiverUser> {
    const res = await api.get("/auth/me");
    return res.data;
  },

  async getPatientMe(): Promise<Patient> {
    const res = await api.get("/patient-auth/me");
    return res.data;
  },

  async getPatients(): Promise<Patient[]> {
    const res = await api.get("/auth/patients");
    return res.data;
  },

  async logout(role: "CareTaker" | "Patient" | null) {
    try {
      if (role === "CareTaker") {
        await api.post("/auth/logout");
      } else if (role === "Patient") {
        await api.post("/patient-auth/logout");
      }
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      setAccessToken(null);
      setRefreshToken(null);
      await TokenStorage.clearAll();
    }
  },
};
