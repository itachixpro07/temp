import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // The session lives in an httpOnly cookie, so the only way to know whether
  // we're signed in is to ask the server on boot.
  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((d) => alive && setUser(d.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { user: u } = await api.login(email, password);
    setUser(u);
    return u;
  }, []);

  const confirmOtp = useCallback(async (email, code) => {
    const { user: u } = await api.verifyOtp(email, code);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, confirmOtp, signOut, setUser }),
    [user, loading, signIn, confirmOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
