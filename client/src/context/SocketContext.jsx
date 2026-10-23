import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Only connect when user is authenticated
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Single-origin connection using Vite proxy in dev or same host in prod
    const socket = io('/', {
      path: '/socket.io',
      withCredentials: true, // Always send HttpOnly cookie
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id || user?._id]);

  /**
   * Helper to join an issue discussion room with callback
   */
  const joinIssueRoom = useCallback((issueId, onJoined) => {
    if (socketRef.current && issueId) {
      socketRef.current.emit('join:issue', issueId, (response) => {
        if (typeof onJoined === 'function') {
          onJoined(response);
        }
      });
    }
  }, []);

  /**
   * Helper to leave an issue discussion room
   */
  const leaveIssueRoom = useCallback((issueId) => {
    if (socketRef.current && issueId) {
      socketRef.current.emit('leave:issue', issueId);
    }
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    joinIssueRoom,
    leaveIssueRoom,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

/**
 * Custom hook to access realtime Socket.IO instance and connection state
 */
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
