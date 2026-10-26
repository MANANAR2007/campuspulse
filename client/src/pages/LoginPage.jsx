import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const errs = {};
    if (!formData.email.trim()) {
      errs.email = 'Campus email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errs.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const loggedUser = await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Role-based login redirection
      if (loggedUser && loggedUser.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (loggedUser && loggedUser.role === 'staff') {
        navigate('/staff', { replace: true });
      } else {
        const returnPath = location.state?.from?.pathname;
        if (returnPath && !returnPath.startsWith('/admin') && !returnPath.startsWith('/staff') && returnPath !== '/login') {
          navigate(returnPath, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      setServerError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      {/* Brand logo & header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20">
          <Activity className="w-7 h-7 stroke-[2.2]" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to CampusPulse</h1>
        <p className="text-sm text-slate-500 mt-1">
          Use your campus credentials to submit and track issue reports
        </p>
      </div>

      {/* Server error alert banner */}
      {serverError && (
        <div
          role="alert"
          className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block mb-0.5">Authentication Error</strong>
            <span>{serverError}</span>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Campus Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="login-email"
                type="email"
                placeholder="student@campus.edu"
                disabled={isSubmitting}
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email) setErrors({ ...errors, email: null });
                }}
                className={`w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 transition-all disabled:opacity-60 ${
                  errors.email
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
                }`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                disabled={isSubmitting}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (errors.password) setErrors({ ...errors, password: null });
                }}
                className={`w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 transition-all disabled:opacity-60 ${
                  errors.password
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
                }`}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
            </div>
            {errors.password && (
              <p id="password-error" className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.password}
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              disabled={isSubmitting}
              checked={formData.rememberMe}
              onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="remember-me" className="ml-2 text-xs text-slate-600">
              Remember my session
            </label>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm shadow-xs transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Register redirect */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
          Don't have an account yet?{' '}
          <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 underline">
            Register for CampusPulse
          </Link>
        </div>
      </div>
    </div>
  );
}
