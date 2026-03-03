import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { safeStorage } from '@/lib/safeStorage';
import { getErrorMessage, parseJsonSafely } from '@/lib/apiError';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthOptional = () => {
  const context = useContext(AuthContext);
  if (context) {
    return context;
  }
  return {
    user: null,
    token: null,
    loading: true,
    login: async () => {},
    register: async () => {},
    logout: () => {},
    isAuthenticated: false,
    isAdmin: false,
  };
};

const API_BASE = '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => safeStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const saveToken = useCallback((newToken) => {
    if (newToken) {
      safeStorage.setItem('authToken', newToken);
    } else {
      safeStorage.removeItem('authToken');
    }
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
  }, [saveToken]);

  const fetchCurrentUser = useCallback(async (authToken) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      const userData = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(userData, 'Failed to fetch user'));
      }
      setUser(userData);
      return userData;
    } catch (error) {
      saveToken(null);
      setUser(null);
      throw error;
    }
  }, [saveToken]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initAuth = async () => {
      const storedToken = safeStorage.getItem('authToken');
      if (storedToken) {
        try {
          await fetchCurrentUser(storedToken);
        } catch (error) {
          console.error('Auth initialization failed:', error);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [fetchCurrentUser]);

  const login = useCallback(async (email, password) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(data, 'Login failed'));
    }
    saveToken(data.token);
    setUser(data.user);
    return data.user;
  }, [saveToken]);

  const register = useCallback(async (data) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const payload = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Registration failed'));
    }

    return payload;
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = safeStorage.getItem('authToken');
    if (storedToken) {
      try {
        await fetchCurrentUser(storedToken);
      } catch (error) {
        console.error('Failed to refresh user:', error);
      }
    }
  }, [fetchCurrentUser]);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
