import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Route guard strictly protecting Department Staff routes
 * - Shows loader during session restoration
 * - Redirects guests to /login
 * - Allows access to role: 'staff' (and optionally 'admin')
 * - Denies access to students with clear message
 */
export default function StaffRouteGuard({ children }) {
  const { user, loading, isStaff, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Authenticating Department Staff Credentials...
        </p>
      </div>
    );
  }

  // Unauthenticated: redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Allow admin or active staff
  if (!isStaff && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h1>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            The <strong>Department Staff Operations Portal</strong> is restricted to assigned department personnel. Your account (<strong>{user.email}</strong>) has the <strong>Student</strong> role.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Campus Feed</span>
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
