import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import AlertBanner from '../components/issues/AlertBanner.jsx';
import FeedFilters from '../components/issues/FeedFilters.jsx';
import IssueCard from '../components/issues/IssueCard.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { issuesAPI } from '../services/api.js';
import { ISSUE_CATEGORIES } from '../utils/formatters.js';

export default function FeedPage() {
  const [issues, setIssues] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [activeFilter, setActiveFilter] = useState('All'); // 'All' | 'Critical' | 'High' | 'Moderate' | 'Low' | 'Resolved'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Debounce search input by 350ms
  const searchTimeoutRef = useRef(null);
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1); // Reset to page 1 on new search
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Fetch approved active campus alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await issuesAPI.getAlerts();
      if (res && res.data && res.data.alerts) {
        setAlerts(res.data.alerts);
      }
    } catch (_) {
      // Non-blocking alert fetch error
    }
  }, []);

  // Fetch paginated feed
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: 10,
    };

    // Severity / Status filter mapping
    if (activeFilter === 'Resolved') {
      params.status = 'resolved';
    } else if (activeFilter !== 'All') {
      params.severity = activeFilter.toLowerCase();
    }

    if (selectedCategory !== 'All') {
      params.category = selectedCategory;
    }

    if (debouncedSearch) {
      params.search = debouncedSearch;
    }

    try {
      const res = await issuesAPI.getAll(params);
      if (res && res.data) {
        setIssues(res.data.issues || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load campus issues. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, activeFilter, selectedCategory, debouncedSearch]);

  // Load feed and alerts
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
    setPage(1);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setPage(1);
  };

  // Top active approved alert
  const topAlert = alerts.length > 0 ? alerts[0] : null;

  return (
    <div className="space-y-6">
      {/* Top Welcome / Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campus Feed</h1>
          <p className="text-sm text-slate-500">
            Real-time campus infrastructure, maintenance, and safety updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchFeed();
              fetchAlerts();
            }}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/issues/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Report an Issue</span>
          </Link>
        </div>
      </div>

      {/* Approved Campus Alert Banner (Real API) */}
      {topAlert && <AlertBanner alertIssue={topAlert} />}

      {/* Search & Feed Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Search bar & Category select */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by keywords, building name, or issue title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
            >
              <option value="All">All Categories</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="electrical">Electrical & Power</option>
              <option value="plumbing">Plumbing & Water</option>
              <option value="it_wifi">IT / Wi-Fi</option>
              <option value="safety">Campus Safety</option>
              <option value="sanitation">Sanitation & Hygiene</option>
              <option value="other">Other Facilities</option>
            </select>
          </div>
        </div>

        {/* Severity / Status Filter Pills */}
        <FeedFilters
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          counts={{}}
        />
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-800">{pagination.total}</strong>{' '}
          {pagination.total === 1 ? 'persistent issue' : 'persistent issues'}
          {activeFilter !== 'All' && ` (Filtered by ${activeFilter})`}
          {selectedCategory !== 'All' && ` (${selectedCategory})`}
          {debouncedSearch && ` matching "${debouncedSearch}"`}
        </span>
        <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Live MongoDB Feed
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold block mb-0.5">Failed to sync feed</strong>
            <p>{error}</p>
            <button
              type="button"
              onClick={fetchFeed}
              className="mt-2 text-xs font-semibold text-rose-700 hover:text-rose-900 underline"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Issues Feed List */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 bg-white rounded-xl border border-slate-200 p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">Loading campus reports from database...</p>
        </div>
      ) : issues.length > 0 ? (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3.5">
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs text-slate-600">
              <span>
                Page <strong className="text-slate-900">{pagination.page}</strong> of{' '}
                <strong className="text-slate-900">{pagination.totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevPage || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasNextPage || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No campus issues found"
          description="There are currently no persistent issues in the database matching your criteria."
          action={
            <button
              type="button"
              onClick={() => {
                setActiveFilter('All');
                setSelectedCategory('All');
                setSearchQuery('');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Reset Filters
            </button>
          }
        />
      )}
    </div>
  );
}
