/**
 * UI Formatter and Enum Mapping Helpers
 * Translates backend database enums into polished campus utility labels.
 */

export const CATEGORY_MAP = {
  infrastructure: 'Infrastructure',
  electrical: 'Electrical & Power',
  plumbing: 'Plumbing & Water',
  it_wifi: 'IT / Wi-Fi',
  safety: 'Campus Safety',
  sanitation: 'Sanitation & Hygiene',
  other: 'Other Facilities',
};

export const ISSUE_CATEGORIES = Object.keys(CATEGORY_MAP).map((key) => ({
  value: key,
  label: CATEGORY_MAP[key],
}));

export const SEVERITY_MAP = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
};

export const STATUS_MAP = {
  reported: 'Reported',
  verified: 'Verified',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

export function formatCategory(cat) {
  if (!cat) return 'General';
  const key = cat.toLowerCase();
  return CATEGORY_MAP[key] || cat;
}

export function formatSeverity(sev) {
  if (!sev) return 'Moderate';
  const key = sev.toLowerCase();
  return SEVERITY_MAP[key] || sev.charAt(0).toUpperCase() + sev.slice(1);
}

export function formatStatus(status) {
  if (!status) return 'Reported';
  const key = status.toLowerCase();
  return STATUS_MAP[key] || status;
}

/**
 * Format relative time helper
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format absolute timestamp helper
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
