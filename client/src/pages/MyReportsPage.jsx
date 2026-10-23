import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import CategoryBadge from '../components/common/CategoryBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { issuesAPI } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatRelativeTime } from '../utils/formatters.js';

export default function MyReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const fetchMyReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: 10,
    };

    if (statusFilter !== 'All') {
      params.status = statusFilter.toLowerCase();
    }

    if (severityFilter !== 'All') {
      params.severity = severityFilter.toLowerCase();
    }

    try {
      const res = await issuesAPI.getMyIssues(params);
      if (res && res.data) {
        setReports(res.data.issues || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load your reports.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, severityFilter]);

  useEffect(() => {
    fetchMyReports();
  }, [fetchMyReports]);

  // Derived counts
  const resolvedCount = reports.filter((r) => r.status === 'resolved').length;
  const inProgressCount = reports.filter(
    (r) => r.status === 'in_progress' || r.status === 'verified'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Reports</h1>
          <p className="text-sm text-slate-500">
            Track and monitor resolution progress for issues submitted by your account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchMyReports}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh my reports"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/issues/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Report</span>
          </Link>
        </div>
      </div>

      {/* Authenticated Session Notice */}
      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-800">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold block mb-0.5">Authenticated Reporter Session</strong>
          Showing persistent submissions created by <strong>{user?.name}</strong> ({user?.email}).
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Reports Found
          </span>
          <span className="text-2xl font-bold text-slate-900">{pagination.total}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block mb-1">
            Verified / In Progress
          </span>
          <span className="text-2xl font-bold text-amber-700">{inProgressCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block mb-1">
            Successfully Resolved
          </span>
          <span className="text-2xl font-bold text-emerald-700">{resolvedCount}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Filter by:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="verified">Verified</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </select>
        </div>

        <span className="text-slate-400">
          Showing {reports.length} of {pagination.total} records
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold block mb-0.5">Failed to load reports</strong>
            <p>{error}</p>
            <button
              type="button"
              onClick={fetchMyReports}
              className="mt-2 text-xs font-semibold text-rose-700 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Reports List / Table */}
      {loading ? (
        <div className="min-h-[30vh] flex flex-col items-center justify-center gap-3 bg-white rounded-xl border border-slate-200 p-8">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">Fetching your submitted reports...</p>
        </div>
      ) : reports.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Issue Details</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 truncate">
                        {report.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-400">
                          #{report.id.slice(-6)}
                        </span>
                        <CategoryBadge category={report.category} size="xs" />
                        {report.campusAlertRequested && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                            Alert Req
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium text-slate-800">
                        {report.location?.building || 'Main Campus'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {report.location?.area || report.location?.room || ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <SeverityBadge severity={report.severity} size="xs" />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={report.status} size="xs" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {formatRelativeTime(report.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/issues/${report.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {reports.map((report) => (
              <div key={report.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-400">
                    #{report.id.slice(-6)}
                  </span>
                  <StatusBadge status={report.status} size="xs" />
                </div>
                <h3 className="font-semibold text-sm text-slate-900">{report.title}</h3>
                <div className="flex items-center gap-2 text-xs">
                  <SeverityBadge severity={report.severity} size="xs" />
                  <CategoryBadge category={report.category} size="xs" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-xs text-slate-500">
                  <span className="truncate">{report.location?.building}</span>
                  <Link
                    to={`/issues/${report.id}`}
                    className="font-semibold text-blue-600 inline-flex items-center gap-0.5"
                  >
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2.5 py-1 rounded border text-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1 rounded border text-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No Reports Submitted Yet"
          description="You have not submitted any campus reports matching the selected filters."
          action={
            <Link
              to="/issues/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Your First Report</span>
            </Link>
          }
        />
      )}
    </div>
  );
}
