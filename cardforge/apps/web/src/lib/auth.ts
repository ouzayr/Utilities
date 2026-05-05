import { api, setToken, clearToken } from "./api";
import type { AuthResponse, MeResponse } from "@/types";

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/api/auth/login", { email, password });
  setToken(res.accessToken, res.refreshToken);
  localStorage.setItem("cf_user", JSON.stringify(res));
  return res;
}

export async function register(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/api/auth/register", payload);
  setToken(res.accessToken, res.refreshToken);
  localStorage.setItem("cf_user", JSON.stringify(res));
  return res;
}

export async function getMe(): Promise<MeResponse> {
  return api.get<MeResponse>("/api/auth/me");
}

export function logout() {
  clearToken();
  window.location.href = "/login";
}

export function getStoredAuth(): AuthResponse | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cf_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
