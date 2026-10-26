import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileCheck,
  Megaphone,
  Check,
  X,
  Wrench,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Flame,
  TrendingUp,
  BarChart3,
  Users,
  MapPin,
  Eye,
  Compass,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import CategoryBadge from '../components/common/CategoryBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { adminAPI, CAMPUS_ZONES, getCampusZoneLabel } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { formatRelativeTime } from '../utils/formatters.js';

const FILTER_CATEGORIES = [
  { id: 'All', label: 'All Categories' },
  { id: 'infrastructure', label: 'Infrastructure & Buildings' },
  { id: 'electrical', label: 'Electrical & Power' },
  { id: 'plumbing', label: 'Plumbing & Water' },
  { id: 'it_wifi', label: 'IT & Campus Wi-Fi' },
  { id: 'safety', label: 'Campus Safety & Hazards' },
  { id: 'sanitation', label: 'Sanitation & Hygiene' },
  { id: 'other', label: 'Other Campus Facilities' },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [stats, setStats] = useState({
    totalIssues: 0,
    openIssues: 0,
    criticalIssues: 0,
    pendingReview: 0,
    inProgress: 0,
    resolved: 0,
    activeAlerts: 0,
    rejectedIssues: 0,
    totalAffirmations: 0,
    avgResolutionTimeHours: 0,
    categoryDistribution: [],
    statusDistribution: [],
    recentVelocity: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Campus Hotspots State
  const [hotspots, setHotspots] = useState([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);

  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Filters & Sorting
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterCampusZone, setFilterCampusZone] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [searchParams] = useSearchParams();
  const currentView = searchParams.get('view') || 'overview';

  // React to view changes from Admin Sidebar navigation
  useEffect(() => {
    if (currentView === 'queue') {
      setFilterStatus('reported');
      setPage(1);
    } else if (currentView === 'alerts') {
      setFilterStatus('All');
      setPage(1);
    } else {
      setFilterStatus('All');
      setPage(1);
    }
  }, [currentView]);

  // Action modals
  const [reviewModal, setReviewModal] = useState(null); // { issue, decision, approveAlert: false, note: '' }
  const [statusModal, setStatusModal] = useState(null); // { issue, targetStatus: '', note: '' }
  const [isProcessing, setIsProcessing] = useState(false);

  // Load database-derived statistics
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await adminAPI.getStats();
      if (res && res.data) {
        setStats(res.data);
      }
    } catch {
      // Non-blocking stats error
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load campus hotspot analytics
  const fetchHotspots = useCallback(async () => {
    try {
      setHotspotsLoading(true);
      const res = await adminAPI.getHotspots();
      if (res && res.data && Array.isArray(res.data.hotspots)) {
        setHotspots(res.data.hotspots);
      }
    } catch {
      // Non-blocking hotspots error
    } finally {
      setHotspotsLoading(false);
    }
  }, []);

  // Load review queue
  const fetchIssues = useCallback(async () => {
    setIssuesLoading(true);
    setError(null);

    const params = {
      page,
      limit: 10,
    };

    if (filterStatus !== 'All') {
      params.status = filterStatus.toLowerCase();
    }

    if (filterSeverity !== 'All') {
      params.severity = filterSeverity.toLowerCase();
    }

    if (filterCampusZone !== 'All') {
      params.campusZone = filterCampusZone.toLowerCase();
    }

    if (filterCategory !== 'All') {
      params.category = filterCategory.toLowerCase();
    }

    if (sort !== 'newest') {
      params.sort = sort;
    }

    if (currentView === 'alerts') {
      params.isCampusWideAlert = true;
    }

    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    try {
      const res = await adminAPI.getIssues(params);
      if (res && res.data) {
        setIssues(res.data.issues || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch issues from review queue.');
    } finally {
      setIssuesLoading(false);
    }
  }, [page, filterStatus, filterSeverity, filterCampusZone, filterCategory, sort, searchQuery, currentView]);

  useEffect(() => {
    fetchStats();
    fetchHotspots();
  }, [fetchStats, fetchHotspots]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Realtime Socket.IO listeners for live admin queue and statistics updates
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeChange = () => {
      fetchStats();
      fetchHotspots();
      fetchIssues();
    };

    socket.on('issue:created', handleRealtimeChange);
    socket.on('issue:updated', handleRealtimeChange);
    socket.on('issue:deleted', handleRealtimeChange);
    socket.on('issue:statusChanged', handleRealtimeChange);
    socket.on('alert:approved', handleRealtimeChange);
    socket.on('confirmation:updated', handleRealtimeChange);

    return () => {
      socket.off('issue:created', handleRealtimeChange);
      socket.off('issue:updated', handleRealtimeChange);
      socket.off('issue:deleted', handleRealtimeChange);
      socket.off('issue:statusChanged', handleRealtimeChange);
      socket.off('alert:approved', handleRealtimeChange);
      socket.off('confirmation:updated', handleRealtimeChange);
    };
  }, [socket, fetchStats, fetchHotspots, fetchIssues]);

  // Execute Review Decision (Verify / Reject)
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewModal) return;

    setIsProcessing(true);
    try {
      const payload = {
        decision: reviewModal.decision,
        approveCampusAlert: Boolean(reviewModal.approveAlert),
        resolutionNote: reviewModal.note ? reviewModal.note.trim() : '',
      };

      await adminAPI.reviewIssue(reviewModal.issue.id, payload);

      setActionFeedback({
        type: 'success',
        message: `Report #${reviewModal.issue.id.slice(-6)} was successfully marked as ${
          reviewModal.decision === 'verify' ? 'Verified' : 'Rejected'
        }.`,
      });

      setReviewModal(null);
      fetchStats();
      fetchHotspots();
      fetchIssues();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to complete review decision.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Status Transition
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusModal || !statusModal.targetStatus) return;

    setIsProcessing(true);
    try {
      const payload = {
        status: statusModal.targetStatus,
        resolutionNote: statusModal.note ? statusModal.note.trim() : '',
      };

      await adminAPI.updateStatus(statusModal.issue.id, payload);

      setActionFeedback({
        type: 'success',
        message: `Status of #${statusModal.issue.id.slice(-6)} updated to '${statusModal.targetStatus}'.`,
      });

      setStatusModal(null);
      fetchStats();
      fetchHotspots();
      fetchIssues();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to update status transition.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset all filters
  const handleClearFilters = () => {
    setFilterStatus('All');
    setFilterSeverity('All');
    setFilterCampusZone('All');
    setFilterCategory('All');
    setSort('newest');
    setSearchQuery('');
    setPage(1);
  };

  const isAnyFilterActive =
    filterStatus !== 'All' ||
    filterSeverity !== 'All' ||
    filterCampusZone !== 'All' ||
    filterCategory !== 'All' ||
    sort !== 'newest' ||
    searchQuery.trim().length > 0;

  // Max daily reports in 7-day velocity series
  const maxVelocityCount = Math.max(
    1,
    ...(stats.recentVelocity || []).map((v) => v.count)
  );

  return (
    <div className="space-y-6">
      {/* Top Command Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-purple-700 text-white px-2 py-0.5 rounded">
              Campus Command Center
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Operations Lead: {user?.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Facilities & Emergency Dispatch</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time campus situational awareness, zone hotspots, and lifecycle review queue.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchStats();
            fetchHotspots();
            fetchIssues();
          }}
          disabled={issuesLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${issuesLoading ? 'animate-spin' : ''}`} />
          <span>Sync Live Ops</span>
        </button>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
            actionFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {actionFeedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive Click-to-Filter Executive Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Platform Metrics (Click to filter queue)
          </span>
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Card 1: Total Reports */}
          <button
            type="button"
            onClick={handleClearFilters}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              filterStatus === 'All' && filterSeverity === 'All'
                ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Reports
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {statsLoading ? '...' : stats.totalIssues}
            </div>
            <span className="text-[10px] text-slate-400">All submissions</span>
          </button>

          {/* Card 2: Pending Review */}
          <button
            type="button"
            onClick={() => {
              setFilterStatus((curr) => (curr === 'reported' ? 'All' : 'reported'));
              setPage(1);
            }}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              filterStatus === 'reported'
                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200 shadow-xs'
                : 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                Pending
              </span>
              <Clock className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-blue-700 mt-1">
              {statsLoading ? '...' : stats.openIssues}
            </div>
            <span className="text-[10px] text-slate-500">Needs review</span>
          </button>

          {/* Card 3: In Progress */}
          <button
            type="button"
            onClick={() => {
              setFilterStatus((curr) => (curr === 'in_progress' ? 'All' : 'in_progress'));
              setPage(1);
            }}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              filterStatus === 'in_progress'
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200 shadow-xs'
                : 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                In Progress
              </span>
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-xl font-bold text-amber-700 mt-1">
              {statsLoading ? '...' : stats.inProgress}
            </div>
            <span className="text-[10px] text-slate-500">Crew deployed</span>
          </button>

          {/* Card 4: Resolved */}
          <button
            type="button"
            onClick={() => {
              setFilterStatus((curr) => (curr === 'resolved' ? 'All' : 'resolved'));
              setPage(1);
            }}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              filterStatus === 'resolved'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200 shadow-xs'
                : 'bg-white border-slate-200 hover:border-emerald-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                Resolved
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {statsLoading ? '...' : stats.resolved}
            </div>
            <span className="text-[10px] text-slate-500">Closed tickets</span>
          </button>

          {/* Card 5: Critical Hazards */}
          <button
            type="button"
            onClick={() => {
              setFilterSeverity((curr) => (curr === 'critical' ? 'All' : 'critical'));
              setPage(1);
            }}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              filterSeverity === 'critical'
                ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-200 shadow-xs'
                : 'bg-white border-rose-200 hover:border-rose-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                Critical
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-xl font-bold text-rose-700 mt-1">
              {statsLoading ? '...' : stats.criticalIssues}
            </div>
            <span className="text-[10px] text-rose-600/80">Hazard alert</span>
          </button>

          {/* Card 6: Active Alerts */}
          <button
            type="button"
            onClick={() => {
              setFilterStatus('All');
              setPage(1);
            }}
            className="text-left p-3.5 rounded-xl border border-purple-200 bg-white hover:border-purple-300 shadow-2xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                Alerts
              </span>
              <Megaphone className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="text-xl font-bold text-purple-700 mt-1">
              {statsLoading ? '...' : stats.activeAlerts}
            </div>
            <span className="text-[10px] text-purple-600/80">Advisories</span>
          </button>

          {/* Card 7: Community Signals */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center justify-between text-indigo-700">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Signals
              </span>
              <Users className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {statsLoading ? '...' : stats.totalAffirmations}
            </div>
            <span className="text-[10px] text-slate-400">Total affirmations</span>
          </div>

          {/* Card 8: Avg Resolution Time */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center justify-between text-teal-700">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Avg Turnaround
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {statsLoading ? '...' : `${stats.avgResolutionTimeHours}h`}
            </div>
            <span className="text-[10px] text-slate-400">Time to resolution</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid: 7-Day Velocity & Category/Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-Day Velocity Trend Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                7-Day Inflow Velocity
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Daily new incident reports</span>
          </div>

          {/* Bar Chart Container */}
          <div className="h-40 flex items-end justify-between gap-2 pt-6 pb-2 px-1 border-b border-slate-100">
            {(stats.recentVelocity || []).map((day, idx) => {
              const heightPercent =
                maxVelocityCount > 0 ? (day.count / maxVelocityCount) * 100 : 0;
              const hasCount = day.count > 0;

              return (
                <div key={day.date || idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span
                    className={`text-[10px] font-bold transition-opacity ${
                      hasCount ? 'text-indigo-600' : 'text-slate-300'
                    }`}
                  >
                    {day.count}
                  </span>
                  <div className="w-full max-w-[28px] bg-slate-100 rounded-t-md h-full flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        hasCount
                          ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-700 group-hover:to-indigo-500'
                          : 'bg-transparent'
                      }`}
                      style={{ height: `${Math.max(hasCount ? 12 : 0, heightPercent)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>Aggregated past 7 calendar days</span>
            <span className="font-semibold text-slate-600">
              Total Inflow: {(stats.recentVelocity || []).reduce((acc, v) => acc + v.count, 0)} reports
            </span>
          </div>
        </div>

        {/* Category & Status Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Category Distribution
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Incident clustering</span>
          </div>

          <div className="space-y-2.5">
            {(stats.categoryDistribution && stats.categoryDistribution.length > 0
              ? stats.categoryDistribution.slice(0, 5)
              : [
                  { category: 'infrastructure', count: 0 },
                  { category: 'electrical', count: 0 },
                  { category: 'plumbing', count: 0 },
                ]
            ).map((item) => {
              const total = stats.totalIssues || 1;
              const percent = Math.round((item.count / total) * 100);

              return (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 capitalize">
                      {item.category.replace('_', ' ')}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {item.count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status Lifecycle Split */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-4 gap-2 text-center text-[11px]">
            <div className="bg-blue-50 border border-blue-200/60 rounded p-1.5 text-blue-800">
              <span className="block font-bold">{stats.openIssues}</span>
              <span className="text-[10px]">Reported</span>
            </div>
            <div className="bg-purple-50 border border-purple-200/60 rounded p-1.5 text-purple-800">
              <span className="block font-bold">{stats.pendingReview - stats.openIssues >= 0 ? stats.pendingReview - stats.openIssues : 0}</span>
              <span className="text-[10px]">Verified</span>
            </div>
            <div className="bg-amber-50 border border-amber-200/60 rounded p-1.5 text-amber-800">
              <span className="block font-bold">{stats.inProgress}</span>
              <span className="text-[10px]">In Progress</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200/60 rounded p-1.5 text-emerald-800">
              <span className="block font-bold">{stats.resolved}</span>
              <span className="text-[10px]">Resolved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Campus Hotspots & Recurrence Radar Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-600" />
              <h2 className="text-base font-bold text-slate-900">
                Campus Hotspots & Recurrence Detection
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardized campus zones prioritized by active volume, critical hazards, and recent recurrence.
            </p>
          </div>

          <span className="text-xs text-slate-400 font-medium self-start sm:self-auto">
            14-Day Rolling Recurrence Window
          </span>
        </div>

        {hotspotsLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            <span>Aggregating campus zones...</span>
          </div>
        ) : hotspots.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No campus reports registered yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hotspots
              .filter((h) => h.totalReports > 0 || h.recurrenceScore > 0)
              .slice(0, 6)
              .map((h) => {
                const isSelectedZone = filterCampusZone === h.zone;

                return (
                  <div
                    key={h.zone}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelectedZone
                        ? 'border-purple-400 bg-purple-50/60 ring-2 ring-purple-200'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-purple-600" />
                          <span>{getCampusZoneLabel(h.zone)}</span>
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          {h.totalReports} total {h.totalReports === 1 ? 'report' : 'reports'}
                        </span>
                      </div>

                      {/* Recurrence score badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          h.recurrenceScore >= 6
                            ? 'bg-rose-100 text-rose-700'
                            : h.recurrenceScore >= 3
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Flame className="w-3 h-3" />
                        <span>Score: {h.recurrenceScore}</span>
                      </span>
                    </div>

                    {/* Stats pills */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-3">
                      <span className="bg-white border border-slate-200 px-2 py-0.5 rounded font-medium">
                        Active: <strong className="text-slate-900">{h.activeReports}</strong>
                      </span>
                      {h.criticalReports > 0 && (
                        <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded font-bold">
                          Critical: {h.criticalReports}
                        </span>
                      )}
                      <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                        Resolved: {h.resolvedReports}
                      </span>
                    </div>

                    {/* Drill down action button */}
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCampusZone((curr) => (curr === h.zone ? 'All' : h.zone));
                        setPage(1);
                        document.getElementById('review-queue-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                        isSelectedZone
                          ? 'bg-purple-700 text-white border-purple-700'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      <span>{isSelectedZone ? 'Clear Zone Filter' : 'Drill Down Zone'}</span>
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Review Queue Card */}
      <div id="review-queue-section" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header with Search and Advanced Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Operational Review Queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review student reports, authorize emergency alerts, and dispatch maintenance crews.
              </p>
            </div>

            {/* Quick Sort Dropdown */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="urgency">Sort: Urgency (Critical First)</option>
                <option value="oldest">Sort: Oldest Pending</option>
                <option value="most_affirmed">Sort: Most Affirmed</option>
              </select>
            </div>
          </div>

          {/* Search & Multi-Attribute Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
            {/* Search Input */}
            <div className="relative lg:col-span-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, building..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="reported">Reported (Pending)</option>
              <option value="verified">Verified</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Severity Filter */}
            <select
              value={filterSeverity}
              onChange={(e) => {
                setFilterSeverity(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
            >
              <option value="All">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="moderate">Moderate</option>
              <option value="low">Low</option>
            </select>

            {/* Campus Zone Filter */}
            <select
              value={filterCampusZone}
              onChange={(e) => {
                setFilterCampusZone(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
            >
              <option value="All">All Campus Zones</option>
              {CAMPUS_ZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
            >
              {FILTER_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Active Filter Pills Bar */}
          {isAnyFilterActive && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Active filters:</span>
              {filterStatus !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                  Status: {filterStatus}
                  <button type="button" onClick={() => setFilterStatus('All')} className="text-slate-400 hover:text-slate-600">✕</button>
                </span>
              )}
              {filterSeverity !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                  Severity: {filterSeverity}
                  <button type="button" onClick={() => setFilterSeverity('All')} className="text-slate-400 hover:text-slate-600">✕</button>
                </span>
              )}
              {filterCampusZone !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-[11px]">
                  Zone: {getCampusZoneLabel(filterCampusZone)}
                  <button type="button" onClick={() => setFilterCampusZone('All')} className="text-purple-400 hover:text-purple-600">✕</button>
                </span>
              )}
              {filterCategory !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                  Category: {filterCategory}
                  <button type="button" onClick={() => setFilterCategory('All')} className="text-slate-400 hover:text-slate-600">✕</button>
                </span>
              )}
              {sort !== 'newest' && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full text-[11px]">
                  Sort: {sort.replace('_', ' ')}
                  <button type="button" onClick={() => setSort('newest')} className="text-indigo-400 hover:text-indigo-600">✕</button>
                </span>
              )}
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Loading state */}
        {issuesLoading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span>Loading review queue from MongoDB...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-600">
            <p>{error}</p>
          </div>
        ) : issues.length > 0 ? (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Issue Details</th>
                    <th className="py-3 px-4">Campus Location & Zone</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Signals / Alert</th>
                    <th className="py-3 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          to={`/admin/issues/${issue.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 block truncate"
                        >
                          {issue.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-slate-400">
                            #{issue.id.slice(-6)}
                          </span>
                          <CategoryBadge category={issue.category} size="xs" />
                          <span className="text-slate-400">
                            • {formatRelativeTime(issue.createdAt)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-medium text-slate-800">
                          {issue.location?.building || 'Main Campus'}
                        </div>
                        <div className="text-[11px] text-indigo-700 font-medium">
                          {getCampusZoneLabel(issue.location?.campusZone)}
                        </div>
                        {issue.location?.area && (
                          <div className="text-[10px] text-slate-400">
                            {issue.location.area}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <SeverityBadge severity={issue.severity} size="xs" />
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={issue.status} size="xs" />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            <Users className="w-3 h-3 text-slate-500" />
                            {issue.confirmationCount || 0} Affirmed
                          </span>
                          <div>
                            {issue.isCampusWideAlert ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                <Megaphone className="w-3 h-3" />
                                Alert Active
                              </span>
                            ) : issue.campusAlertRequested ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                <Megaphone className="w-3 h-3 text-amber-600" />
                                Alert Req
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* If in reported status: Verify / Reject actions */}
                        {issue.status === 'reported' ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setReviewModal({
                                  issue,
                                  decision: 'verify',
                                  approveAlert: false,
                                  note: '',
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md transition-colors"
                            >
                              Verify Report
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setReviewModal({
                                  issue,
                                  decision: 'reject',
                                  approveAlert: false,
                                  note: '',
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        ) : issue.status === 'verified' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setStatusModal({
                                issue,
                                targetStatus: 'in_progress',
                                note: '',
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md transition-colors"
                          >
                            Dispatch Crew (In Progress)
                          </button>
                        ) : issue.status === 'in_progress' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setStatusModal({
                                issue,
                                targetStatus: 'resolved',
                                note: '',
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md transition-colors"
                          >
                            Mark Resolved
                          </button>
                        ) : issue.status === 'resolved' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setStatusModal({
                                issue,
                                targetStatus: 'in_progress',
                                note: '',
                              })
                            }
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 border rounded"
                          >
                            Reopen
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Rejected</span>
                        )}

                        <Link
                          to={`/admin/issues/${issue.id}`}
                          className="px-2 py-1 text-[11px] font-medium text-blue-600 hover:underline"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet List View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {issues.map((issue) => (
                <div key={issue.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-400">
                      #{issue.id.slice(-6)}
                    </span>
                    <StatusBadge status={issue.status} size="xs" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900">{issue.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <SeverityBadge severity={issue.severity} size="xs" />
                    <CategoryBadge category={issue.category} size="xs" />
                    <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      {getCampusZoneLabel(issue.location?.campusZone)}
                    </span>
                    {issue.isCampusWideAlert && (
                      <span className="text-[10px] font-bold text-rose-600 uppercase">
                        Alert Active
                      </span>
                    )}
                  </div>
                  <div className="pt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 truncate">{issue.location?.building}</span>
                    <div className="flex items-center gap-2">
                      {issue.status === 'reported' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setReviewModal({
                              issue,
                              decision: 'verify',
                              approveAlert: false,
                              note: '',
                            })
                          }
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded border border-emerald-200"
                        >
                          Verify
                        </button>
                      ) : issue.status === 'verified' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({
                              issue,
                              targetStatus: 'in_progress',
                              note: '',
                            })
                          }
                          className="px-2 py-1 bg-amber-50 text-amber-800 font-semibold rounded border border-amber-200"
                        >
                          Dispatch
                        </button>
                      ) : null}
                      <Link
                        to={`/admin/issues/${issue.id}`}
                        className="text-blue-600 font-semibold px-1"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => setPage((p) => p - 1)}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            <EmptyState
              title="No Issues Match Current Filters"
              description="No campus reports in the queue match your active filter criteria."
              action={
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-semibold"
                >
                  Clear All Filters
                </button>
              }
            />
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {reviewModal.decision === 'verify' ? 'Verify Campus Report' : 'Reject Campus Report'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Issue #{reviewModal.issue.id.slice(-6)}: "{reviewModal.issue.title}"
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              {reviewModal.decision === 'verify' && reviewModal.issue.campusAlertRequested && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-1.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewModal.approveAlert}
                      onChange={(e) =>
                        setReviewModal({
                          ...reviewModal,
                          approveAlert: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-purple-900 block">
                        Approve Official Campus-Wide Advisory
                      </span>
                      <span className="text-purple-700/80 text-[11px]">
                        Reporter requested emergency broadcast visibility across student dashboards.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution / Review Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewModal.note}
                  onChange={(e) =>
                    setReviewModal({ ...reviewModal, note: e.target.value })
                  }
                  placeholder="Add notes for operations dispatch or reasons for review decision..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 ${
                    reviewModal.decision === 'verify'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{reviewModal.decision === 'verify' ? 'Confirm Verify' : 'Confirm Reject'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Transition Maintenance Status
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Moving issue #{statusModal.issue.id.slice(-6)} to target status:{' '}
              <strong className="text-purple-700 uppercase">
                {statusModal.targetStatus.replace('_', ' ')}
              </strong>
            </p>

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Transition Note
                </label>
                <textarea
                  rows={3}
                  value={statusModal.note}
                  onChange={(e) =>
                    setStatusModal({ ...statusModal, note: e.target.value })
                  }
                  placeholder="Describe maintenance crew deployment, parts ordered, or resolution summary..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModal(null)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Apply Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
