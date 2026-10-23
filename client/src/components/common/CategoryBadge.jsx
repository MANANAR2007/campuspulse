import React from 'react';
import { Tag } from 'lucide-react';
import { formatCategory } from '../../utils/formatters.js';

export default function CategoryBadge({ category, size = 'sm', showIcon = false }) {
  const label = formatCategory(category);

  const sizeClasses =
    size === 'xs'
      ? 'text-[11px] px-1.5 py-0.5'
      : size === 'md'
      ? 'text-xs px-2.5 py-1'
      : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded border bg-slate-100 text-slate-700 border-slate-200 ${sizeClasses}`}
    >
      {showIcon && <Tag className="w-3 h-3 text-slate-500" />}
      <span>{label}</span>
    </span>
  );
}
