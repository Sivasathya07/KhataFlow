import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("khataflow_access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("khataflow_refresh_token");
  if (!refreshToken) return null;
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"}/auth/refresh`,
      { refreshToken },
    );
    const { accessToken, refreshToken: nextRefresh } = response.data.data;
    localStorage.setItem("khataflow_access_token", accessToken);
    if (nextRefresh) localStorage.setItem("khataflow_refresh_token", nextRefresh);
    return accessToken as string;
  } catch {
    localStorage.removeItem("khataflow_access_token");
    localStorage.removeItem("khataflow_refresh_token");
    localStorage.removeItem("khataflow_user");
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!original || error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (original.url?.includes("/auth/login") || original.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }
    original._retry = true;
    refreshPromise = refreshPromise ?? refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const accessToken = await refreshPromise;
    if (!accessToken) {
      window.dispatchEvent(new Event("khataflow:logout"));
      return Promise.reject(error);
    }
    original.headers.Authorization = `Bearer ${accessToken}`;
    return api(original);
  },
);

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 429) {
      return "Too many requests. Please wait a minute and try again.";
    }
    const data = err.response?.data as { detail?: string | Array<{ msg?: string }>; error?: { message?: string } } | undefined;
    if (data?.detail) {
      if (typeof data.detail === "string") return data.detail;
      if (Array.isArray(data.detail)) {
        const msgs = data.detail.map((item) => item.msg).filter(Boolean);
        if (msgs.length > 0) return msgs.join(", ");
      }
    }
    if (data?.error?.message) return data.error.message;
    if (err.message && !err.message.startsWith("Request failed with status code")) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

