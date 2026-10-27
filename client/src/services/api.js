/**
 * Centralized API Service Layer
 * Uses native fetch with credentials: 'include' for HttpOnly cookie sessions.
 * Never stores JWT in localStorage or sessionStorage.
 */

const API_BASE = '/api';

/**
 * Custom API Error wrapping backend validation/error responses
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Build URL query string safely
 */
export function buildQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'All') {
      query.append(key, value);
    }
  });
  const str = query.toString();
  return str ? `?${str}` : '';
}

/**
 * Universal fetch helper with credentials included
 * Automatically handles JSON and multipart/form-data
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const defaultHeaders = isFormData
    ? {} // Let browser set Content-Type with correct boundary
    : { 'Content-Type': 'application/json' };

  const config = {
    ...options,
    credentials: 'include', // Always send and receive HttpOnly cookies
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object' && !isFormData) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        data.message || data.error || `Request failed with status ${response.status}`;
      throw new ApiError(errorMessage, response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error.message || 'Network error occurred. Please check your connection.',
      0
    );
  }
}

/**
 * Authentication API endpoints
 */
export const authAPI = {
  // POST /api/auth/register
  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: userData,
    }),

  // POST /api/auth/login
  login: (credentials) =>
    request('/auth/login', {
      method: 'POST',
      body: credentials,
    }),

  // POST /api/auth/logout
  logout: () =>
    request('/auth/logout', {
      method: 'POST',
    }),

  // GET /api/auth/me
  getMe: () =>
    request('/auth/me', {
      method: 'GET',
    }),

  // GET /api/auth/admin-check
  checkAdmin: () =>
    request('/auth/admin-check', {
      method: 'GET',
    }),
};

/**
 * Student Issue Reporting API endpoints
 */
export const issuesAPI = {
  // POST /api/issues (accepts JSON or FormData with image)
  create: (issueData) =>
    request('/issues', {
      method: 'POST',
      body: issueData,
    }),

  // GET /api/issues
  getAll: (params = {}) =>
    request(`/issues${buildQueryString(params)}`, {
      method: 'GET',
    }),

  // GET /api/issues/mine
  getMyIssues: (params = {}) =>
    request(`/issues/mine${buildQueryString(params)}`, {
      method: 'GET',
    }),

  // GET /api/issues/alerts
  getAlerts: () =>
    request('/issues/alerts', {
      method: 'GET',
    }),

  // GET /api/issues/:id
  getById: (id) =>
    request(`/issues/${id}`, {
      method: 'GET',
    }),

  // PATCH /api/issues/:id (accepts JSON or FormData)
  update: (id, updates) =>
    request(`/issues/${id}`, {
      method: 'PATCH',
      body: updates,
    }),

  // DELETE /api/issues/:id
  delete: (id) =>
    request(`/issues/${id}`, {
      method: 'DELETE',
    }),

  // POST /api/issues/:id/confirm ("Affects Me Too")
  confirm: (id) =>
    request(`/issues/${id}/confirm`, {
      method: 'POST',
    }),

  // DELETE /api/issues/:id/confirm (Remove affirmation)
  unconfirm: (id) =>
    request(`/issues/${id}/confirm`, {
      method: 'DELETE',
    }),

  // GET /api/issues/duplicates (Duplicate Radar pre-submission search)
  checkDuplicates: (params = {}) =>
    request(`/issues/duplicates${buildQueryString(params)}`, {
      method: 'GET',
    }),

  // POST /api/issues/:id/reopen (Student/Admin reopen resolved issue)
  reopen: (id, data) =>
    request(`/issues/${id}/reopen`, {
      method: 'POST',
      body: data,
    }),

  // POST /api/issues/:id/confirm-resolution (Student resolution confirmation)
  confirmResolution: (id, data = {}) =>
    request(`/issues/${id}/confirm-resolution`, {
      method: 'POST',
      body: data,
    }),
};

/**
 * Persistent Comments API endpoints
 */
export const commentsAPI = {
  // GET /api/issues/:id/comments
  getComments: (issueId, params = {}) =>
    request(`/issues/${issueId}/comments${buildQueryString(params)}`, {
      method: 'GET',
    }),

  // POST /api/issues/:id/comments
  createComment: (issueId, commentData) =>
    request(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: commentData,
    }),

  // PATCH /api/comments/:commentId
  updateComment: (commentId, commentData) =>
    request(`/comments/${commentId}`, {
      method: 'PATCH',
      body: commentData,
    }),

  // DELETE /api/comments/:commentId
  deleteComment: (commentId) =>
    request(`/comments/${commentId}`, {
      method: 'DELETE',
    }),
};

/**
 * Database-backed Notifications API endpoints
 */
export const notificationsAPI = {
  // GET /api/notifications
  getAll: (params = {}) =>
    request(`/notifications${buildQueryString(params)}`, {
      method: 'GET',
    }),

  // PATCH /api/notifications/:id/read
  markAsRead: (id) =>
    request(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  // PATCH /api/notifications/read-all
  markAllAsRead: () =>
    request('/notifications/read-all', {
      method: 'PATCH',
    }),
};

/**
 * Administrator Issue Review & Lifecycle API endpoints
 */
export const adminAPI = {
  // GET /api/admin/issues
  getIssues: (params = {}) =>
    request(`/admin/issues${buildQueryString(params)}`, {
      method: 'GET',
    }),

  // GET /api/admin/issues/:id
  getIssueById: (id) =>
    request(`/admin/issues/${id}`, {
      method: 'GET',
    }),

  // PATCH /api/admin/issues/:id/review
  reviewIssue: (id, reviewData) =>
    request(`/admin/issues/${id}/review`, {
      method: 'PATCH',
      body: reviewData,
    }),

  // PATCH /api/admin/issues/:id/status
  updateStatus: (id, statusData) =>
    request(`/admin/issues/${id}/status`, {
      method: 'PATCH',
      body: statusData,
    }),

  // GET /api/admin/stats
  getStats: () =>
    request('/admin/stats', {
      method: 'GET',
    }),

  // GET /api/admin/hotspots
  getHotspots: () =>
    request('/admin/hotspots', {
      method: 'GET',
    }),

  // POST /api/admin/issues/:id/assign
  assignIssue: (id, data) =>
    request(`/admin/issues/${id}/assign`, {
      method: 'POST',
      body: data,
    }),

  // POST /api/admin/issues/:id/redirect
  redirectIssue: (id, data) =>
    request(`/admin/issues/${id}/redirect`, {
      method: 'POST',
      body: data,
    }),

  // POST /api/admin/issues/:id/unassign
  unassignIssue: (id, data = {}) =>
    request(`/admin/issues/${id}/unassign`, {
      method: 'POST',
      body: data,
    }),

  // POST /api/admin/issues/:id/priority-deadline
  updatePriorityAndDeadlines: (id, data) =>
    request(`/admin/issues/${id}/priority-deadline`, {
      method: 'POST',
      body: data,
    }),

  // POST /api/admin/issues/:id/visibility
  updateVisibility: (id, data) =>
    request(`/admin/issues/${id}/visibility`, {
      method: 'POST',
      body: data,
    }),

  // POST /api/admin/issues/:id/group
  groupIssue: (id, data) =>
    request(`/admin/issues/${id}/group`, {
      method: 'POST',
      body: data,
    }),

  // POST /api/admin/issues/:id/ungroup
  ungroupIssue: (id, data = {}) =>
    request(`/admin/issues/${id}/ungroup`, {
      method: 'POST',
      body: data,
    }),

  // GET /api/admin/staff
  getStaff: () =>
    request('/admin/staff', {
      method: 'GET',
    }),

  // POST /api/admin/staff
  createStaff: (data) =>
    request('/admin/staff', {
      method: 'POST',
      body: data,
    }),

  // PATCH /api/admin/staff/:id
  updateStaff: (id, data) =>
    request(`/admin/staff/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  // GET /api/admin/audit-logs
  getAuditLogs: (params = {}) =>
    request(`/admin/audit-logs${buildQueryString(params)}`, {
      method: 'GET',
    }),
};

/**
 * Campus Department Management API
 */
export const departmentsAPI = {
  // GET /api/departments
  getAll: (params = {}) =>
    request(`/departments${buildQueryString(params)}`, {
      method: 'GET',
    }),

  // GET /api/departments/:id/staff
  getStaff: (id) =>
    request(`/departments/${id}/staff`, {
      method: 'GET',
    }),

  // POST /api/departments
  create: (data) =>
    request('/departments', {
      method: 'POST',
      body: data,
    }),

  // PUT /api/departments/:id
  update: (id, data) =>
    request(`/departments/${id}`, {
      method: 'PUT',
      body: data,
    }),
};

/**
 * Staff Work Queue and Operations API
 */
export const staffAPI = {
  // GET /api/staff/queue
  getQueue: () =>
    request('/staff/queue', {
      method: 'GET',
    }),

  // GET /api/staff/stats
  getStats: () =>
    request('/staff/stats', {
      method: 'GET',
    }),

  // PATCH /api/staff/issues/:id/status
  updateStatus: (id, data) =>
    request(`/staff/issues/${id}/status`, {
      method: 'PATCH',
      body: data,
    }),
};

/**
 * Standardized Campus Issue Visibilities
 */
export const ISSUE_VISIBILITIES = [
  {
    value: 'public',
    label: 'Public (Campus Feed)',
    description: 'Visible to all students, staff, and administrators on the campus feed.',
    color: 'emerald',
  },
  {
    value: 'department_only',
    label: 'Department Only',
    description: 'Visible only to the reporting student, administrators, and assigned department staff.',
    color: 'amber',
  },
  {
    value: 'confidential',
    label: 'Confidential (Sensitive)',
    description: 'Sensitive report visible strictly to you, administrators, and the assigned specialist.',
    color: 'purple',
  },
];

/**
 * Standardized Campus Issue Priorities
 */
export const ISSUE_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'slate' },
  { value: 'normal', label: 'Normal', color: 'blue' },
  { value: 'high', label: 'High', color: 'amber' },
  { value: 'critical', label: 'Critical', color: 'rose' },
];

/**
 * Standardized Campus Zones list for frontend forms and drill-downs
 */
export const CAMPUS_ZONES = [
  { value: 'academic_blocks', label: 'Academic Blocks' },
  { value: 'library', label: 'Library' },
  { value: 'hostels', label: 'Hostels & Residences' },
  { value: 'cafeteria', label: 'Cafeteria & Dining' },
  { value: 'sports_complex', label: 'Sports Complex & Gym' },
  { value: 'admin_block', label: 'Administrative Block' },
  { value: 'labs_research', label: 'Labs & Research Center' },
  { value: 'parking_transit', label: 'Parking & Transit' },
  { value: 'auditorium', label: 'Auditorium & Halls' },
  { value: 'campus_grounds', label: 'Campus Grounds & Walkways' },
  { value: 'other', label: 'Other Campus Area' },
];

/**
 * Helper to display readable campus zone labels
 */
export function getCampusZoneLabel(zoneKey) {
  const match = CAMPUS_ZONES.find((z) => z.value === zoneKey);
  return match ? match.label : zoneKey ? zoneKey.replace('_', ' ') : 'Campus';
}

/**
 * Standardized Campus Issue Enums and Labels
 */
export const ISSUE_CATEGORIES = [
  'infrastructure',
  'electrical',
  'plumbing',
  'it_wifi',
  'safety',
  'sanitation',
  'other',
];

export const ISSUE_SEVERITIES = ['low', 'moderate', 'high', 'critical'];

export const ISSUE_STATUSES = [
  'reported',
  'verified',
  'in_progress',
  'resolved',
  'rejected',
];

export function getCategoryLabel(cat) {
  const map = {
    infrastructure: 'Infrastructure',
    electrical: 'Electrical & Power',
    plumbing: 'Plumbing & Water',
    it_wifi: 'IT / Wi-Fi',
    safety: 'Campus Safety',
    sanitation: 'Sanitation & Hygiene',
    other: 'Other Facilities',
  };
  return map[cat] || cat || 'General';
}

/**
 * Health check endpoint
 */
export const healthAPI = {
  getHealth: () => request('/health', { method: 'GET' }),
};
