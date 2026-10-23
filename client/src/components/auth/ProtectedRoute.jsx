import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Route guard protecting student-only authenticated actions (/issues/new, /my-reports, /notifications)
 * - If guest, redirects to /login
 * - If admin, redirects to /admin
 * - If student, allows access
 */
export default function ProtectedRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-medium text-slate-500">Checking campus session...</p>
      </div>
    );
  }

  // Unauthenticated: redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin attempting student action route: redirect to admin interface
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
