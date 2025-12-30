import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AuthUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getCurrentUser,
  isAuthenticated as checkIsAuthenticated,
  clearTokens,
  AuthError,
  LoginRequest,
  RegisterRequest,
} from '../lib/authApi';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    async function initAuth() {
      if (checkIsAuthenticated()) {
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch (err) {
          // Token invalid or expired, clear it
          clearTokens();
          setUser(null);
        }
      }
      setIsLoading(false);
    }

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data: LoginRequest = { email, password };
      const response = await apiLogin(data);
      setUser(response.user);
    } catch (err) {
      const message = err instanceof AuthError
        ? err.message
        : 'Failed to login. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data: RegisterRequest = { email, password, name };
      const response = await apiRegister(data);
      setUser(response.user);
    } catch (err) {
      const message = err instanceof AuthError
        ? err.message
        : 'Failed to create account. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  // Refresh user from stored tokens (used after OAuth callback)
  const refreshUser = useCallback(async () => {
    if (checkIsAuthenticated()) {
      setIsLoading(true);
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        clearTokens();
        setUser(null);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    register,
    logout,
    refreshUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
