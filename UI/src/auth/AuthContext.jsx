import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, clearToken, hasToken, saveToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    const handleExpired = () => setUser(null);
    window.addEventListener('auth:expired', handleExpired);

    const verifySession = async () => {
      if (!hasToken()) {
        setCheckingSession(false);
        return;
      }

      try {
        const result = await apiRequest('/auth/me');
        setUser(result.user);
      } catch {
        clearToken();
        setUser(null);
      } finally {
        setCheckingSession(false);
      }
    };

    verifySession();
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = async (email, password) => {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveToken(result.token);
    setUser(result.user);
    return result.user;
  };

  const value = useMemo(
    () => ({ user, login, logout, checkingSession }),
    [user, logout, checkingSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
