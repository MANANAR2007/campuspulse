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
  Building2,
  Lock,
  ArrowRight,
  Send,
  Calendar,
  History,
} from 'lucide-react';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import CategoryBadge from '../components/common/CategoryBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import StatusHistoryTimeline from '../components/issues/StatusHistoryTimeline.jsx';
import {
  adminAPI,
  departmentsAPI,
  commentsAPI,
  getCampusZoneLabel,
  ISSUE_VISIBILITIES,
  ISSUE_PRIORITIES,
} from '../services/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { formatRelativeTime, formatDate } from '../utils/formatters.js';

export default function AdminIssueDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Departments & Staff cache
  const [departments, setDepartments] = useState([]);
  const [deptStaffList, setDeptStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // Review & Status Modals
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState('verify');
  const [approveAlert, setApproveAlert] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');

  // Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    department: '',
    assignedTo: '',
    assignmentNote: '',
    priority: 'normal',
    responseDeadline: '',
    resolutionDeadline: '',
  });

  // Redirection Modal
  const [redirectModalOpen, setRedirectModalOpen] = useState(false);
  const [redirectForm, setRedirectForm] = useState({
    newDepartment: '',
    assignedTo: '',
    reason: '',
  });

  // Visibility Modal
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const [visibilityForm, setVisibilityForm] = useState({
    visibility: 'public',
    reason: '',
    confirmPublic: false,
  });

  // Internal vs Public Commenting
  const [commentText, setCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

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

  // Load departments list
  useEffect(() => {
    departmentsAPI
      .getAll({ includeInactive: true })
      .then((res) => {
        if (res?.data?.departments) setDepartments(res.data.departments);
      })
      .catch(() => {});
  }, []);

  // Fetch staff when department changes in assign form
  const handleDepartmentChange = async (deptId) => {
    setAssignForm((prev) => ({ ...prev, department: deptId, assignedTo: '' }));
    if (!deptId) {
      setDeptStaffList([]);
      return;
    }
    try {
      setStaffLoading(true);
      const res = await departmentsAPI.getStaff(deptId);
      if (res?.data?.staff) {
        setDeptStaffList(res.data.staff);
      }
    } catch {
      setDeptStaffList([]);
    } finally {
      setStaffLoading(false);
    }
  };

  // Open Assign Modal
  const handleOpenAssignModal = () => {
    const currentDeptId = issue.department?._id || issue.department || '';
    setAssignForm({
      department: currentDeptId,
      assignedTo: issue.assignedTo?._id || issue.assignedTo || '',
      assignmentNote: issue.assignmentNote || '',
      priority: issue.priority || 'normal',
      responseDeadline: issue.responseDeadline ? new Date(issue.responseDeadline).toISOString().slice(0, 16) : '',
      resolutionDeadline: issue.resolutionDeadline ? new Date(issue.resolutionDeadline).toISOString().slice(0, 16) : '',
    });
    if (currentDeptId) {
      handleDepartmentChange(currentDeptId);
    }
    setAssignModalOpen(true);
  };

  // Submit Assignment
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignForm.department) return;
    setIsProcessing(true);
    try {
      const res = await adminAPI.assignIssue(id, assignForm);
      if (res?.data?.issue) setIssue(res.data.issue);
      setAssignModalOpen(false);
      setActionFeedback({ type: 'success', message: 'Issue assigned successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to assign issue.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Open Redirect Modal
  const handleOpenRedirectModal = () => {
    setRedirectForm({
      newDepartment: '',
      assignedTo: '',
      reason: '',
    });
    setDeptStaffList([]);
    setRedirectModalOpen(true);
  };

  // Submit Redirection
  const handleRedirectSubmit = async (e) => {
    e.preventDefault();
    if (!redirectForm.newDepartment || redirectForm.reason.trim().length < 5) return;
    setIsProcessing(true);
    try {
      const res = await adminAPI.redirectIssue(id, redirectForm);
      if (res?.data?.issue) setIssue(res.data.issue);
      setRedirectModalOpen(false);
      setActionFeedback({ type: 'success', message: 'Issue redirected successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to redirect issue.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Unassign issue
  const handleUnassign = async () => {
    if (!window.confirm('Return this issue to the department unassigned queue?')) return;
    setIsProcessing(true);
    try {
      const res = await adminAPI.unassignIssue(id, { reason: 'Unassigned by administrator' });
      if (res?.data?.issue) setIssue(res.data.issue);
      setActionFeedback({ type: 'success', message: 'Issue returned to department queue.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to unassign issue.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Visibility Change
  const handleVisibilitySubmit = async (e) => {
    e.preventDefault();
    if (visibilityForm.reason.trim().length < 5) return;
    setIsProcessing(true);
    try {
      const res = await adminAPI.updateVisibility(id, visibilityForm);
      if (res?.data?.issue) setIssue(res.data.issue);
      setVisibilityModalOpen(false);
      setActionFeedback({ type: 'success', message: 'Visibility updated successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to update visibility.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Post Admin Comment (Supports Internal Staff Notes)
  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const res = await commentsAPI.createComment(id, {
        text: commentText.trim(),
        isInternal: isInternalComment,
      });
      if (res?.data?.comment) {
        setComments((prev) => [...prev, res.data.comment]);
        setCommentText('');
      }
    } catch (err) {
      alert(err.message || 'Failed to post note.');
    } finally {
      setCommentSubmitting(false);
    }
  };

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

          {/* Department Assignment & Redirection History */}
          {issue.assignmentHistory && issue.assignmentHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <History className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Routing & Assignment Audit History
                </h2>
              </div>
              <div className="space-y-3 divide-y divide-slate-100">
                {issue.assignmentHistory.map((entry, idx) => (
                  <div key={idx} className="pt-3 first:pt-0 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold capitalize px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                        {entry.action}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>
                    <div className="text-slate-700 font-medium">
                      {entry.previousDepartment?.name || 'None'} →{' '}
                      <strong>{entry.newDepartment?.name || 'None'}</strong>
                      {entry.newAssignee && (
                        <span className="text-slate-500 ml-1">
                          (Staff: {entry.newAssignee.name})
                        </span>
                      )}
                    </div>
                    {entry.reason && (
                      <p className="text-slate-500 text-[11px] italic">
                        Reason: "{entry.reason}"
                      </p>
                    )}
                    <div className="text-[10px] text-slate-400">
                      Logged by {entry.changedBy?.name || 'Admin'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discussion & Internal Staff Notes Feed */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Discussion Thread & Staff Notes</span>
              <span className="text-xs font-normal text-slate-500">
                ({comments.length} total)
              </span>
            </h2>

            {/* Comment input form for Admin */}
            <form onSubmit={handleCreateComment} className="space-y-3 pb-3 border-b border-slate-100">
              <textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Post an administrative update or internal staff remark..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-500"
              />
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-800 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200">
                  <input
                    type="checkbox"
                    checked={isInternalComment}
                    onChange={(e) => setIsInternalComment(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Internal Staff Note (Hidden from students)</span>
                </label>
                <button
                  type="submit"
                  disabled={commentSubmitting || !commentText.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {commentSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  <span>Post Note</span>
                </button>
              </div>
            </form>

            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No notes or comments have been posted yet.</p>
            ) : (
              <div className="space-y-3 divide-y divide-slate-100">
                {comments.map((comment) => (
                  <div
                    key={comment._id || comment.id}
                    className={`pt-3 first:pt-0 ${
                      comment.isInternal ? 'p-3 rounded-xl bg-purple-50/70 border border-purple-200/80' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">
                          {comment.author?.name || 'User'}
                        </span>
                        {comment.author?.role === 'admin' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                            Admin
                          </span>
                        )}
                        {comment.author?.role === 'staff' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            Staff
                          </span>
                        )}
                        {comment.isInternal && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            Internal Staff Note
                          </span>
                        )}
                      </div>
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
          {/* Department & Staff Operations Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block mb-0.5">
                  Operations Routing
                </span>
                <h2 className="text-base font-bold text-slate-900">Department Routing</h2>
              </div>
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                  Assigned Department
                </span>
                <div className="font-bold text-slate-900 text-sm">
                  {issue.department?.name || (
                    <span className="text-rose-600 italic">Unassigned (Awaiting Department)</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                  Assigned Staff Specialist
                </span>
                <div className="font-semibold text-slate-800">
                  {issue.assignedTo?.name ? (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{issue.assignedTo.name}</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Department Work Queue (Unclaimed)</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                    Priority
                  </span>
                  <span className="font-bold text-slate-900 capitalize px-2 py-0.5 rounded bg-slate-100 inline-block">
                    {issue.priority || 'Normal'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                    Visibility Tier
                  </span>
                  <span
                    className={`font-bold capitalize px-2 py-0.5 rounded inline-block ${
                      issue.visibility === 'confidential'
                        ? 'bg-purple-100 text-purple-800'
                        : issue.visibility === 'department_only'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {issue.visibility || 'Public'}
                  </span>
                </div>
              </div>

              {issue.resolutionDeadline && (
                <div className="pt-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                    Target SLA Due Date
                  </span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatDate(issue.resolutionDeadline)}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Routing Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleOpenAssignModal}
                className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{issue.department ? 'Reassign / Update SLA' : 'Assign Department & Staff'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOpenRedirectModal}
                  className="py-1.5 px-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                >
                  Redirect Dept
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVisibilityForm({
                      visibility: issue.visibility || 'public',
                      reason: '',
                      confirmPublic: false,
                    });
                    setVisibilityModalOpen(true);
                  }}
                  className="py-1.5 px-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                >
                  Set Visibility
                </button>
              </div>

              {issue.assignedTo && (
                <button
                  type="button"
                  onClick={handleUnassign}
                  className="w-full py-1 text-slate-500 hover:text-slate-800 text-[11px] underline"
                >
                  Return to department queue (unassign)
                </button>
              )}
            </div>
          </div>
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

      {/* Assignment & Routing Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Assign Department & Staff Specialist
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Route this issue to a specialized maintenance team and establish SLA deadlines.
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Responsible Department *
                </label>
                <select
                  required
                  value={assignForm.department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200 font-medium"
                >
                  <option value="">Select Department...</option>
                  {departments
                    .filter((d) => d.isActive !== false)
                    .map((dept) => (
                      <option key={dept.id || dept._id} value={dept.id || dept._id}>
                        {dept.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Staff Specialist (Optional)
                </label>
                <select
                  value={assignForm.assignedTo}
                  disabled={!assignForm.department || staffLoading}
                  onChange={(e) => setAssignForm({ ...assignForm, assignedTo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200 font-medium disabled:opacity-60"
                >
                  <option value="">Leave in Department Work Queue (Unassigned)</option>
                  {deptStaffList.map((staff) => (
                    <option key={staff.id || staff._id} value={staff.id || staff._id}>
                      {staff.name} ({staff.activeIssuesCount ?? 0} active tickets)
                    </option>
                  ))}
                </select>
                {staffLoading && (
                  <span className="text-[11px] text-purple-600 block mt-1">Loading department staff...</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={assignForm.priority}
                    onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-200 font-medium"
                  >
                    {ISSUE_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Resolution Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={assignForm.resolutionDeadline}
                    onChange={(e) => setAssignForm({ ...assignForm, resolutionDeadline: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assignment Note / Directives
                </label>
                <textarea
                  rows={2}
                  value={assignForm.assignmentNote}
                  onChange={(e) => setAssignForm({ ...assignForm, assignmentNote: e.target.value })}
                  placeholder="Instructions for the assigned team..."
                  className="w-full px-3 py-2 border rounded-xl border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !assignForm.department}
                  className="px-4 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redirection Modal */}
      {redirectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Redirect Issue to Another Department
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              If this report was routed incorrectly, select the correct department. A reason is required and will be logged in the audit trail.
            </p>

            <form onSubmit={handleRedirectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Department *
                </label>
                <select
                  required
                  value={redirectForm.newDepartment}
                  onChange={(e) => setRedirectForm({ ...redirectForm, newDepartment: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200 font-medium"
                >
                  <option value="">Select New Department...</option>
                  {departments
                    .filter((d) => d.isActive !== false && (d.id || d._id) !== (issue.department?._id || issue.department))
                    .map((dept) => (
                      <option key={dept.id || dept._id} value={dept.id || dept._id}>
                        {dept.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Redirection * (min 5 characters)
                </label>
                <textarea
                  rows={3}
                  required
                  value={redirectForm.reason}
                  onChange={(e) => setRedirectForm({ ...redirectForm, reason: e.target.value })}
                  placeholder="e.g. Issue involves electrical wiring, not plumbing fixtures..."
                  className="w-full px-3 py-2 border rounded-xl border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRedirectModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !redirectForm.newDepartment || redirectForm.reason.trim().length < 5}
                  className="px-4 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Redirection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visibility Modal */}
      {visibilityModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Modify Issue Visibility Tier
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Set report confidentiality level. All changes are logged to the platform audit trail.
            </p>

            <form onSubmit={handleVisibilitySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Visibility Tier
                </label>
                <select
                  value={visibilityForm.visibility}
                  onChange={(e) => setVisibilityForm({ ...visibilityForm, visibility: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200 font-medium"
                >
                  {ISSUE_VISIBILITIES.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {visibilityForm.visibility === 'public' && issue.visibility !== 'public' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900">
                  <input
                    type="checkbox"
                    id="confirmPublicCheck"
                    required
                    checked={visibilityForm.confirmPublic}
                    onChange={(e) => setVisibilityForm({ ...visibilityForm, confirmPublic: e.target.checked })}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="confirmPublicCheck" className="text-xs font-medium cursor-pointer">
                    I confirm that this report does not contain private or sensitive personal information and is safe for campus-wide visibility.
                  </label>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Visibility Modification * (min 5 characters)
                </label>
                <textarea
                  rows={3}
                  required
                  value={visibilityForm.reason}
                  onChange={(e) => setVisibilityForm({ ...visibilityForm, reason: e.target.value })}
                  placeholder="e.g. Sensitivity resolved, public notice needed..."
                  className="w-full px-3 py-2 border rounded-xl border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVisibilityModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isProcessing ||
                    visibilityForm.reason.trim().length < 5 ||
                    (visibilityForm.visibility === 'public' && issue.visibility !== 'public' && !visibilityForm.confirmPublic)
                  }
                  className="px-4 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Visibility</span>
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
