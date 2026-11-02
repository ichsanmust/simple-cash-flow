import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, getToken, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await authApi.getMe();
          setUser(profile);
        } catch (err) {
          console.error("Gagal memuat profil user:", err);
          setToken(null);
          setTokenState(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    setToken(res.access_token);
    setTokenState(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
}

