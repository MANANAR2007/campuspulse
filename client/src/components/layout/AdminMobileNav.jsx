import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileCheck, Building2, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminMobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const rawView = new URLSearchParams(location.search).get('view') || 'overview';
  const isOverview = rawView === 'overview';
  const isIssues = rawView === 'issues' || rawView === 'queue' || rawView === 'alerts';
  const isOperations = rawView === 'operations' || rawView === 'departments' || rawView === 'staff';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 text-slate-300 px-2 py-1.5 flex items-center justify-around shadow-lg">
      <NavLink
        to="/admin?view=overview"
        className={`flex flex-col items-center py-1 px-3 text-[11px] font-medium transition-colors ${
          isOverview ? 'text-purple-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Overview</span>
      </NavLink>

      <NavLink
        to="/admin?view=issues"
        className={`flex flex-col items-center py-1 px-3 text-[11px] font-medium transition-colors ${
          isIssues ? 'text-purple-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <FileCheck className="w-5 h-5 mb-0.5" />
        <span>Issues</span>
      </NavLink>

      <NavLink
        to="/admin?view=operations"
        className={`flex flex-col items-center py-1 px-3 text-[11px] font-medium transition-colors ${
          isOperations ? 'text-purple-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Building2 className="w-5 h-5 mb-0.5" />
        <span>Operations</span>
      </NavLink>

      <button
        type="button"
        onClick={handleLogout}
        className="flex flex-col items-center py-1 px-3 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
      >
        <LogOut className="w-5 h-5 mb-0.5" />
        <span>Logout</span>
      </button>
    </nav>
  );
}
