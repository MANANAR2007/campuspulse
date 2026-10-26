import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  User,
  Shield,
  Megaphone,
  CheckCircle2,
  X,
  AlertTriangle,
  Loader2,
  Maximize2,
  AlertCircle,
  FileCheck,
  Wrench,
  Check,
  Users,
} from 'lucide-react';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import CategoryBadge from '../components/common/CategoryBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import StatusHistoryTimeline from '../components/issues/StatusHistoryTimeline.jsx';
import { adminAPI, getCampusZoneLabel } from '../services/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { formatRelativeTime } from '../utils/formatters.js';

export default function AdminIssueDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Review & Status Modals
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState('verify');
  const [approveAlert, setApproveAlert] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');

  // Image lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const fetchIssueDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAPI.getIssueById(id);
      if (res && res.data && res.data.issue) {
        setIssue(res.data.issue);
        setComments(res.data.comments || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load issue details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchIssueDetails();
  }, [fetchIssueDetails]);

  // Realtime updates for this issue
  useEffect(() => {
    if (!socket || !id) return;

    const handleIssueUpdated = ({ issueId, issue: updated }) => {
      if (issueId === id && updated) {
        setIssue((prev) => (prev ? { ...prev, ...updated } : updated));
      }
    };

    const handleStatusChanged = ({ issueId, issue: updated }) => {
      if (issueId === id && updated) {
        setIssue((prev) => (prev ? { ...prev, ...updated } : updated));
      }
    };

    const handleCommentCreated = ({ issueId, comment }) => {
      if (issueId === id && comment) {
        setComments((prev) => [...prev, comment]);
      }
    };

    socket.on('issue:updated', handleIssueUpdated);
    socket.on('issue:statusChanged', handleStatusChanged);
    socket.on('comment:created', handleCommentCreated);

    return () => {
      socket.off('issue:updated', handleIssueUpdated);
      socket.off('issue:statusChanged', handleStatusChanged);
      socket.off('comment:created', handleCommentCreated);
    };
  }, [socket, id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await adminAPI.reviewIssue(id, {
        decision: reviewDecision,
        approveCampusAlert: Boolean(approveAlert),
        resolutionNote: reviewNote.trim(),
      });
      setActionFeedback({
        type: 'success',
        message: `Report was successfully marked as ${
          reviewDecision === 'verify' ? 'Verified' : 'Rejected'
        }.`,
      });
      setReviewModalOpen(false);
      fetchIssueDetails();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to submit review decision.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!targetStatus) return;
    setIsProcessing(true);
    try {
      await adminAPI.updateStatus(id, {
        status: targetStatus,
        resolutionNote: statusNote.trim(),
      });
      setActionFeedback({
        type: 'success',
        message: `Issue lifecycle status updated to '${targetStatus}'.`,
      });
      setStatusModalOpen(false);
      fetchIssueDetails();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to update status.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Loading report details...
        </p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          title="Report Not Found"
          description={error || "The requested campus report could not be found."}
          actionLabel="Back to Admin Console"
          actionLink="/admin"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Back Nav & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Operations Overview</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            ID: #{issue.id?.slice(-8) || issue._id?.slice(-8)}
          </span>
          <StatusBadge status={issue.status} size="sm" />
          <SeverityBadge severity={issue.severity} size="sm" />
        </div>
      </div>

      {/* Action feedback banner */}
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
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Emergency Alert Status Banner */}
      {issue.isCampusWideAlert ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900">
          <Megaphone className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold text-sm">Official Campus-Wide Emergency Alert Active</strong>
            <p className="text-xs text-rose-700 mt-0.5">
              This issue has been approved as an urgent hazard advisory pinned to student feeds.
            </p>
          </div>
        </div>
      ) : issue.campusAlertRequested ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold text-sm">Emergency Alert Requested by Reporter</strong>
            <p className="text-xs text-amber-700 mt-0.5">
              The student flagged this problem as a campus-wide hazard. Admin verification required to approve alert.
            </p>
          </div>
        </div>
      ) : null}

      {/* Main Grid: Details + Admin Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Report Information (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CategoryBadge category={issue.category} size="sm" />
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">
                  Reported {formatRelativeTime(issue.createdAt)}
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 leading-snug">{issue.title}</h1>
            </div>

            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-100">
              {issue.description}
            </div>

            {/* Structured Campus Location */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-lg flex items-start gap-3">
              <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-slate-800">Campus Location Details:</span>
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-900">{issue.location?.building || 'Main Campus'}</span>
                  {issue.location?.area && <span> • Area: {issue.location.area}</span>}
                  {issue.location?.floor && <span> • Floor: {issue.location.floor}</span>}
                  {issue.location?.room && <span> • Room: {issue.location.room}</span>}
                </div>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                    Campus Zone: {getCampusZoneLabel(issue.location?.campusZone)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cloudinary Image Attachment */}
            {issue.imageUrl && (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-semibold text-slate-700">Attached Photographic Evidence:</span>
                <div className="relative group max-w-md rounded-lg overflow-hidden border border-slate-200">
                  <img
                    src={issue.imageUrl}
                    alt={issue.title}
                    className="w-full h-56 object-cover bg-slate-100 cursor-pointer"
                    onClick={() => setLightboxOpen(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>View Full Size</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Issue Lifecycle Timeline & Audit Trail */}
          <StatusHistoryTimeline
            statusHistory={issue.statusHistory}
            currentStatus={issue.status}
            createdAt={issue.createdAt}
            reporter={issue.createdBy}
          />

          {/* Read-Only Discussion Audit Feed */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Discussion Thread Audit</span>
              <span className="text-xs font-normal text-slate-500">
                ({comments.length} student {comments.length === 1 ? 'comment' : 'comments'})
              </span>
            </h2>

            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No comments have been posted to this report yet.</p>
            ) : (
              <div className="space-y-3 divide-y divide-slate-100">
                {comments.map((comment) => (
                  <div key={comment._id || comment.id} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-800">
                        {comment.author?.name || 'Student'}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                      {comment.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Administrative Operations Control (1 col) */}
        <div className="space-y-6">
          {/* Operations Decision Card */}
          <div className="bg-white rounded-xl border border-purple-200 shadow-xs p-5 space-y-4">
            <div className="border-b border-purple-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block mb-0.5">
                Staff Control
              </span>
              <h2 className="text-base font-bold text-slate-900">Administrative Actions</h2>
            </div>

            {/* Decision based on current status */}
            {issue.status === 'reported' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  This report is pending initial facilities verification.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('verify');
                      setApproveAlert(Boolean(issue.campusAlertRequested));
                      setReviewModalOpen(true);
                    }}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Verify Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('reject');
                      setApproveAlert(false);
                      setReviewModalOpen(true);
                    }}
                    className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-600">
                  <span>Current Lifecycle: </span>
                  <strong className="text-slate-900 uppercase font-mono">{issue.status}</strong>
                </div>

                {issue.status === 'verified' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetStatus('in_progress');
                      setStatusModalOpen(true);
                    }}
                    className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Dispatch Maintenance (In Progress)</span>
                  </button>
                )}

                {issue.status === 'in_progress' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetStatus('resolved');
                      setStatusModalOpen(true);
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Issue Resolved</span>
                  </button>
                )}

                {issue.status === 'resolved' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetStatus('in_progress');
                      setStatusModalOpen(true);
                    }}
                    className="w-full py-2 px-3 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg text-xs transition-colors"
                  >
                    Reopen for Additional Maintenance
                  </button>
                )}
              </div>
            )}

            {/* Reporter metadata */}
            <div className="pt-3 border-t border-slate-100 text-xs space-y-2 text-slate-500">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Submitted by: <strong className="text-slate-700">{issue.createdBy?.name || 'Student'}</strong>
                </span>
              </div>
              <div className="text-[11px] text-slate-400 pl-5">
                {issue.createdBy?.email} • {issue.createdBy?.department || 'Department N/A'}
              </div>
              <div className="pt-1 text-[11px]">
                <span>Community impact: </span>
                <strong className="text-slate-800">{issue.confirmationCount || 0} students</strong> affirmed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Decision Modal */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {reviewDecision === 'verify' ? 'Confirm Issue Verification' : 'Reject Issue Report'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {reviewDecision === 'verify'
                ? 'Verifying confirms this problem is genuine and queues it for facility operations.'
                : 'Rejecting hides this report from normal student feeds.'}
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              {reviewDecision === 'verify' && issue.campusAlertRequested && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="approveAlertCheck"
                    checked={approveAlert}
                    onChange={(e) => setApproveAlert(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="approveAlertCheck" className="text-xs text-amber-900 font-medium cursor-pointer">
                    Approve Official Campus-Wide Alert (Immediately pins red hazard banner to student feeds)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Electrician team dispatched to Block B."
                  className="w-full text-xs p-2.5 border rounded-lg border-slate-300 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 ${
                    reviewDecision === 'verify' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Decision</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Transition Lifecycle Status
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating status to <strong className="uppercase font-mono text-purple-700">{targetStatus}</strong>.
            </p>

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution / Progress Note
                </label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Describe maintenance action taken or current progress..."
                  className="w-full text-xs p-2.5 border rounded-lg border-slate-300 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Transition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxOpen && issue.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh]">
            <img
              src={issue.imageUrl}
              alt={issue.title}
              className="max-h-[85vh] mx-auto object-contain rounded-lg"
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
