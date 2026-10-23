import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Megaphone,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { notificationsAPI } from '../services/api.js';
import { formatRelativeTime } from '../utils/formatters.js';
import { useAuth } from '../context/AuthContext.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

export default function NotificationsPage() {
  const { refreshNotificationsCount } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('All'); // 'All' | 'Unread'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filter === 'Unread') {
        params.unreadOnly = 'true';
      }
      const res = await notificationsAPI.getAll(params);
      if (res?.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id, alreadyRead) => {
    if (alreadyRead) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ((n.id || n._id) === id ? { ...n, readAt: new Date() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationsAPI.markAsRead(id);
      refreshNotificationsCount();
    } catch (err) {
      console.warn('Failed to mark notification as read:', err.message);
    }
  };

  const markAllAsRead = async () => {
    if (markingAll || unreadCount === 0) return;

    setMarkingAll(true);
    const prevNotifications = [...notifications];
    const prevCount = unreadCount;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date() }))
    );
    setUnreadCount(0);

    try {
      await notificationsAPI.markAllAsRead();
      refreshNotificationsCount();
    } catch (err) {
      // Rollback on failure
      setNotifications(prevNotifications);
      setUnreadCount(prevCount);
      alert(err.message || 'Failed to mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'campus_alert':
        return <Megaphone className="w-4 h-4 text-rose-600" />;
      case 'status_updated':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'issue_verified':
        return <CheckCircle2 className="w-4 h-4 text-purple-600" />;
      case 'issue_rejected':
        return <XCircle className="w-4 h-4 text-rose-600" />;
      case 'issue_comment':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-500">
            Official campus advisories, report lifecycle updates, and student comments.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchNotifications}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
            >
              {markingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('All')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === 'All'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Notifications
          </button>
          <button
            type="button"
            onClick={() => setFilter('Unread')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              filter === 'Unread'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
            <span className="text-[11px] font-bold">({unreadCount})</span>
          </button>
        </div>

        <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Live MongoDB Feed
        </span>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold block mb-0.5">Failed to Load Notifications</strong>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchNotifications}
            className="text-xs font-semibold text-rose-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white animate-pulse flex gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-2.5">
          {notifications.map((notif) => {
            const notifId = notif.id || notif._id;
            const isRead = Boolean(notif.readAt);
            const issueId = notif.issue?.id || notif.issue?._id || notif.issue;

            return (
              <div
                key={notifId}
                onClick={() => markAsRead(notifId, isRead)}
                className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                  isRead
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-blue-50/50 border-blue-200 shadow-xs'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isRead
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-white border border-blue-200 shadow-xs'
                  }`}
                >
                  {getIconForType(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3
                      className={`text-sm truncate ${
                        isRead ? 'font-medium text-slate-800' : 'font-bold text-slate-900'
                      }`}
                    >
                      {notif.title}
                    </h3>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-2">
                    {notif.message}
                  </p>

                  <div className="flex items-center gap-3 text-xs">
                    {issueId && (
                      <Link
                        to={`/issues/${issueId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notifId, isRead);
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <span>View Issue Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}

                    {!isRead && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        New
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No Notifications"
          description={
            filter === 'Unread'
              ? 'You have caught up with all campus alerts and report updates.'
              : 'There are no notification records to display.'
          }
          action={
            filter === 'Unread' ? (
              <button
                type="button"
                onClick={() => setFilter('All')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                View All Notifications
              </button>
            ) : null
          }
        />
      )}
    </div>
  );
}
