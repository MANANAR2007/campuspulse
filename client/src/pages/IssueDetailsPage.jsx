import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  User,
  Users,
  MessageSquare,
  Megaphone,
  Check,
  Edit3,
  Trash2,
  AlertCircle,
  Loader2,
  Shield,
  Info,
  CheckCircle2,
  X,
  Send,
  UploadCloud,
  Maximize2,
  CornerDownRight,
} from 'lucide-react';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import CategoryBadge from '../components/common/CategoryBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import StatusHistoryTimeline from '../components/issues/StatusHistoryTimeline.jsx';
import { issuesAPI, commentsAPI, getCampusZoneLabel } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { formatRelativeTime } from '../utils/formatters.js';

export default function IssueDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinIssueRoom, leaveIssueRoom } = useSocket();
  const editFileInputRef = useRef(null);

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit modal / form states
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editSelectedImage, setEditSelectedImage] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Delete modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Community Affirmation ("Affects Me Too")
  const [hasVoted, setHasVoted] = useState(false);
  const [affectedCount, setAffectedCount] = useState(0);
  const [isVoting, setIsVoting] = useState(false);

  // Image lightbox preview
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Comments states
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentActionLoading, setCommentActionLoading] = useState(false);

  // Load Issue Details
  const fetchIssue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await issuesAPI.getById(id);
      if (res && res.data && res.data.issue) {
        const issueData = res.data.issue;
        setIssue(issueData);
        setHasVoted(Boolean(issueData.currentUserConfirmed));
        setAffectedCount(issueData.confirmationCount || 0);

        setEditFormData({
          title: issueData.title,
          description: issueData.description,
          category: issueData.category,
          severity: issueData.severity,
          building: issueData.location?.building || '',
          area: issueData.location?.area || '',
          floor: issueData.location?.floor || '',
          room: issueData.location?.room || '',
          campusAlertRequested: Boolean(issueData.campusAlertRequested),
        });
        setRemoveExistingImage(false);
        setEditSelectedImage(null);
        setEditImagePreview(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load issue report.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load Issue Comments
  const fetchComments = useCallback(async () => {
    try {
      setCommentsLoading(true);
      const res = await commentsAPI.getComments(id);
      if (res?.data?.comments) {
        setComments(res.data.comments);
      }
    } catch (err) {
      // Non-blocking comments load error
      console.warn('Comments fetch failed:', err.message);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchIssue();
    fetchComments();
  }, [fetchIssue, fetchComments]);

  // Realtime Socket.IO room subscription and event listeners
  useEffect(() => {
    if (!id) return;

    // Join room for this specific issue
    joinIssueRoom(id);

    if (!socket) {
      return () => {
        leaveIssueRoom(id);
      };
    }

    const handleCommentCreated = ({ issueId, comment }) => {
      if (issueId === id && comment) {
        setComments((prev) => {
          const exists = prev.some((c) => (c.id || c._id) === (comment.id || comment._id));
          return exists ? prev : [...prev, comment];
        });
      }
    };

    const handleCommentUpdated = ({ issueId, comment }) => {
      if (issueId === id && comment) {
        setComments((prev) =>
          prev.map((c) =>
            (c.id || c._id) === (comment.id || comment._id) ? comment : c
          )
        );
      }
    };

    const handleCommentDeleted = ({ issueId, commentId }) => {
      if (issueId === id && commentId) {
        setComments((prev) => prev.filter((c) => (c.id || c._id) !== commentId));
      }
    };

    const handleConfirmationUpdated = (payload) => {
      if (payload.issueId === id && typeof payload.confirmationCount === 'number') {
        setAffectedCount(payload.confirmationCount);
      }
    };

    const handleStatusChanged = (payload) => {
      if (payload.issueId === id && payload.issue) {
        setIssue((prev) => ({ ...prev, ...payload.issue }));
      }
    };

    const handleIssueUpdated = (payload) => {
      if (payload.issueId === id && payload.issue) {
        setIssue((prev) => ({ ...prev, ...payload.issue }));
      }
    };

    socket.on('comment:created', handleCommentCreated);
    socket.on('comment:updated', handleCommentUpdated);
    socket.on('comment:deleted', handleCommentDeleted);
    socket.on('confirmation:updated', handleConfirmationUpdated);
    socket.on('issue:statusChanged', handleStatusChanged);
    socket.on('issue:updated', handleIssueUpdated);

    return () => {
      leaveIssueRoom(id);
      socket.off('comment:created', handleCommentCreated);
      socket.off('comment:updated', handleCommentUpdated);
      socket.off('comment:deleted', handleCommentDeleted);
      socket.off('confirmation:updated', handleConfirmationUpdated);
      socket.off('issue:statusChanged', handleStatusChanged);
      socket.off('issue:updated', handleIssueUpdated);
    };
  }, [id, socket, joinIssueRoom, leaveIssueRoom]);

  // Clean up edit preview object URL
  useEffect(() => {
    return () => {
      if (editImagePreview) {
        URL.revokeObjectURL(editImagePreview);
      }
    };
  }, [editImagePreview]);

  // Ownership check
  const isAuthor =
    user &&
    issue &&
    (issue.createdBy?._id === user.id ||
      issue.createdBy?.id === user.id ||
      issue.createdBy === user.id);

  const canEditOrDelete = isAuthor && issue?.status === 'reported';

  // Handle "Affects Me Too" Click
  const handleAffectsMeClick = async () => {
    if (isVoting) return;

    const previousVoted = hasVoted;
    const previousCount = affectedCount;

    // Optimistic toggle
    const newVoted = !previousVoted;
    const newCount = newVoted ? previousCount + 1 : Math.max(0, previousCount - 1);

    setHasVoted(newVoted);
    setAffectedCount(newCount);
    setIsVoting(true);

    try {
      if (newVoted) {
        const res = await issuesAPI.confirm(id);
        if (res?.data) {
          setAffectedCount(res.data.confirmationCount);
          setHasVoted(res.data.currentUserConfirmed);
        }
      } else {
        const res = await issuesAPI.unconfirm(id);
        if (res?.data) {
          setAffectedCount(res.data.confirmationCount);
          setHasVoted(res.data.currentUserConfirmed);
        }
      }
    } catch (err) {
      // Rollback on failure
      setHasVoted(previousVoted);
      setAffectedCount(previousCount);
    } finally {
      setIsVoting(false);
    }
  };

  // Handle Edit submission (supporting image replacement/removal)
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);

    try {
      let res;

      if (editSelectedImage) {
        // Send as FormData with new replacement image
        const formData = new FormData();
        formData.append('title', editFormData.title.trim());
        formData.append('description', editFormData.description.trim());
        formData.append('category', editFormData.category);
        formData.append('severity', editFormData.severity);
        formData.append(
          'location',
          JSON.stringify({
            building: editFormData.building.trim(),
            area: editFormData.area.trim(),
            floor: editFormData.floor.trim(),
            room: editFormData.room.trim(),
          })
        );
        formData.append(
          'campusAlertRequested',
          editFormData.campusAlertRequested ? 'true' : 'false'
        );
        formData.append('image', editSelectedImage);

        res = await issuesAPI.update(id, formData);
      } else {
        const payload = {
          title: editFormData.title.trim(),
          description: editFormData.description.trim(),
          category: editFormData.category,
          severity: editFormData.severity,
          location: {
            building: editFormData.building.trim(),
            area: editFormData.area.trim(),
            floor: editFormData.floor.trim(),
            room: editFormData.room.trim(),
          },
          campusAlertRequested: Boolean(editFormData.campusAlertRequested),
        };

        if (removeExistingImage) {
          payload.removeImage = true;
        }

        res = await issuesAPI.update(id, payload);
      }

      if (res && res.data && res.data.issue) {
        setIssue(res.data.issue);
        setIsEditing(false);
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to update issue.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete execution
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await issuesAPI.delete(id);
      navigate('/', { replace: true });
    } catch (err) {
      alert(err.message || 'Failed to delete report.');
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Comment Handlers
  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || commentSubmitting) return;

    setCommentSubmitting(true);
    setCommentError(null);

    try {
      const res = await commentsAPI.createComment(id, { text: commentText.trim() });
      if (res?.data?.comment) {
        setComments((prev) => [...prev, res.data.comment]);
        setCommentText('');
      }
    } catch (err) {
      setCommentError(err.message || 'Failed to post comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id || comment._id);
    setEditingCommentText(comment.text);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditComment = async (commentId) => {
    if (!editingCommentText.trim() || commentActionLoading) return;

    setCommentActionLoading(true);
    try {
      const res = await commentsAPI.updateComment(commentId, {
        text: editingCommentText.trim(),
      });
      if (res?.data?.comment) {
        setComments((prev) =>
          prev.map((c) =>
            (c.id || c._id) === commentId ? res.data.comment : c
          )
        );
        setEditingCommentId(null);
        setEditingCommentText('');
      }
    } catch (err) {
      alert(err.message || 'Failed to update comment.');
    } finally {
      setCommentActionLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    setCommentActionLoading(true);
    try {
      await commentsAPI.deleteComment(commentId);
      setComments((prev) =>
        prev.filter((c) => (c.id || c._id) !== commentId)
      );
    } catch (err) {
      alert(err.message || 'Failed to delete comment.');
    } finally {
      setCommentActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-medium text-slate-500">Loading issue details from database...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <EmptyState
        title="Issue Report Not Found"
        description={error || 'The requested issue report does not exist or may have been removed.'}
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Campus Feed</span>
          </Link>
        }
      />
    );
  }

  const building = issue.location?.building || 'Main Campus';
  const specificArea = [
    issue.location?.area,
    issue.location?.floor,
    issue.location?.room,
  ]
    .filter(Boolean)
    .join(' • ');

  const authorName = issue.createdBy?.name || 'Campus Student';
  const authorDept = issue.createdBy?.department || 'Student Reporter';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation & Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Affects Me Too Button */}
          <button
            type="button"
            onClick={handleAffectsMeClick}
            disabled={isVoting}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              hasVoted
                ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-500/20'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            } ${isVoting ? 'opacity-70 cursor-wait' : ''}`}
            title="Confirm this issue affects you"
          >
            {hasVoted ? (
              <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
            ) : (
              <Users className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="font-bold">{affectedCount}</span>
            <span>{hasVoted ? 'Affirmed' : 'Affects Me Too'}</span>
          </button>

          {/* Reporter Actions: Edit / Delete (Allowed only while 'reported') */}
          {canEditOrDelete && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Official Campus Alert Callout Banner (if approved) */}
      {issue.isCampusWideAlert ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded">
                Official Campus-Wide Advisory
              </span>
              <span className="text-xs text-rose-800 font-semibold">Active Advisory</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-0.5">
              Authorized Emergency Notice
            </h3>
            <p className="text-xs text-slate-700">
              Campus Administration has reviewed and approved this report for campus-wide visibility. Estate operations have been dispatched.
            </p>
          </div>
        </div>
      ) : issue.campusAlertRequested ? (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
          <Megaphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block mb-0.5">Alert Advisory Requested by Reporter</strong>
            <span>
              This report requested campus-wide alert visibility. It is currently awaiting administrative evaluation before an official advisory can be published.
            </span>
          </div>
        </div>
      ) : null}

      {/* Main Issue Details Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header Block */}
        <div className="p-6 sm:p-8 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-400">
                #{issue.id || issue._id}
              </span>
              <SeverityBadge severity={issue.severity} size="sm" />
              <StatusBadge status={issue.status} size="sm" />
              <CategoryBadge category={issue.category} size="sm" />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Reported {formatRelativeTime(issue.createdAt)}</span>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug mb-4">
            {issue.title}
          </h1>

          {/* Location & Author Snippet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-start gap-2 text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>
                  <strong className="text-slate-800">{building}</strong>
                  {specificArea && <span className="text-slate-500"> • {specificArea}</span>}
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                  <span>Zone: {getCampusZoneLabel(issue.location?.campusZone)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-600 sm:justify-end">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="text-slate-400">Reported by </span>
                <strong className="text-slate-800">{authorName}</strong>
                <span className="block text-[11px] text-slate-400">{authorDept}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Evidence Photo Section (Cloudinary) */}
        {issue.imageUrl && (
          <div className="px-6 sm:px-8 pt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Evidence Photo
            </h2>
            <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-[420px] flex items-center justify-center">
              <img
                src={issue.imageUrl}
                alt={`Photo evidence for ${issue.title}`}
                className="w-full h-auto max-h-[420px] object-contain rounded-xl cursor-pointer"
                onClick={() => setLightboxOpen(true)}
              />
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute top-3 right-3 p-2 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs text-xs flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Enlarge</span>
              </button>
            </div>
          </div>
        )}

        {/* Description Section */}
        <div className="p-6 sm:p-8 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Issue Description
          </h2>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            {issue.description}
          </div>

          {/* Review Details if available */}
          {issue.reviewedBy && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-slate-800 mb-0.5">
                  Administrative Review Recorded
                </strong>
                <span>
                  Reviewed by <strong>{issue.reviewedBy.name || 'Campus Administrator'}</strong> on{' '}
                  {new Date(issue.reviewedAt).toLocaleDateString()}
                  {issue.resolutionNote && (
                    <span className="block mt-1 italic text-slate-700">
                      Note: "{issue.resolutionNote}"
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lifecycle Status & Chronological Audit Timeline */}
      <StatusHistoryTimeline
        statusHistory={issue.statusHistory}
        currentStatus={issue.status}
        createdAt={issue.createdAt}
        reporter={issue.createdBy}
      />

      {/* Persistent Community Discussion & Comments Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Community Discussion ({comments.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Real-time Persistence</span>
        </div>

        {/* Comment input form */}
        <form onSubmit={handleCreateComment} className="space-y-3">
          <div className="relative">
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={commentSubmitting}
              placeholder="Add an update, hazard observation, or maintenance confirmation..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
            />
          </div>

          {commentError && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{commentError}</span>
            </p>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {commentText.length}/1000 characters
            </span>
            <button
              type="submit"
              disabled={commentSubmitting || !commentText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors disabled:opacity-50"
            >
              {commentSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Comment</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Comments Feed */}
        <div className="space-y-4 pt-2">
          {commentsLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-xs">Loading discussion thread...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              <MessageSquare className="w-6 h-6 text-slate-400 mx-auto mb-1.5 opacity-60" />
              <p className="font-semibold text-slate-700">No comments yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Be the first student to comment on this issue or share updates.
              </p>
            </div>
          ) : (
            comments.map((comment) => {
              const commentId = comment.id || comment._id;
              const isCommentAuthor =
                user &&
                (comment.author?._id === user.id ||
                  comment.author?.id === user.id ||
                  comment.author === user.id);
              const isAdmin = user?.role === 'admin';
              const isCurrentlyEditing = editingCommentId === commentId;

              const authorInitial = (comment.author?.name || 'U').charAt(0).toUpperCase();

              return (
                <div
                  key={commentId}
                  className="p-4 bg-slate-50/80 hover:bg-slate-50 rounded-xl border border-slate-200/80 transition-colors space-y-2"
                >
                  {/* Comment author & time */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {authorInitial}
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        {comment.author?.name || 'Campus Student'}
                      </span>
                      {comment.author?.role === 'admin' && (
                        <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                          Admin
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{formatRelativeTime(comment.createdAt)}</span>

                      {/* Author Edit / Delete controls */}
                      {(isCommentAuthor || isAdmin) && !isCurrentlyEditing && (
                        <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-2">
                          {isCommentAuthor && (
                            <button
                              type="button"
                              onClick={() => handleStartEditComment(comment)}
                              disabled={commentActionLoading}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Edit comment"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(commentId)}
                            disabled={commentActionLoading}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comment Body or Inline Editor */}
                  {isCurrentlyEditing ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        rows={2}
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-blue-400 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={handleCancelEditComment}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditComment(commentId)}
                          disabled={commentActionLoading || !editingCommentText.trim()}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pl-8">
                      {comment.text}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Modal Dialog */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Issue Report</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            {saveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                {saveError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issue Title *</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-slate-900"
                  >
                    <option value="infrastructure">Infrastructure</option>
                    <option value="electrical">Electrical & Power</option>
                    <option value="plumbing">Plumbing & Water</option>
                    <option value="it_wifi">IT / Wi-Fi</option>
                    <option value="safety">Campus Safety</option>
                    <option value="sanitation">Sanitation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Severity *</label>
                  <select
                    value={editFormData.severity}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, severity: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-slate-900"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Building *</label>
                <input
                  type="text"
                  value={editFormData.building}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, building: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1">Area</label>
                  <input
                    type="text"
                    value={editFormData.area}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, area: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 border rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Floor</label>
                  <input
                    type="text"
                    value={editFormData.floor}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, floor: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 border rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Room</label>
                  <input
                    type="text"
                    value={editFormData.room}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, room: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 border rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description *</label>
                <textarea
                  rows={4}
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-slate-900"
                  required
                />
              </div>

              {/* Image Replacement / Removal Section */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Evidence Photo Management
                </label>

                {issue.imageUrl && !removeExistingImage && !editSelectedImage && (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-lg mb-2">
                    <span className="text-slate-700 font-medium truncate max-w-[200px]">
                      Current photo attached
                    </span>
                    <button
                      type="button"
                      onClick={() => setRemoveExistingImage(true)}
                      className="text-rose-600 font-semibold hover:underline"
                    >
                      Remove Photo
                    </button>
                  </div>
                )}

                {removeExistingImage && (
                  <div className="p-2.5 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 mb-2 flex items-center justify-between">
                    <span>Photo will be removed on save</span>
                    <button
                      type="button"
                      onClick={() => setRemoveExistingImage(false)}
                      className="text-slate-600 underline font-medium"
                    >
                      Undo
                    </button>
                  </div>
                )}

                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditSelectedImage(file);
                      setEditImagePreview(URL.createObjectURL(file));
                      setRemoveExistingImage(false);
                    }
                  }}
                />

                {!editSelectedImage ? (
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{issue.imageUrl ? 'Replace Photo' : 'Upload Photo'}</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-emerald-800 truncate">{editSelectedImage.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditSelectedImage(null);
                        setEditImagePreview(null);
                      }}
                      className="text-rose-600 font-bold ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Delete Issue Report?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this report? This will permanently remove the issue, all comments, affirmations, and attached photos from MongoDB and Cloudinary. This action cannot be undone.
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Full Image Modal */}
      {lightboxOpen && issue.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={issue.imageUrl}
              alt={`Evidence for ${issue.title}`}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
