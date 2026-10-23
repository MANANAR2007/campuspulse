import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  // 1. Show accessible loader while session is being verified
  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-medium text-slate-500">Checking campus session...</p>
      </div>
    );
  }

  // 2. Unauthenticated: redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Admin-only route guard
  if (adminOnly && !isAdmin) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          The <strong>Admin Operations Dashboard</strong> is restricted to verified campus administrators. Your signed-in account (<strong>{user.email}</strong>) has the <strong>Student</strong> role.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Campus Feed</span>
        </Link>
      </div>
    );
  }

  return children;
}
