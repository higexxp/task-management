import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider mounted, checking auth status...');
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('Checking auth status...');

      // Check if user is already authenticated from localStorage
      if (authService.isAuthenticated()) {
        console.log('User is authenticated from localStorage');
        const cachedUser = authService.getUser();
        if (cachedUser) {
          console.log('Found cached user:', cachedUser);
          setUser(cachedUser);
          setLoading(false);
          return;
        }
      }

      console.log('No cached auth, trying to get current user from server...');
      // Try to get current user from server
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        console.log('Got current user from server:', currentUser);
        setUser(currentUser);
      } else {
        console.log('No current user from server');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear any invalid auth data
      await authService.logout();
    } finally {
      console.log('Auth check complete, setting loading to false');
      setLoading(false);
    }
  };

  const login = () => {
    console.log('Login initiated');
    // Initiate GitHub OAuth flow
    authService.initiateGitHubAuth();
  };

  const logout = async () => {
    try {
      console.log('Logout initiated');
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear local state anyway
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  console.log('AuthProvider rendering with value:', value);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}