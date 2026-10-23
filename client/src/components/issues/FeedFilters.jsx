import React from 'react';

export default function FeedFilters({
  activeFilter = 'All',
  onFilterChange,
  counts = {},
}) {
  const filters = [
    { id: 'All', label: 'All Issues', count: counts.all },
    { id: 'Critical', label: 'Critical', count: counts.critical, dot: 'bg-rose-500' },
    { id: 'High', label: 'High', count: counts.high, dot: 'bg-amber-500' },
    { id: 'Moderate', label: 'Moderate', count: counts.moderate, dot: 'bg-sky-500' },
    { id: 'Low', label: 'Low', count: counts.low, dot: 'bg-slate-400' },
    { id: 'Resolved', label: 'Resolved', count: counts.resolved, dot: 'bg-emerald-500' },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs sm:text-sm">
      {filters.map((f) => {
        const isActive = activeFilter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors border ${
              isActive
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
            aria-pressed={isActive}
          >
            {f.dot && (
              <span
                className={`w-2 h-2 rounded-full ${f.dot} ${
                  isActive ? 'ring-1 ring-white/50' : ''
                }`}
              />
            )}
            <span>{f.label}</span>
            {f.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                  isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
