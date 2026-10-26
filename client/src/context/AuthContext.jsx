import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, notificationsAPI } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  /**
   * Check authenticated session on application mount
   */
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await authAPI.getMe();
      if (data && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      // 401 simply means not logged in (normal state for guest)
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Fetch unread notification counts for the authenticated user
   */
  const fetchUnreadNotifications = useCallback(async () => {
    if (!user) {
      setUnreadNotificationsCount(0);
      return;
    }
    try {
      const res = await notificationsAPI.getAll({ limit: 1 });
      if (res?.data && typeof res.data.unreadCount === 'number') {
        setUnreadNotificationsCount(res.data.unreadCount);
      }
    } catch {
      // Silent error for background notification count badge
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUnreadNotifications();
    } else {
      setUnreadNotificationsCount(0);
    }
  }, [user, fetchUnreadNotifications]);

  /**
   * Authenticate with email and password
   */
  const login = async (credentials) => {
    setError(null);
    try {
      const data = await authAPI.login(credentials);
      if (data && data.user) {
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Register a new student account
   */
  const register = async (userData) => {
    setError(null);
    try {
      const data = await authAPI.register(userData);
      if (data && data.user) {
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Log out and clear session cookie
   */
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (_) {
      // Always clear user in client state even if network call failed
    } finally {
      setUser(null);
      setError(null);
      setUnreadNotificationsCount(0);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refreshUser: checkAuth,
    unreadNotificationsCount,
    refreshNotificationsCount: fetchUnreadNotifications,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    isStudent: user?.role === 'student',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access authentication state and operations
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
