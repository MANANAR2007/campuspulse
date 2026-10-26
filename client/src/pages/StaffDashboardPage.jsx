import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  MapPin,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  FileText,
  Lock,
  ChevronRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { staffAPI, ISSUE_PRIORITIES } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../utils/formatters.js';

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const [queues, setQueues] = useState({
    assignedToMe: [],
    departmentQueue: [],
    inProgress: [],
    awaitingInfo: [],
    overdue: [],
    resolvedRecent: [],
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assigned');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [statusForm, setStatusForm] = useState({
    status: '',
    resolutionNote: '',
    resolutionEvidenceUrl: '',
    internalNote: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [queueRes, statsRes] = await Promise.all([
        staffAPI.getQueue(),
        staffAPI.getStats(),
      ]);
      if (queueRes?.data) setQueues(queueRes.data);
      if (statsRes?.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load staff work queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenStatusModal = (issue, defaultStatus = '') => {
    setSelectedIssue(issue);
    setStatusForm({
      status: defaultStatus || (issue.status === 'reported' || issue.status === 'verified' ? 'in_progress' : issue.status),
      resolutionNote: issue.resolutionNote || '',
      resolutionEvidenceUrl: issue.resolutionEvidenceUrl || '',
      internalNote: '',
    });
    setFormError(null);
    setStatusModalOpen(true);
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIssue || !statusForm.status) return;

    try {
      setSubmitting(true);
      setFormError(null);
      await staffAPI.updateStatus(selectedIssue._id || selectedIssue.id, {
        status: statusForm.status,
        resolutionNote: statusForm.resolutionNote,
        resolutionEvidenceUrl: statusForm.resolutionEvidenceUrl,
        internalNote: statusForm.internalNote,
      });
      setStatusModalOpen(false);
      setSelectedIssue(null);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to update issue status');
    } finally {
      setSubmitting(false);
    }
  };

  // Get active list based on selected tab
  const getActiveList = () => {
    switch (activeTab) {
      case 'assigned':
        return queues.assignedToMe || [];
      case 'dept':
        return queues.departmentQueue || [];
      case 'in_progress':
        return queues.inProgress || [];
      case 'awaiting_info':
        return queues.awaitingInfo || [];
      case 'overdue':
        return queues.overdue || [];
      case 'resolved':
        return queues.resolvedRecent || [];
      default:
        return [];
    }
  };

  const activeIssues = getActiveList();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Department Operations
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {user?.departmentName || 'General Staff'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Staff Work Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage assigned campus tickets, record maintenance updates, and resolve service requests.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('assigned')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'assigned'
              ? 'bg-amber-500/10 border-amber-500 shadow-sm ring-1 ring-amber-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Assigned to Me
            </span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900 block">
            {stats?.assignedCount ?? queues.assignedToMe?.length ?? 0}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Active tasks</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dept')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'dept'
              ? 'bg-blue-500/10 border-blue-500 shadow-sm ring-1 ring-blue-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Dept Queue
            </span>
            <Inbox className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900 block">
            {stats?.deptUnassignedCount ?? queues.departmentQueue?.length ?? 0}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Unassigned</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('in_progress')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'in_progress'
              ? 'bg-indigo-500/10 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              In Progress
            </span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900 block">
            {stats?.inProgressCount ?? queues.inProgress?.length ?? 0}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Active work</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('awaiting_info')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'awaiting_info'
              ? 'bg-purple-500/10 border-purple-500 shadow-sm ring-1 ring-purple-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Awaiting Info
            </span>
            <HelpCircle className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900 block">
            {stats?.awaitingInfoCount ?? queues.awaitingInfo?.length ?? 0}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Needs clarification</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'overdue'
              ? 'bg-rose-500/10 border-rose-500 shadow-sm ring-1 ring-rose-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Overdue SLA
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-2xl font-bold text-rose-600 block">
            {stats?.overdueCount ?? queues.overdue?.length ?? 0}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Past deadline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resolved')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'resolved'
              ? 'bg-emerald-500/10 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Resolved (7d)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-bold text-emerald-600 block">
            {stats?.resolvedTotal ?? queues.resolvedRecent?.length ?? 0}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Completed</span>
        </button>
      </div>

      {/* Issues Queue List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 capitalize">
              {activeTab === 'assigned' && 'Assigned to Me'}
              {activeTab === 'dept' && 'Department Unassigned Queue'}
              {activeTab === 'in_progress' && 'In Progress Tasks'}
              {activeTab === 'awaiting_info' && 'Awaiting Information'}
              {activeTab === 'overdue' && 'Overdue Issues'}
              {activeTab === 'resolved' && 'Recently Resolved'}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
              {activeIssues.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-medium">Loading department queue...</span>
          </div>
        ) : activeIssues.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
            <Inbox className="w-10 h-10 stroke-[1.5]" />
            <h3 className="font-semibold text-sm text-slate-700">No issues in this queue</h3>
            <p className="text-xs text-slate-400">All tasks in this category are up to date.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeIssues.map((issue) => {
              const isOverdue =
                issue.resolutionDeadline &&
                new Date() > new Date(issue.resolutionDeadline) &&
                !['resolved', 'rejected'].includes(issue.status);

              return (
                <div
                  key={issue._id || issue.id}
                  className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority tag */}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          issue.priority === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : issue.priority === 'high'
                            ? 'bg-amber-100 text-amber-800'
                            : issue.priority === 'low'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {issue.priority || 'NORMAL'}
                      </span>

                      {/* Status tag */}
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                        {issue.status.replace('_', ' ')}
                      </span>

                      {/* Visibility badge */}
                      {issue.visibility === 'confidential' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Confidential
                        </span>
                      )}

                      {issue.visibility === 'department_only' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          Dept Only
                        </span>
                      )}

                      {/* SLA Overdue badge */}
                      {isOverdue && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-600 text-white flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Overdue SLA
                        </span>
                      )}

                      <span className="text-xs text-slate-400 capitalize">
                        {issue.category.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {issue.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      {issue.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {issue.location?.building}
                          {issue.location?.area ? ` • ${issue.location.area}` : ''}
                        </span>
                      </div>

                      {issue.resolutionDeadline && (
                        <div
                          className={`flex items-center gap-1 ${
                            isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Due: {formatDate(issue.resolutionDeadline)}</span>
                        </div>
                      )}

                      {issue.assignedTo && (
                        <span className="text-slate-600">
                          Assigned: <strong className="font-semibold">{issue.assignedTo.name}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Primary Status action button */}
                    {issue.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal(issue)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-xs"
                      >
                        Update / Resolve
                      </button>
                    )}

                    <Link
                      to={`/issues/${issue._id || issue.id}`}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <span>Details</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Staff Status Transition & Resolution Modal */}
      {statusModalOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Update Issue Status
            </h3>
            <p className="text-xs text-slate-500 mb-4 line-clamp-1">
              {selectedIssue.title}
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Status
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium"
                >
                  <option value="in_progress">In Progress (Work started)</option>
                  <option value="awaiting_info">Awaiting Info (Need student response)</option>
                  <option value="resolved">Resolved (Work completed)</option>
                  <option value="escalated">Escalate to Admin</option>
                </select>
              </div>

              {statusForm.status === 'resolved' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Resolution Note / Action Taken
                    </label>
                    <textarea
                      rows={3}
                      value={statusForm.resolutionNote}
                      onChange={(e) => setStatusForm({ ...statusForm, resolutionNote: e.target.value })}
                      placeholder="Explain how the issue was fixed or addressed..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Resolution Evidence Photo URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={statusForm.resolutionEvidenceUrl}
                      onChange={(e) => setStatusForm({ ...statusForm, resolutionEvidenceUrl: e.target.value })}
                      placeholder="https://example.com/repair-photo.jpg"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Internal Staff Note (Confidential to Staff/Admin)
                </label>
                <textarea
                  rows={2}
                  value={statusForm.internalNote}
                  onChange={(e) => setStatusForm({ ...statusForm, internalNote: e.target.value })}
                  placeholder="Private internal remark (never seen by student)..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors inline-flex items-center gap-1.5 shadow-xs disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
