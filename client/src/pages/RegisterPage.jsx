import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, User, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }

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

    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
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
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        department: formData.department.trim(),
        password: formData.password,
      });

      // Redirect directly to the campus feed upon account creation
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(
        err.message || 'Registration failed. Please check your information and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-10">
      {/* Brand logo & header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20">
          <Activity className="w-7 h-7 stroke-[2.2]" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Student Account</h1>
        <p className="text-sm text-slate-500 mt-1">
          Join your campus community to report hazards and track resolutions
        </p>
      </div>

      {/* Server error banner */}
      {serverError && (
        <div
          role="alert"
          className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block mb-0.5">Registration Failed</strong>
            <span>{serverError}</span>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Full Name */}
          <div>
            <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="reg-name"
                type="text"
                placeholder="e.g. Aarav Sharma"
                disabled={isSubmitting}
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: null });
                }}
                className={`w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 transition-all disabled:opacity-60 ${
                  errors.name
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Campus Email *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="reg-email"
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
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Department / Program */}
          <div>
            <label htmlFor="reg-dept" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Department / Faculty (Optional)
            </label>
            <input
              id="reg-dept"
              type="text"
              placeholder="e.g. Computer Science, Mechanical Eng."
              disabled={isSubmitting}
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="reg-password"
                type="password"
                placeholder="Minimum 6 characters"
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
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="reg-confirm-password"
                type="password"
                placeholder="Repeat password"
                disabled={isSubmitting}
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value });
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                }}
                className={`w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 transition-all disabled:opacity-60 ${
                  errors.confirmPassword
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Account Role Notice */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Assigned Role: <strong>Student Reporter</strong> (Standard Privileges)</span>
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Create Student Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Login redirect */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 underline">
            Sign in to existing account
          </Link>
        </div>
      </div>
    </div>
  );
}
