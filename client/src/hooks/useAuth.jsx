import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  // Verify token on mount — if server unreachable or token invalid, clear it
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    // First check if server is reachable at all
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) {
          // Token invalid — clear it
          localStorage.removeItem('auth_token');
          setToken(null);
          return null;
        }
        return r.json();
      })
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => {
        // Server unreachable — could be stale token from old production URL
        // Clear the token so the login page shows instead of white screen
        localStorage.removeItem('auth_token');
        setToken(null);
        setLoading(false);
      });
  }, []);

  async function login(email, password) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
