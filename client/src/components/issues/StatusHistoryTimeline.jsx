import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  ShieldCheck,
  XCircle,
  User,
  Calendar,
} from 'lucide-react';
import { formatStatus, formatDate } from '../../utils/formatters.js';

const STAGE_ORDER = ['reported', 'verified', 'in_progress', 'resolved'];

const STATUS_ICONS = {
  reported: Clock,
  verified: ShieldCheck,
  in_progress: Wrench,
  resolved: CheckCircle2,
  rejected: XCircle,
};

const STATUS_COLORS = {
  reported: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-400',
    ring: 'ring-blue-100',
  },
  verified: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-400',
    ring: 'ring-purple-100',
  },
  in_progress: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-400',
    ring: 'ring-amber-100',
  },
  resolved: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-400',
    ring: 'ring-emerald-100',
  },
  rejected: {
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    border: 'border-rose-400',
    ring: 'ring-rose-100',
  },
};

export default function StatusHistoryTimeline({
  statusHistory = [],
  currentStatus = 'reported',
  createdAt = null,
  reporter = null,
}) {
  const isRejected = currentStatus === 'rejected';

  // Fallback synthetic entry if statusHistory array is empty
  const events =
    statusHistory && statusHistory.length > 0
      ? statusHistory
      : [
          {
            status: 'reported',
            changedBy: reporter,
            note: 'Initial report submitted',
            timestamp: createdAt || new Date(),
          },
        ];

  // Determine current step index for the progress bar
  const activeStageIndex = STAGE_ORDER.indexOf(currentStatus);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Issue Lifecycle & Audit Trail
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time status changes and administrative action history
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
            STATUS_COLORS[currentStatus]?.bg || 'bg-slate-100'
          } ${STATUS_COLORS[currentStatus]?.text || 'text-slate-700'}`}
        >
          {formatStatus(currentStatus)}
        </span>
      </div>

      {/* Progress Step Bar (Hidden if rejected) */}
      {!isRejected ? (
        <div className="relative py-2">
          <div className="overflow-hidden rounded-full bg-slate-100 h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 transition-all duration-500"
              style={{
                width: `${
                  activeStageIndex >= 0
                    ? ((activeStageIndex + 1) / STAGE_ORDER.length) * 100
                    : 25
                }%`,
              }}
            />
          </div>

          <div className="grid grid-cols-4 mt-3 text-center text-xs">
            {STAGE_ORDER.map((stage, idx) => {
              const isPastOrCurrent = activeStageIndex >= idx;
              const isCurrent = activeStageIndex === idx;
              const StepIcon = STATUS_ICONS[stage] || Clock;

              return (
                <div key={stage} className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 text-xs font-medium transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                        : isPastOrCurrent
                        ? 'bg-emerald-100 text-emerald-700 font-bold'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <StepIcon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`text-[11px] leading-tight ${
                      isCurrent
                        ? 'font-bold text-indigo-600'
                        : isPastOrCurrent
                        ? 'font-medium text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {formatStatus(stage)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-xs text-rose-800">
            <span className="font-semibold">Review Decision: Rejected.</span> This report was reviewed by campus administration and flagged as rejected or non-actionable.
          </div>
        </div>
      )}

      {/* Chronological Event History */}
      <div className="space-y-4 pt-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Event Timeline ({events.length})
        </h4>

        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {events.map((entry, index) => {
            const entryStatus = entry.status || 'reported';
            const colors = STATUS_COLORS[entryStatus] || STATUS_COLORS.reported;
            const IconComponent = STATUS_ICONS[entryStatus] || Clock;
            const actor = entry.changedBy;
            const isLast = index === events.length - 1;

            return (
              <div key={entry._id || index} className="relative group">
                {/* Node icon */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white ${colors.border} ${colors.text} shadow-xs ring-4 ring-white`}
                >
                  <IconComponent className="w-2.5 h-2.5" />
                </div>

                {/* Entry Card */}
                <div className="bg-slate-50/80 border border-slate-200/60 rounded-lg p-3 text-xs space-y-1.5 transition-all group-hover:bg-slate-50">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-semibold text-slate-900">
                      Status changed to{' '}
                      <span className={`${colors.text} font-bold`}>
                        {formatStatus(entryStatus)}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>

                  {/* Actor details */}
                  <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {actor && typeof actor === 'object' && actor.name ? (
                        <>
                          <strong className="text-slate-800">{actor.name}</strong>{' '}
                          <span className="text-slate-400">
                            ({actor.role === 'admin' ? 'Campus Ops Admin' : 'Student Reporter'})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">Campus System</span>
                      )}
                    </span>
                  </div>

                  {/* Resolution / Transition Note */}
                  {entry.note ? (
                    <div className="mt-1.5 p-2 bg-white rounded border border-slate-200/80 text-slate-700 text-xs italic">
                      "{entry.note}"
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
