import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldAlert,
  LayoutDashboard,
  FileCheck,
  Megaphone,
  LogOut,
  Shield,
  Building2,
  Users,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminSidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    onClose && onClose();
    await logout();
    navigate('/login');
  };

  const currentView = new URLSearchParams(location.search).get('view') || 'overview';

  const navItems = [
    {
      to: '/admin',
      viewKey: 'overview',
      label: 'Admin Overview',
      icon: LayoutDashboard,
    },
    {
      to: '/admin?view=queue',
      viewKey: 'queue',
      label: 'Issue Review Queue',
      icon: FileCheck,
    },
    {
      to: '/admin?view=departments',
      viewKey: 'departments',
      label: 'Departments & Routing',
      icon: Building2,
    },
    {
      to: '/admin?view=staff',
      viewKey: 'staff',
      label: 'Staff Accounts',
      icon: Users,
    },
    {
      to: '/admin?view=alerts',
      viewKey: 'alerts',
      label: 'Campus Alert Management',
      icon: Megaphone,
    },
    {
      to: '/admin?view=audit',
      viewKey: 'audit',
      label: 'System Audit Trail',
      icon: FileText,
    },
  ];

  const getInitials = (name) => {
    if (!name) return 'A';
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
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo & Administration Title */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3 bg-slate-950/40">
          <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
            <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">CampusPulse</span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-400">
              Operations Command
            </span>
          </div>
        </div>

        {/* Administration Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Administrative Console
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === '/admin' &&
              (item.viewKey === 'overview'
                ? currentView === 'overview' && !location.search.includes('view=')
                : currentView === item.viewKey);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white font-semibold shadow-sm shadow-purple-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Administrator Profile Card */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 bg-purple-600 text-white border border-purple-400">
                {getInitials(user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name || 'Administrator'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/60 uppercase tracking-wider">
                <Shield className="w-3 h-3" />
                <span>Verified Admin</span>
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1 rounded hover:bg-rose-950/50 transition-colors"
                title="Sign out of administrative session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
