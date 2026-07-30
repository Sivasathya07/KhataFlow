import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  businessId?: string;
  businessName?: string;
  isEmailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (businessName: string, displayName: string, email: string, pass: string) => Promise<{ devToken?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistSession(user: User, accessToken: string, refreshToken: string) {
  localStorage.setItem("khataflow_access_token", accessToken);
  localStorage.setItem("khataflow_refresh_token", refreshToken);
  localStorage.setItem("khataflow_user", JSON.stringify(user));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem("khataflow_access_token");
    localStorage.removeItem("khataflow_refresh_token");
    localStorage.removeItem("khataflow_user");
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await api.get<{ data: User }>("/auth/me");
    const next = res.data.data;
    localStorage.setItem("khataflow_user", JSON.stringify(next));
    setUser(next);
  }, []);

  useEffect(() => {
    const boot = async () => {
      const savedToken = localStorage.getItem("khataflow_access_token");
      const savedUser = localStorage.getItem("khataflow_user");
      if (savedToken && savedUser) {
        setToken(savedToken);
        try {
          setUser(JSON.parse(savedUser) as User);
          await refreshProfile();
        } catch {
          clearSession();
        }
      }
      setLoading(false);
    };
    void boot();
  }, [clearSession, refreshProfile]);

  useEffect(() => {
    const onLogout = () => clearSession();
    window.addEventListener("khataflow:logout", onLogout);
    return () => window.removeEventListener("khataflow:logout", onLogout);
  }, [clearSession]);

  const login = async (email: string, pass: string) => {
    const res = await api.post<{ data: { user: User; accessToken: string; refreshToken: string } }>("/auth/login", {
      email,
      password: pass,
    });
    const { user: loggedUser, accessToken, refreshToken } = res.data.data;
    persistSession(loggedUser, accessToken, refreshToken);
    setToken(accessToken);
    setUser(loggedUser);
    try {
      await refreshProfile();
    } catch {
      /* profile enrichment is best-effort */
    }
  };

  const register = async (businessName: string, displayName: string, email: string, pass: string) => {
    const res = await api.post<{
      data: { user: User; accessToken: string; refreshToken: string; devToken?: string };
    }>("/auth/register", {
      businessName,
      displayName,
      email,
      password: pass,
    });
    const { user: registeredUser, accessToken, refreshToken, devToken } = res.data.data;
    persistSession(registeredUser, accessToken, refreshToken);
    setToken(accessToken);
    setUser(registeredUser);
    return { devToken };
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("khataflow_refresh_token");
    try {
      await api.post("/auth/logout", { refreshToken });
    } catch {
      /* local clear still proceeds */
    }
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
