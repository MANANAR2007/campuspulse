import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Route boundary for Student Mode
 * - If user is an Admin, immediately redirects to /admin to ensure complete role separation.
 * - Shows loading state during session restoration to prevent navigation flashes.
 * - Allows students and guests to view the student interface.
 */
export default function StudentRouteGuard({ children }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-medium text-slate-500">Checking campus session...</p>
      </div>
    );
  }

  // Admins must never enter Student Mode
  if (user && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
