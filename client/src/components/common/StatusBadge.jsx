import React from 'react';
import { Clock, Eye, CheckCircle2, Wrench, XCircle } from 'lucide-react';
import { formatStatus } from '../../utils/formatters.js';

const STATUS_CONFIG = {
  reported: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: Clock,
  },
  verified: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: Eye,
  },
  under_review: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: Eye,
  },
  in_progress: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: Wrench,
  },
  resolved: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  rejected: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: XCircle,
  },
};

export default function StatusBadge({ status = 'reported', size = 'sm', showIcon = true }) {
  const normalizedKey = (status || 'reported').toLowerCase().replace(/\s+/g, '_');
  const config = STATUS_CONFIG[normalizedKey] || STATUS_CONFIG.reported;
  const label = formatStatus(status);
  const IconComponent = config.icon;

  const sizeClasses =
    size === 'xs'
      ? 'text-[11px] px-1.5 py-0.5 gap-1'
      : size === 'md'
      ? 'text-xs px-2.5 py-1 gap-1.5'
      : 'text-xs px-2 py-0.5 gap-1';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
      aria-label={`Status: ${label}`}
    >
      {showIcon && <IconComponent className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{label}</span>
    </span>
  );
}
