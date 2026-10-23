import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ShieldAlert, X, ArrowRight, BellRing } from 'lucide-react';
import AdminSidebar from './AdminSidebar.jsx';
import AdminHeader from './AdminHeader.jsx';
import AdminMobileNav from './AdminMobileNav.jsx';
import { useSocket } from '../../context/SocketContext.jsx';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { socket } = useSocket();
  const [liveToast, setLiveToast] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleIssueCreated = ({ issue }) => {
      if (issue) {
        setLiveToast({
          title: '🚨 New Report Submitted',
          message: `"${issue.title}" was submitted in ${issue.location?.building || 'Campus'}. Pending review.`,
          issueId: issue.id || issue._id,
        });
        const timer = setTimeout(() => {
          setLiveToast(null);
        }, 7000);
        return () => clearTimeout(timer);
      }
    };

    socket.on('issue:created', handleIssueCreated);

    return () => {
      socket.off('issue:created', handleIssueCreated);
    };
  }, [socket]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Admin Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main layout container */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Admin Header bar */}
        <AdminHeader onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        {/* Realtime Admin Dispatch Toast */}
        {liveToast && (
          <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-slate-900 text-white rounded-xl border border-purple-500/50 shadow-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2 bg-purple-900/60 text-purple-300 rounded-lg shrink-0">
              <BellRing className="w-4 h-4 text-purple-300 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <strong className="block font-bold text-white truncate">
                {liveToast.title}
              </strong>
              <p className="text-slate-300 mt-0.5 line-clamp-2">
                {liveToast.message}
              </p>
              {liveToast.issueId && (
                <Link
                  to={`/admin/issues/${liveToast.issueId}`}
                  onClick={() => setLiveToast(null)}
                  className="inline-flex items-center gap-1 font-semibold text-purple-400 hover:text-purple-300 mt-1.5"
                >
                  <span>Inspect Report</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Admin Page content */}
        <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile bottom navigation for admin */}
        <AdminMobileNav />
      </div>
    </div>
  );
}
