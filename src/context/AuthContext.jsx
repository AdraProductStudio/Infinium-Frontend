"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { getMe, login as apiLogin, logout as apiLogout, getToken, clearTokens } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (token) {
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          clearTokens();
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email, password) => {
    await apiLogin(email, password);
    const me = await getMe();
    setUser(me);
    return me;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
