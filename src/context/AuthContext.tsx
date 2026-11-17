import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  apiRequest,
  getAdminReturnSession,
  setAdminReturnSession,
  setCsrfToken,
  setSessionToken,
} from '../lib/api';
import type { AuthUser } from '../types';

interface AuthSessionPayload {
  user?: AuthUser | null;
  csrfToken?: string | null;
  sessionToken?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  publicSettings: Record<string, string>;
  adminReturnLabel: string | null;
  applyAuthSession: (payload: AuthSessionPayload) => void;
  refreshSession: () => Promise<void>;
  accessInvestorDashboard: (investorId: number, onSwitched?: () => void) => Promise<void>;
  returnToAdminConsole: (onSwitched?: () => void) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicSettings, setPublicSettings] = useState<Record<string, string>>({});
  const [adminReturnLabel, setAdminReturnLabel] = useState<string | null>(() => getAdminReturnSession()?.label || null);
  const authEpochRef = useRef(0);

  const applyAuthSession = useCallback((payload: AuthSessionPayload) => {
    authEpochRef.current += 1;
    if (payload.sessionToken) {
      setSessionToken(payload.sessionToken);
    }
    if (payload.csrfToken !== undefined) {
      setCsrfToken(payload.csrfToken || null);
    }
    if (payload.user !== undefined) {
      setUser(payload.user || null);
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const startEpoch = authEpochRef.current;
    try {
      const [meRes, bootRes] = await Promise.all([
        apiRequest<{ authenticated: boolean; user: AuthUser | null; csrfToken: string | null }>('/api/auth/me'),
        apiRequest<{ settings: Record<string, string> }>('/api/public/bootstrap').catch(() => ({ settings: {} })),
      ]);
      if (bootRes?.settings) {
        setPublicSettings(bootRes.settings);
      }
      if (startEpoch !== authEpochRef.current) {
        return;
      }
      setCsrfToken(meRes.csrfToken || null);
      if (!meRes.authenticated) {
        setSessionToken(null);
        setAdminReturnSession(null);
        setAdminReturnLabel(null);
        setUser(null);
      } else {
        setUser(meRes.user);
        if (meRes.user?.accountType === 'admin') {
          setAdminReturnSession(null);
          setAdminReturnLabel(null);
        } else {
          setAdminReturnLabel(getAdminReturnSession()?.label || null);
        }
      }
    } catch {
      if (startEpoch !== authEpochRef.current) {
        return;
      }
      setUser(null);
      setCsrfToken(null);
    } finally {
      if (startEpoch === authEpochRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const accessInvestorDashboard = useCallback(
    async (investorId: number, onSwitched?: () => void) => {
      const res = await apiRequest<{
        ok: boolean;
        sessionToken: string;
        csrfToken: string;
        returnAdminSessionToken: string;
        user: AuthUser;
      }>(`/api/admin/investors/${investorId}/access-dashboard`, {
        method: 'POST',
      });

      const label = res.user.profile
        ? `${res.user.profile.first_name} ${res.user.profile.last_name} (${res.user.profile.account_number})`
        : res.user.email;

      setAdminReturnSession({ token: res.returnAdminSessionToken, label });
      setAdminReturnLabel(label);
      applyAuthSession({
        user: res.user,
        sessionToken: res.sessionToken,
        csrfToken: res.csrfToken,
      });
      onSwitched?.();
    },
    [applyAuthSession]
  );

  const returnToAdminConsole = useCallback(
    async (onSwitched?: () => void) => {
      const returnSession = getAdminReturnSession();
      if (!returnSession?.token) {
        setAdminReturnSession(null);
        setAdminReturnLabel(null);
        throw new Error('Administrator session backup was not found. Please sign in to the Admin Portal.');
      }

      const res = await apiRequest<{
        ok: boolean;
        sessionToken: string;
        csrfToken: string;
        user: AuthUser;
      }>('/api/auth/restore-admin', {
        method: 'POST',
        body: JSON.stringify({ adminSessionToken: returnSession.token }),
      });

      setAdminReturnSession(null);
      setAdminReturnLabel(null);
      applyAuthSession({
        user: res.user,
        sessionToken: res.sessionToken,
        csrfToken: res.csrfToken,
      });
      onSwitched?.();
    },
    [applyAuthSession]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setAdminReturnSession(null);
    setAdminReturnLabel(null);
    setSessionToken(null);
    setCsrfToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        publicSettings,
        adminReturnLabel,
        applyAuthSession,
        refreshSession,
        accessInvestorDashboard,
        returnToAdminConsole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
