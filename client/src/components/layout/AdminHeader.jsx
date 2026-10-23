import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, ShieldAlert, LogOut, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';

export default function AdminHeader({ onToggleSidebar }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Mobile toggle & Brand */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Open administrative menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/admin" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-purple-600 flex items-center justify-center text-white">
            <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-bold text-base text-slate-900">Admin Command</span>
        </Link>
      </div>

      {/* Desktop Portal Context */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-900">Campus Administration Portal</span>
        <span>•</span>
        <span>Operational Dispatch & Facilities Moderation</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Real-time Socket Indicator */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={isConnected ? 'Live WebSocket connection active' : 'Connecting to live events...'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="hidden sm:inline">
            {isConnected ? 'Live Sync Active' : 'Connecting'}
          </span>
        </div>

        {/* Admin profile pill */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <span className="block text-xs font-semibold text-slate-900 leading-tight">
                {user.name}
              </span>
              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider leading-tight">
                Staff Administrator
              </span>
            </div>
          </div>
        )}

        {/* Explicit Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors"
          title="Sign out of administrative console"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
