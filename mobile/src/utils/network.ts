import { Platform } from "react-native";
import { TokenStorage } from "../storage/secureStore";

/**
 * Default local backend endpoints:
 * - Android Emulator maps host machine localhost to 10.0.2.2
 * - iOS Simulator shares localhost with host machine
 * - Physical devices need the computer's LAN IP (e.g. 192.168.1.X:8000)
 */
export function getDefaultApiBaseUrl(): string {
  // Check if user set an EXPO_PUBLIC_API_URL in .env
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }

  // iOS Simulator / Web
  return "http://localhost:8000";
}

let cachedBaseUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;

  const custom = await TokenStorage.getCustomApiUrl();
  if (custom && custom.trim().length > 0) {
    cachedBaseUrl = custom.trim();
    return cachedBaseUrl;
  }

  cachedBaseUrl = getDefaultApiBaseUrl();
  return cachedBaseUrl;
}

export function setApiBaseUrl(url: string) {
  cachedBaseUrl = url.trim();
  TokenStorage.setCustomApiUrl(url.trim());
}
