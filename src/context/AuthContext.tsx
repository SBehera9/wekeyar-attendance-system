import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  login: (id: string, pass: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('wp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = async (id: string, pass: string) => {
    setIsLoading(true);
    try {
      const deviceId = localStorage.getItem('wp_device_id') || Math.random().toString(36).substring(7);
      localStorage.setItem('wp_device_id', deviceId);
      const data = await api.login(id, pass, deviceId);
      setUser(data.user);
      localStorage.setItem('wp_user', JSON.stringify(data.user));
      localStorage.setItem('wp_session_id', data.sessionId);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('wp_user');
    localStorage.removeItem('wp_session_id');
  };

  useEffect(() => {
    const check = async () => {
      const sessionId = localStorage.getItem('wp_session_id');
      if (user && sessionId) {
        try {
          await api.checkSession(user.employeeId, sessionId);
        } catch (e) {
          logout();
        }
      }
    };
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
