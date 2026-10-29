import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "cognicare_access_token";
const REFRESH_TOKEN_KEY = "cognicare_refresh_token";
const USER_ROLE_KEY = "cognicare_user_role";
const ACTIVE_PATIENT_ID_KEY = "cognicare_active_patient_id";
const API_BASE_URL_KEY = "cognicare_api_base_url";

// In-memory fallback for web preview if SecureStore is not supported
const memoryStore: Record<string, string> = {};

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      memoryStore[key] = value;
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (err) {
    console.warn(`[SecureStore] Failed to write key ${key}:`, err);
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (memoryStore[key]) return memoryStore[key];
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn(`[SecureStore] Failed to read key ${key}:`, err);
    return null;
  }
}

export async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      delete memoryStore[key];
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (err) {
    console.warn(`[SecureStore] Failed to delete key ${key}:`, err);
  }
}

export const TokenStorage = {
  getAccessToken: () => getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => setItem(ACCESS_TOKEN_KEY, token),
  removeAccessToken: () => deleteItem(ACCESS_TOKEN_KEY),

  getRefreshToken: () => getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => setItem(REFRESH_TOKEN_KEY, token),
  removeRefreshToken: () => deleteItem(REFRESH_TOKEN_KEY),

  getUserRole: () => getItem(USER_ROLE_KEY),
  setUserRole: (role: "CareTaker" | "Patient") => setItem(USER_ROLE_KEY, role),
  removeUserRole: () => deleteItem(USER_ROLE_KEY),

  getActivePatientId: () => getItem(ACTIVE_PATIENT_ID_KEY),
  setActivePatientId: (id: string) => setItem(ACTIVE_PATIENT_ID_KEY, id),
  removeActivePatientId: () => deleteItem(ACTIVE_PATIENT_ID_KEY),

  getCustomApiUrl: () => getItem(API_BASE_URL_KEY),
  setCustomApiUrl: (url: string) => setItem(API_BASE_URL_KEY, url),
  removeCustomApiUrl: () => deleteItem(API_BASE_URL_KEY),

  async clearAll() {
    await Promise.all([
      deleteItem(ACCESS_TOKEN_KEY),
      deleteItem(REFRESH_TOKEN_KEY),
      deleteItem(USER_ROLE_KEY),
      deleteItem(ACTIVE_PATIENT_ID_KEY),
    ]);
  },
};
