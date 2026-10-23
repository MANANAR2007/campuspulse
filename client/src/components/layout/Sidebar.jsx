import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Home,
  PlusCircle,
  FileText,
  Bell,
  ShieldAlert,
  LogIn,
  LogOut,
  UserPlus,
  Shield,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isAdmin, unreadNotificationsCount } = useAuth();
  const unreadCount = unreadNotificationsCount || 0;

  const handleLogout = async () => {
    onClose && onClose();
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Campus Feed', icon: Home, end: true },
    { to: '/issues/new', label: 'Report Issue', icon: PlusCircle },
    { to: '/my-reports', label: 'My Reports', icon: FileText },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    {
      to: '/admin',
      label: 'Admin Operations',
      icon: ShieldAlert,
      roleBadge: isAdmin ? 'Admin' : 'Protected',
    },
  ];

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo & Title */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Activity className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">CampusPulse</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue-600">
              Campus Operations
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Main Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.roleBadge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isAdmin
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.roleBadge}
                    </span>
                  )}
                  {item.badge ? (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              </NavLink>
            );
          })}

          {/* Guest / Account Actions */}
          {!isAuthenticated ? (
            <>
              <div className="pt-4 px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Account
              </div>
              <NavLink
                to="/login"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </NavLink>
              <NavLink
                to="/register"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </NavLink>
            </>
          ) : null}
        </nav>

        {/* Current Authenticated User Card */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          {isAuthenticated && user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  {getInitials(user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  <span>{user.role}</span>
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                  title="Sign out of current session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600 text-xs">
                <User className="w-4 h-4 text-slate-400" />
                <span>Guest Viewer</span>
              </div>
              <Link
                to="/login"
                onClick={onClose}
                className="block text-center w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
              >
                Sign In to Report
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
