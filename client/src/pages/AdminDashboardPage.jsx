import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import CategoryBadge from '../components/common/CategoryBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { adminAPI } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatRelativeTime } from '../utils/formatters.js';

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState({
    totalIssues: 0,
    openIssues: 0,
    criticalIssues: 0,
    pendingReview: 0,
    inProgress: 0,
    resolved: 0,
    activeAlerts: 0,
    rejectedIssues: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Filters & pagination
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
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
    } catch (err) {
      // Non-blocking stats error
    } finally {
      setStatsLoading(false);
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
  }, [page, filterStatus, filterSeverity, searchQuery]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-purple-700 text-white px-2 py-0.5 rounded">
              Verified Administrator
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {user?.name} ({user?.email})
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Estate & Campus Operations
          </h1>
          <p className="text-sm text-slate-500">
            Real-time management of campus maintenance review queue, alert authorizations, and lifecycle dispatch.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchStats();
            fetchIssues();
          }}
          disabled={issuesLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${issuesLoading ? 'animate-spin' : ''}`} />
          <span>Sync Operations</span>
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

      {/* Summary Cards (Database-Derived Numbers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Issues */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Open Reports</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {statsLoading ? '...' : stats.openIssues}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Awaiting admin verification</span>
        </div>

        {/* Critical Issues */}
        <div className="bg-white p-5 rounded-xl border border-rose-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Critical Hazards
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-700">
            {statsLoading ? '...' : stats.criticalIssues}
          </div>
          <span className="text-[11px] text-rose-600/80 mt-1 block">Priority immediate response</span>
        </div>

        {/* In Progress */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              In Progress
            </span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {statsLoading ? '...' : stats.inProgress}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Maintenance teams deployed</span>
        </div>

        {/* Active Alerts */}
        <div className="bg-white p-5 rounded-xl border border-purple-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
              Approved Alerts
            </span>
            <Megaphone className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-700">
            {statsLoading ? '...' : stats.activeAlerts}
          </div>
          <span className="text-[11px] text-purple-600/80 mt-1 block">Official campus broadcasts</span>
        </div>
      </div>

      {/* Review Queue Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Live Maintenance Review Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review student submissions, authorize emergency alerts, and manage resolution states.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
          </div>
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
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Alert Request</th>
                    <th className="py-3 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          to={`/issues/${issue.id}`}
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
                        <div className="text-[11px] text-slate-400">
                          {issue.location?.area || issue.location?.room || ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <SeverityBadge severity={issue.severity} size="xs" />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={issue.status} size="xs" />
                      </td>
                      <td className="py-3.5 px-4">
                        {issue.isCampusWideAlert ? (
                          <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            <Megaphone className="w-3 h-3" />
                            Alert Approved
                          </span>
                        ) : issue.campusAlertRequested ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            <Megaphone className="w-3 h-3 text-amber-600" />
                            Alert Requested
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Normal Report</span>
                        )}
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
                          to={`/issues/${issue.id}`}
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
                        to={`/issues/${issue.id}`}
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
            title="Review Queue Clear"
            description="No reports currently matching the administrative filters."
            action={
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('All');
                  setFilterSeverity('All');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Reset Filters
              </button>
            }
          />
        )}
      </div>

      {/* Admin Review Modal Dialog (Verify / Reject) */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {reviewModal.decision === 'verify' ? 'Verify Issue Report' : 'Reject Issue Report'}
              </h3>
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Report #{reviewModal.issue.id.slice(-6)}: "
              <strong>{reviewModal.issue.title}</strong>"
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
              {reviewModal.decision === 'verify' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="modal-approve-alert"
                      disabled={!reviewModal.issue.campusAlertRequested}
                      checked={reviewModal.approveAlert}
                      onChange={(e) =>
                        setReviewModal({ ...reviewModal, approveAlert: e.target.checked })
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <label
                        htmlFor="modal-approve-alert"
                        className="font-bold text-purple-900 cursor-pointer"
                      >
                        Approve Official Campus-Wide Alert Advisory
                      </label>
                      <p className="text-[11px] text-purple-700 mt-0.5">
                        {reviewModal.issue.campusAlertRequested
                          ? 'The student requested alert visibility. Checking this will broadcast an official advisory banner across all campus feeds.'
                          : 'Student did not request alert visibility. Alerts cannot be approved on this issue.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {reviewModal.decision === 'verify'
                    ? 'Reviewer Notes (Optional)'
                    : 'Reason for Rejection *'}
                </label>
                <textarea
                  rows={3}
                  value={reviewModal.note}
                  onChange={(e) =>
                    setReviewModal({ ...reviewModal, note: e.target.value })
                  }
                  placeholder={
                    reviewModal.decision === 'verify'
                      ? 'Add any operational instructions...'
                      : 'Explain why report was rejected (e.g. duplicate, non-campus matter)...'
                  }
                  className="w-full px-3 py-2 border rounded-lg text-slate-900"
                  required={reviewModal.decision === 'reject'}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  className="px-3.5 py-1.5 rounded-lg border text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`px-4 py-1.5 rounded-lg text-white font-semibold disabled:opacity-50 ${
                    reviewModal.decision === 'verify'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing
                    ? 'Processing...'
                    : reviewModal.decision === 'verify'
                    ? 'Confirm Verification'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Status Transition Modal Dialog */}
      {statusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Update Issue Status: #{statusModal.issue.id.slice(-6)}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Current Status: <strong>{statusModal.issue.status}</strong> → Next Status:{' '}
              <strong className="text-purple-700">{statusModal.targetStatus}</strong>
            </p>

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {statusModal.targetStatus === 'resolved'
                    ? 'Resolution Note (e.g. Work performed, parts replaced) *'
                    : 'Operational Note (Optional)'}
                </label>
                <textarea
                  rows={3}
                  value={statusModal.note}
                  onChange={(e) =>
                    setStatusModal({ ...statusModal, note: e.target.value })
                  }
                  placeholder="Describe resolution details or crew dispatch updates..."
                  className="w-full px-3 py-2 border rounded-lg text-slate-900"
                  required={statusModal.targetStatus === 'resolved'}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModal(null)}
                  className="px-3.5 py-1.5 rounded-lg border text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
