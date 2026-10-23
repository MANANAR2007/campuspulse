import React from 'react';
import { AlertCircle, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import { formatSeverity } from '../../utils/formatters.js';

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-600',
    icon: AlertCircle,
  },
  high: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    icon: AlertTriangle,
  },
  moderate: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    icon: Info,
  },
  low: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    icon: ShieldCheck,
  },
};

export default function SeverityBadge({ severity = 'moderate', size = 'sm', showIcon = true }) {
  const normalizedKey = (severity || 'moderate').toLowerCase();
  const config = SEVERITY_CONFIG[normalizedKey] || SEVERITY_CONFIG.moderate;
  const label = formatSeverity(severity);
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
      aria-label={`Severity: ${label}`}
    >
      {showIcon && <IconComponent className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{label}</span>
    </span>
  );
}
