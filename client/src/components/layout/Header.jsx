import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Plus, Bell, Search, Activity, User, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Header({
  onToggleSidebar,
  searchQuery = '',
  onSearchChange = null,
  showSearch = true,
}) {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, unreadNotificationsCount } = useAuth();
  const unreadCount = unreadNotificationsCount || 0;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Mobile toggle & Brand (mobile only) */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-bold text-base text-slate-900">CampusPulse</span>
        </Link>
      </div>

      {/* Search Input (Desktop & Tablets) */}
      <div className="flex-1 max-w-md hidden sm:block">
        {showSearch ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search campus issues, buildings, keywords..."
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        ) : null}
      </div>

      {/* Right Action buttons */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        <Link
          to="/notifications"
          className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label={`View notifications, ${unreadCount} unread`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-600 rounded-full ring-2 ring-white" />
          )}
        </Link>

        {/* User state indicator or Sign In link */}
        {isAuthenticated && user ? (
          <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-slate-200">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isAdmin
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}
              title={`${user.name} (${user.role})`}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden md:block">
              <span className="block text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-500 capitalize leading-tight">
                {user.role}
              </span>
            </div>
          </div>
        ) : (
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        )}

        <Link
          to="/issues/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Report an Issue</span>
          <span className="sm:hidden">Report</span>
        </Link>
      </div>
    </header>
  );
}
