import React, { createContext, useState, useContext, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('dash_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('dash_user');
    return saved ? JSON.parse(saved) : null;
  });

  const isLoggedIn = !!token;

  const login = async (username, password, database) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, database }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login gagal');
    }

    const data = await res.json();
    localStorage.setItem('dash_token', data.token);
    localStorage.setItem('dash_user', JSON.stringify({ username: data.username, role: data.role, database: data.database }));
    setToken(data.token);
    setUser({ username: data.username, role: data.role, database: data.database });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('dash_token');
    localStorage.removeItem('dash_user');
    setToken(null);
    setUser(null);
  };

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Sesi berakhir, silakan login ulang');
    }
    return res;
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, isLoggedIn, login, logout, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
