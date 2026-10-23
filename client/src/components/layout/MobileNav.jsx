import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PlusCircle, FileText, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function MobileNav() {
  const { unreadNotificationsCount } = useAuth();
  const unreadCount = unreadNotificationsCount || 0;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-3 text-[11px] font-medium transition-colors ${
            isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
          }`
        }
      >
        <Home className="w-5 h-5 mb-0.5" />
        <span>Feed</span>
      </NavLink>

      <NavLink
        to="/issues/new"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-3 text-[11px] font-medium transition-colors ${
            isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
          }`
        }
      >
        <PlusCircle className="w-5 h-5 mb-0.5 text-blue-600" />
        <span className="text-blue-600">Report</span>
      </NavLink>

      <NavLink
        to="/my-reports"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-3 text-[11px] font-medium transition-colors ${
            isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
          }`
        }
      >
        <FileText className="w-5 h-5 mb-0.5" />
        <span>My Reports</span>
      </NavLink>

      <NavLink
        to="/notifications"
        className={({ isActive }) =>
          `relative flex flex-col items-center py-1 px-3 text-[11px] font-medium transition-colors ${
            isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
          }`
        }
      >
        <div className="relative">
          <Bell className="w-5 h-5 mb-0.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-600 rounded-full" />
          )}
        </div>
        <span>Alerts</span>
      </NavLink>
    </nav>
  );
}
