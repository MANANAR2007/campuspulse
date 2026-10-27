import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Clock,
  User,
  Users,
  MessageSquare,
  Megaphone,
  Check,
  ChevronRight,
  ImageIcon,
  Layers,
} from 'lucide-react';
import SeverityBadge from '../common/SeverityBadge.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import CategoryBadge from '../common/CategoryBadge.jsx';
import { formatRelativeTime } from '../../utils/formatters.js';
import { issuesAPI, getCampusZoneLabel } from '../../services/api.js';

export default function IssueCard({ issue }) {
  const issueId = issue.id || issue._id;

  const [hasVoted, setHasVoted] = useState(Boolean(issue.currentUserConfirmed));
  const [affectedCount, setAffectedCount] = useState(issue.confirmationCount || 0);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAffectsMeClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isUpdating) return;

    const previousVoted = hasVoted;
    const previousCount = affectedCount;

    // Optimistic UI update
    const newVoted = !previousVoted;
    const newCount = newVoted ? previousCount + 1 : Math.max(0, previousCount - 1);

    setHasVoted(newVoted);
    setAffectedCount(newCount);
    setIsUpdating(true);

    try {
      if (newVoted) {
        const res = await issuesAPI.confirm(issueId);
        if (res?.data) {
          setAffectedCount(res.data.confirmationCount);
          setHasVoted(res.data.currentUserConfirmed);
        }
      } else {
        const res = await issuesAPI.unconfirm(issueId);
        if (res?.data) {
          setAffectedCount(res.data.confirmationCount);
          setHasVoted(res.data.currentUserConfirmed);
        }
      }
    } catch (err) {
      // Revert optimistic update on failure
      setHasVoted(previousVoted);
      setAffectedCount(previousCount);
    } finally {
      setIsUpdating(false);
    }
  };

  const authorName = issue.createdBy?.name || issue.author?.name || 'Campus Reporter';
  const authorDept = issue.createdBy?.department || issue.author?.department || '';
  const authorInitials = authorName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isAlert = Boolean(issue.isCampusWideAlert || issue.isCampusAlert);

  const building = issue.location?.building || 'Main Campus';
  const specificArea =
    issue.location?.area ||
    issue.location?.room ||
    issue.location?.floor ||
    issue.location?.roomOrArea ||
    '';

  return (
    <article
      className={`group relative rounded-xl border bg-white p-4 sm:p-5 transition-all hover:shadow-md ${
        isAlert
          ? 'border-rose-300 ring-1 ring-rose-200/70 bg-gradient-to-b from-rose-50/20 to-white'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {isAlert && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded">
              <Megaphone className="w-3 h-3" />
              Approved Alert
            </span>
          )}
          {(issue.isIncidentGroup || issue.groupedReportsCount > 0) && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded">
              <Layers className="w-3 h-3 text-indigo-600" />
              Incident Group ({issue.groupedReportsCount} linked)
            </span>
          )}
          <SeverityBadge severity={issue.severity} size="xs" />
          <StatusBadge status={issue.status} size="xs" />
          <CategoryBadge category={issue.category} size="xs" />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatRelativeTime(issue.createdAt)}</span>
        </div>
      </div>

      {/* Main Content Area (Title, excerpt, optional thumbnail) */}
      <div className="flex items-start gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <Link to={`/issues/${issueId}`} className="block group-hover:text-blue-600 transition-colors">
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 tracking-tight leading-snug">
              {issue.title}
            </h3>
          </Link>
          <p className="mt-1 text-sm text-slate-600 line-clamp-2 leading-relaxed">
            {issue.description}
          </p>
        </div>

        {/* Cloudinary Image Thumbnail */}
        {issue.imageUrl && (
          <Link
            to={`/issues/${issueId}`}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 relative group-hover:border-blue-400 transition-colors"
            title="View evidence photo"
          >
            <img
              src={issue.imageUrl}
              alt={`Evidence for ${issue.title}`}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </Link>
        )}
      </div>

      {/* Location Row */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex-wrap">
        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="font-medium text-slate-700 truncate">{building}</span>
        {specificArea && (
          <>
            <span className="text-slate-300">•</span>
            <span className="truncate">{specificArea}</span>
          </>
        )}
        {issue.location?.campusZone && (
          <span className="ml-auto text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded shrink-0">
            {getCampusZoneLabel(issue.location.campusZone)}
          </span>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
        {/* Author info */}
        <div className="flex items-center gap-2 text-slate-500 min-w-0">
          <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-[10px] shrink-0">
            {authorInitials}
          </div>
          <span className="truncate font-medium text-slate-700">{authorName}</span>
          {authorDept && (
            <span className="text-slate-400 hidden sm:inline">({authorDept})</span>
          )}
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Affects Me Button (Persistent Community Affirmation) */}
          <button
            type="button"
            onClick={handleAffectsMeClick}
            disabled={isUpdating}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors border ${
              hasVoted
                ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs ring-1 ring-blue-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            } ${isUpdating ? 'opacity-70 cursor-wait' : ''}`}
            title={hasVoted ? 'Click to unconfirm (Affects Me)' : 'Confirm this issue affects you'}
          >
            {hasVoted ? (
              <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
            ) : (
              <Users className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="font-semibold">{affectedCount}</span>
            <span className="hidden sm:inline">{hasVoted ? 'Affected' : 'Affects Me'}</span>
          </button>

          {/* Direct link arrow */}
          <Link
            to={`/issues/${issueId}`}
            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            aria-label={`View details of ${issue.title}`}
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
