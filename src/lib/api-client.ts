import axios from "axios";

const baseURL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080") as string;
const SESSION_STORAGE_KEY = "julia-auth-session";

export const apiClient = axios.create({
  baseURL: `${baseURL.replace(/\/$/, "")}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const setApiClientAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

apiClient.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }
  if (!config.headers?.Authorization) {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession) as { token?: string };
        if (parsed?.token) {
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${parsed.token}`;
        }
      } catch (error) {
        console.warn("Session storage corrompue. Suppression.", error);
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }
  return config;
});

export default apiClient;
