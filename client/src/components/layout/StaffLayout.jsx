import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  Clock,
  LogOut,
  Bell,
  Building2,
  User,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function StaffLayout() {
  const { user, logout, unreadNotificationsCount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Staff Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link to="/staff" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-tight">
                  CampusPulse <span className="text-amber-400 font-semibold text-xs ml-1 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">STAFF</span>
                </span>
                <span className="text-[10px] text-slate-400 tracking-wider uppercase block">
                  Operations & Resolution
                </span>
              </div>
            </Link>

            {/* Department Badge */}
            {user?.departmentName && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs ml-3">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-medium">{user.departmentName}</span>
              </div>
            )}
          </div>

          {/* Right actions: Staff user info & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">{user?.name}</span>
              <span className="text-[10px] text-slate-400 capitalize">{user?.role} • {user?.departmentName || 'General Staff'}</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 pb-12 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
