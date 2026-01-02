import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiPost } from './api';

type AdminUser = {
  id: string;
  email: string;
  role: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
};

type Ctx = {
  token: string | null;
  admin: AdminUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

const LS_TOKEN = 'admin_token';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN));
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!token) {
      setAdmin(null);
      return;
    }
    // Decode minimal payload? We keep admin null until first successful call.
  }, [token]);

  const value = useMemo<Ctx>(() => ({
    token,
    admin,
    login: async (email: string, password: string) => {
      const res = await apiPost<{ token: string; user: AdminUser }>('/admin/auth/login', { email, password });
      localStorage.setItem(LS_TOKEN, res.token);
      setToken(res.token);
      setAdmin(res.user);
    },
    logout: () => {
      localStorage.removeItem(LS_TOKEN);
      setToken(null);
      setAdmin(null);
    },
  }), [token, admin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
