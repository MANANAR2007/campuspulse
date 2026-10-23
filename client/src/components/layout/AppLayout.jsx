import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Bell, X, Megaphone, ArrowRight } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import MobileNav from './MobileNav.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { socket, isConnected } = useSocket();
  const { refreshNotificationsCount } = useAuth();
  const [liveToast, setLiveToast] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = ({ notification }) => {
      refreshNotificationsCount();
      if (notification) {
        setLiveToast(notification);
        const timer = setTimeout(() => {
          setLiveToast(null);
        }, 6000);
        return () => clearTimeout(timer);
      }
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, refreshNotificationsCount]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sidebar for desktop & mobile drawer */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main layout container shifted by desktop sidebar width */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Header bar */}
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        {/* Realtime In-App Notification Toast */}
        {liveToast && (
          <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-white rounded-xl border border-blue-300 shadow-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              {liveToast.type === 'campus_alert' ? (
                <Megaphone className="w-4 h-4 text-rose-600" />
              ) : (
                <Bell className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <strong className="block font-bold text-slate-900 truncate">
                {liveToast.title}
              </strong>
              <p className="text-slate-600 mt-0.5 line-clamp-2">
                {liveToast.message}
              </p>
              {liveToast.issue && (
                <Link
                  to={`/issues/${liveToast.issue._id || liveToast.issue.id || liveToast.issue}`}
                  onClick={() => setLiveToast(null)}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 mt-1"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic page content */}
        <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </div>
  );
}
