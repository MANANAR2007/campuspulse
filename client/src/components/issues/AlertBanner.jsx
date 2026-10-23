import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, ArrowRight, MapPin, Users } from 'lucide-react';
import SeverityBadge from '../common/SeverityBadge.jsx';
import CategoryBadge from '../common/CategoryBadge.jsx';

export default function AlertBanner({ alertIssue }) {
  if (!alertIssue) return null;

  const building = alertIssue.location?.building || 'Campus Facilities';
  const specificArea =
    alertIssue.location?.area ||
    alertIssue.location?.room ||
    alertIssue.location?.roomOrArea ||
    '';

  const issueId = alertIssue.id || alertIssue._id;

  return (
    <div
      role="alert"
      className="relative overflow-hidden rounded-xl border border-rose-200 bg-rose-50/80 p-4 sm:p-5 mb-6 shadow-xs"
    >
      {/* Accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-600" />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
            <Megaphone className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white">
                Official Campus Alert
              </span>
              <SeverityBadge severity={alertIssue.severity} size="xs" />
              <CategoryBadge category={alertIssue.category} size="xs" />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">
              {alertIssue.title}
            </h2>
            <p className="text-sm text-slate-700 mb-2 line-clamp-2">
              {alertIssue.description}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                <span>{building}</span>
                {specificArea && <span>• {specificArea}</span>}
              </span>
            </div>
          </div>
        </div>

        <Link
          to={`/issues/${issueId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-white hover:bg-rose-100/60 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors self-start shrink-0"
        >
          <span>View Advisory Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
