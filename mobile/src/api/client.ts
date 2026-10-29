import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { TokenStorage } from "../storage/secureStore";
import { getApiBaseUrl } from "../utils/network";

const api = axios.create({
  timeout: 45000,
});

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  if (token) {
    TokenStorage.setAccessToken(token);
  } else {
    TokenStorage.removeAccessToken();
  }
};

export const getAccessToken = () => inMemoryAccessToken;

export const setRefreshToken = (token: string | null) => {
  inMemoryRefreshToken = token;
  if (token) {
    TokenStorage.setRefreshToken(token);
  } else {
    TokenStorage.removeRefreshToken();
  }
};

export const getRefreshToken = () => inMemoryRefreshToken;

// Initialize tokens from SecureStore on startup
export const initializeAuthTokens = async () => {
  const [access, refresh] = await Promise.all([
    TokenStorage.getAccessToken(),
    TokenStorage.getRefreshToken(),
  ]);
  inMemoryAccessToken = access;
  inMemoryRefreshToken = refresh;
};

// Request Interceptor: Attach base URL and tokens
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Ensure base URL is resolved
  if (!config.baseURL) {
    config.baseURL = await getApiBaseUrl();
  }

  // Ensure access token is loaded
  if (!inMemoryAccessToken) {
    inMemoryAccessToken = await TokenStorage.getAccessToken();
  }
  if (!inMemoryRefreshToken) {
    inMemoryRefreshToken = await TokenStorage.getRefreshToken();
  }

  if (inMemoryAccessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }

  // Emulate cookie for refresh requests if needed
  const url = config.url || "";
  if (
    (url.includes("/auth/refresh") || url.includes("/patient-auth/refresh")) &&
    inMemoryRefreshToken
  ) {
    config.headers["Cookie"] = `refresh_token=${inMemoryRefreshToken}`;
  }

  return config;
});

// Refresh queue logic
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(undefined);
    }
  });
  failedQueue = [];
};

// Response Interceptor: 401 token refresh retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const url: string = originalRequest.url || "";
    const isAuthCall =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/patient-auth/login") ||
      url.includes("/patient-auth/refresh");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthCall) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const baseURL = await getApiBaseUrl();
        const refreshToken = inMemoryRefreshToken || (await TokenStorage.getRefreshToken());
        const role = await TokenStorage.getUserRole();

        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const refreshHeaders: Record<string, string> = {
          Cookie: `refresh_token=${refreshToken}`,
        };

        let res;
        if (role === "Patient") {
          try {
            res = await axios.post(
              `${baseURL}/patient-auth/refresh`,
              {},
              { headers: refreshHeaders }
            );
          } catch {
            res = await axios.post(
              `${baseURL}/auth/refresh`,
              {},
              { headers: refreshHeaders }
            );
          }
        } else {
          try {
            res = await axios.post(
              `${baseURL}/auth/refresh`,
              {},
              { headers: refreshHeaders }
            );
          } catch {
            res = await axios.post(
              `${baseURL}/patient-auth/refresh`,
              {},
              { headers: refreshHeaders }
            );
          }
        }

        const newAccessToken = res.data.access_token;
        setAccessToken(newAccessToken);

        // Check if Set-Cookie returned a refreshed refresh token
        const setCookieHeader = res.headers["set-cookie"];
        if (setCookieHeader && Array.isArray(setCookieHeader)) {
          const cookieStr = setCookieHeader.find((c) => c.startsWith("refresh_token="));
          if (cookieStr) {
            const tokenVal = cookieStr.split(";")[0].replace("refresh_token=", "");
            setRefreshToken(tokenVal);
          }
        }

        processQueue(null);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        setAccessToken(null);
        setRefreshToken(null);
        await TokenStorage.clearAll();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
