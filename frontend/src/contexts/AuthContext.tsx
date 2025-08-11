import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';

interface User {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('github_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Set token in API client
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Verify token and get user info
      const response = await apiClient.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('github_token');
      delete apiClient.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (code: string) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/auth/callback', { code });
      const { token, user: userData } = response.data;

      localStorage.setItem('github_token', token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('github_token');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}