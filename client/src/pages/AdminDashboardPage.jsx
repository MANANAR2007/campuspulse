import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileCheck,
  Megaphone,
  Check,
  X,
  Wrench,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Flame,
  TrendingUp,
  BarChart3,
  Users,
  MapPin,
  Eye,
  Compass,
  ArrowUpDown,
  SlidersHorizontal,
  Building2,
  Lock,
  History,
  Plus,
  UserCheck,
  UserX,
  FileText,
  UserPlus,
  Briefcase,
  Layers,
  ArrowRight,
  Shield,
  Edit2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import CategoryBadge from '../components/common/CategoryBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  adminAPI,
  departmentsAPI,
  CAMPUS_ZONES,
  getCampusZoneLabel,
  ISSUE_VISIBILITIES,
  ISSUE_PRIORITIES,
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { formatRelativeTime } from '../utils/formatters.js';

const FILTER_CATEGORIES = [
  { id: 'All', label: 'All Categories' },
  { id: 'infrastructure', label: 'Infrastructure & Buildings' },
  { id: 'electrical', label: 'Electrical & Power' },
  { id: 'plumbing', label: 'Plumbing & Water' },
  { id: 'it_wifi', label: 'IT & Campus Wi-Fi' },
  { id: 'safety', label: 'Campus Safety & Hazards' },
  { id: 'sanitation', label: 'Sanitation & Hygiene' },
  { id: 'other', label: 'Other Campus Facilities' },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [stats, setStats] = useState({
    totalIssues: 0,
    openIssues: 0,
    criticalIssues: 0,
    pendingReview: 0,
    inProgress: 0,
    resolved: 0,
    activeAlerts: 0,
    rejectedIssues: 0,
    unassignedCount: 0,
    overdueCount: 0,
    reopenedCount: 0,
    confidentialCount: 0,
    totalAffirmations: 0,
    avgResolutionTimeHours: 0,
    categoryDistribution: [],
    statusDistribution: [],
    departmentDistribution: [],
    recentVelocity: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Campus Hotspots State
  const [hotspots, setHotspots] = useState([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);

  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Filters & Sorting
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterCampusZone, setFilterCampusZone] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterVisibility, setFilterVisibility] = useState('All');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [sort, setSort] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [searchParams] = useSearchParams();
  const currentView = searchParams.get('view') || 'overview';

  // React to view changes from Admin Sidebar navigation
  useEffect(() => {
    if (currentView === 'queue') {
      setFilterStatus('reported');
      setFilterOverdue(false);
      setFilterUnassigned(false);
      setPage(1);
    } else if (currentView === 'alerts') {
      setFilterStatus('All');
      setFilterOverdue(false);
      setFilterUnassigned(false);
      setPage(1);
    }
  }, [currentView]);

  // Action modals for Review Queue
  const [reviewModal, setReviewModal] = useState(null); // { issue, decision, approveAlert: false, note: '' }
  const [statusModal, setStatusModal] = useState(null); // { issue, targetStatus: '', note: '' }
  const [isProcessing, setIsProcessing] = useState(false);

  // Departments View States
  const [departmentsList, setDepartmentsList] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });

  // Staff View States
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', departmentId: '' });

  // Audit Logs View States
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState({ totalPages: 1, total: 0 });

  const fetchDepartments = useCallback(async () => {
    try {
      setDeptLoading(true);
      const res = await departmentsAPI.getAll({ includeInactive: true });
      if (res?.data?.departments) {
        setDepartmentsList(res.data.departments);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setDeptLoading(false);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      setStaffLoading(true);
      const res = await adminAPI.getStaff();
      if (res?.data?.staff) {
        setStaffList(res.data.staff);
      }
    } catch (err) {
      console.error('Failed to load staff:', err);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const res = await adminAPI.getAuditLogs({ page: auditPage, limit: 15 });
      if (res?.data) {
        setAuditLogs(res.data.logs || []);
        if (res.data.pagination) setAuditPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage]);

  // Load departments once on mount so queue filter has them
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Load view-specific data
  useEffect(() => {
    if (currentView === 'departments') {
      fetchDepartments();
    } else if (currentView === 'staff') {
      fetchStaff();
      fetchDepartments();
    } else if (currentView === 'audit') {
      fetchAuditLogs();
    }
  }, [currentView, fetchDepartments, fetchStaff, fetchAuditLogs]);

  // Load database-derived statistics
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await adminAPI.getStats();
      if (res && res.data) {
        setStats(res.data);
      }
    } catch {
      // Non-blocking stats error
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load campus hotspot analytics
  const fetchHotspots = useCallback(async () => {
    try {
      setHotspotsLoading(true);
      const res = await adminAPI.getHotspots();
      if (res && res.data && Array.isArray(res.data.hotspots)) {
        setHotspots(res.data.hotspots);
      }
    } catch {
      // Non-blocking hotspots error
    } finally {
      setHotspotsLoading(false);
    }
  }, []);

  // Load review queue
  const fetchIssues = useCallback(async () => {
    setIssuesLoading(true);
    setError(null);

    const params = {
      page,
      limit: 10,
    };

    if (filterStatus !== 'All') {
      params.status = filterStatus.toLowerCase();
    }

    if (filterSeverity !== 'All') {
      params.severity = filterSeverity.toLowerCase();
    }

    if (filterCampusZone !== 'All') {
      params.campusZone = filterCampusZone.toLowerCase();
    }

    if (filterCategory !== 'All') {
      params.category = filterCategory.toLowerCase();
    }

    if (filterDepartment !== 'All') {
      params.department = filterDepartment;
    }

    if (filterVisibility !== 'All') {
      params.visibility = filterVisibility;
    }

    if (filterOverdue) {
      params.isOverdue = 'true';
    }

    if (filterUnassigned) {
      params.unassignedOnly = 'true';
    }

    if (sort !== 'newest') {
      params.sort = sort;
    }

    if (currentView === 'alerts') {
      params.isCampusWideAlert = true;
    }

    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    try {
      const res = await adminAPI.getIssues(params);
      if (res && res.data) {
        setIssues(res.data.issues || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch issues from review queue.');
    } finally {
      setIssuesLoading(false);
    }
  }, [
    page,
    filterStatus,
    filterSeverity,
    filterCampusZone,
    filterCategory,
    filterDepartment,
    filterVisibility,
    filterOverdue,
    filterUnassigned,
    sort,
    searchQuery,
    currentView,
  ]);

  useEffect(() => {
    fetchStats();
    fetchHotspots();
  }, [fetchStats, fetchHotspots]);

  useEffect(() => {
    if (currentView === 'overview' || currentView === 'queue' || currentView === 'alerts') {
      fetchIssues();
    }
  }, [fetchIssues, currentView]);

  // Realtime Socket.IO listeners
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeChange = () => {
      fetchStats();
      fetchHotspots();
      if (currentView === 'overview' || currentView === 'queue' || currentView === 'alerts') {
        fetchIssues();
      } else if (currentView === 'departments') {
        fetchDepartments();
      } else if (currentView === 'staff') {
        fetchStaff();
      } else if (currentView === 'audit') {
        fetchAuditLogs();
      }
    };

    socket.on('issue:created', handleRealtimeChange);
    socket.on('issue:updated', handleRealtimeChange);
    socket.on('issue:deleted', handleRealtimeChange);
    socket.on('issue:statusChanged', handleRealtimeChange);
    socket.on('alert:approved', handleRealtimeChange);
    socket.on('confirmation:updated', handleRealtimeChange);

    return () => {
      socket.off('issue:created', handleRealtimeChange);
      socket.off('issue:updated', handleRealtimeChange);
      socket.off('issue:deleted', handleRealtimeChange);
      socket.off('issue:statusChanged', handleRealtimeChange);
      socket.off('alert:approved', handleRealtimeChange);
      socket.off('confirmation:updated', handleRealtimeChange);
    };
  }, [socket, fetchStats, fetchHotspots, fetchIssues, fetchDepartments, fetchStaff, fetchAuditLogs, currentView]);

  // Execute Review Decision (Verify / Reject)
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewModal) return;

    setIsProcessing(true);
    try {
      const payload = {
        decision: reviewModal.decision,
        approveCampusAlert: Boolean(reviewModal.approveAlert),
        resolutionNote: reviewModal.note ? reviewModal.note.trim() : '',
      };

      await adminAPI.reviewIssue(reviewModal.issue.id, payload);

      setActionFeedback({
        type: 'success',
        message: `Report #${reviewModal.issue.id.slice(-6)} was successfully marked as ${
          reviewModal.decision === 'verify' ? 'Verified' : 'Rejected'
        }.`,
      });

      setReviewModal(null);
      fetchStats();
      fetchHotspots();
      fetchIssues();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to complete review decision.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Status Transition
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusModal || !statusModal.targetStatus) return;

    setIsProcessing(true);
    try {
      const payload = {
        status: statusModal.targetStatus,
        resolutionNote: statusModal.note ? statusModal.note.trim() : '',
      };

      await adminAPI.updateStatus(statusModal.issue.id, payload);

      setActionFeedback({
        type: 'success',
        message: `Status of #${statusModal.issue.id.slice(-6)} updated to '${statusModal.targetStatus}'.`,
      });

      setStatusModal(null);
      fetchStats();
      fetchHotspots();
      fetchIssues();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to update status transition.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset all filters
  const handleClearFilters = () => {
    setFilterStatus('All');
    setFilterSeverity('All');
    setFilterCampusZone('All');
    setFilterCategory('All');
    setFilterDepartment('All');
    setFilterVisibility('All');
    setFilterOverdue(false);
    setFilterUnassigned(false);
    setSort('newest');
    setSearchQuery('');
    setPage(1);
  };

  const isAnyFilterActive =
    filterStatus !== 'All' ||
    filterSeverity !== 'All' ||
    filterCampusZone !== 'All' ||
    filterCategory !== 'All' ||
    filterDepartment !== 'All' ||
    filterVisibility !== 'All' ||
    filterOverdue ||
    filterUnassigned ||
    sort !== 'newest' ||
    searchQuery.trim().length > 0;

  // Max daily reports in 7-day velocity series
  const maxVelocityCount = Math.max(
    1,
    ...(stats.recentVelocity || []).map((v) => v.count)
  );

  // Department Operations Handlers
  const handleOpenNewDeptModal = () => {
    setEditingDept(null);
    setDeptForm({ name: '', code: '', description: '' });
    setDeptModalOpen(true);
  };

  const handleOpenEditDeptModal = (dept) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
    });
    setDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim() || !deptForm.code.trim()) return;

    setIsProcessing(true);
    try {
      if (editingDept) {
        await departmentsAPI.update(editingDept._id, {
          name: deptForm.name.trim(),
          description: deptForm.description.trim(),
        });
        setActionFeedback({
          type: 'success',
          message: `Department "${deptForm.name}" updated successfully.`,
        });
      } else {
        await departmentsAPI.create({
          name: deptForm.name.trim(),
          code: deptForm.code.trim().toUpperCase(),
          description: deptForm.description.trim(),
        });
        setActionFeedback({
          type: 'success',
          message: `Department "${deptForm.name}" created successfully.`,
        });
      }
      setDeptModalOpen(false);
      fetchDepartments();
      fetchStats();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to save department.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleDeptActive = async (dept) => {
    try {
      await departmentsAPI.update(dept._id, {
        isActive: !dept.isActive,
      });
      setActionFeedback({
        type: 'success',
        message: `Department "${dept.name}" is now ${!dept.isActive ? 'Active' : 'Inactive'}.`,
      });
      fetchDepartments();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to toggle department status.',
      });
    }
  };

  // Staff Operations Handlers
  const handleOpenNewStaffModal = () => {
    setEditingStaff(null);
    setStaffForm({
      name: '',
      email: '',
      password: '',
      departmentId: departmentsList[0]?._id || '',
    });
    setStaffModalOpen(true);
  };

  const handleOpenEditStaffModal = (staffUser) => {
    setEditingStaff(staffUser);
    setStaffForm({
      name: staffUser.name,
      email: staffUser.email,
      password: '',
      departmentId: staffUser.department?._id || staffUser.department || '',
    });
    setStaffModalOpen(true);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return;

    setIsProcessing(true);
    try {
      if (editingStaff) {
        await adminAPI.updateStaff(editingStaff._id, {
          name: staffForm.name.trim(),
          departmentId: staffForm.departmentId,
        });
        setActionFeedback({
          type: 'success',
          message: `Staff account "${staffForm.name}" updated.`,
        });
      } else {
        if (!staffForm.email.trim() || !staffForm.password || staffForm.password.length < 6) {
          throw new Error('Valid email and password (minimum 6 characters) are required.');
        }
        await adminAPI.createStaff({
          name: staffForm.name.trim(),
          email: staffForm.email.trim(),
          password: staffForm.password,
          departmentId: staffForm.departmentId,
        });
        setActionFeedback({
          type: 'success',
          message: `Staff member "${staffForm.name}" created successfully.`,
        });
      }
      setStaffModalOpen(false);
      fetchStaff();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to save staff account.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStaffActive = async (staffUser) => {
    try {
      await adminAPI.updateStaff(staffUser._id, {
        isActive: !staffUser.isActive,
      });
      setActionFeedback({
        type: 'success',
        message: `Staff account "${staffUser.name}" marked ${!staffUser.isActive ? 'Active' : 'Inactive'}.`,
      });
      fetchStaff();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to update staff active state.',
      });
    }
  };

  // Map department ID to active issue count from stats
  const deptWorkloadMap = new Map(
    (stats.departmentDistribution || []).map((d) => [d.departmentId, d.count])
  );

  return (
    <div className="space-y-6">
      {/* Top Command Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-purple-700 text-white px-2 py-0.5 rounded">
              Campus Command Center
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Operations Lead: {user?.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>
              {currentView === 'departments'
                ? 'Campus Operational Departments'
                : currentView === 'staff'
                ? 'Department Staff Directory & Roster'
                : currentView === 'audit'
                ? 'System Security & Operations Audit Trail'
                : 'Facilities & Emergency Dispatch'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentView === 'departments'
              ? 'Configure campus operational units, routing codes, and active dispatch destinations.'
              : currentView === 'staff'
              ? 'Manage departmental specialists, technicians, and privileged work-queue assignments.'
              : currentView === 'audit'
              ? 'Immutable security trail of administrative reassignments, status transitions, and confidentiality changes.'
              : 'Real-time campus situational awareness, zone hotspots, and lifecycle review queue.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {currentView === 'departments' && (
            <button
              type="button"
              onClick={handleOpenNewDeptModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Department</span>
            </button>
          )}

          {currentView === 'staff' && (
            <button
              type="button"
              onClick={handleOpenNewStaffModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Staff Member</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchHotspots();
              if (currentView === 'departments') fetchDepartments();
              else if (currentView === 'staff') fetchStaff();
              else if (currentView === 'audit') fetchAuditLogs();
              else fetchIssues();
            }}
            disabled={issuesLoading || deptLoading || staffLoading || auditLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                issuesLoading || deptLoading || staffLoading || auditLoading ? 'animate-spin' : ''
              }`}
            />
            <span>Sync Live Ops</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
            actionFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {actionFeedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW: DEPARTMENTS MANAGEMENT                              */}
      {/* ========================================================== */}
      {currentView === 'departments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-700" />
                  <span>Campus Operations Roster ({departmentsList.length} Departments)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Departments receive routed issues and have dedicated staff work queues.
                </p>
              </div>
            </div>

            {deptLoading ? (
              <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                <span>Loading operational departments...</span>
              </div>
            ) : departmentsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <p>No operational departments configured yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Department & Routing Code</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Active Workload</th>
                      <th className="py-3 px-4">Routing State</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departmentsList.map((dept) => {
                      const workload = deptWorkloadMap.get(dept._id) || 0;
                      return (
                        <tr key={dept._id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                              <span>{dept.name}</span>
                              <span className="font-mono text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded uppercase font-semibold">
                                {dept.code}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-md text-slate-600 text-xs">
                            {dept.description || <span className="text-slate-400 italic">No description provided.</span>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              <Briefcase className="w-3 h-3 text-slate-500" />
                              {workload} {workload === 1 ? 'ticket' : 'tickets'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {dept.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active (Receiving)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDeptModal(dept)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleDeptActive(dept)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                                dept.isActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {dept.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW: STAFF MANAGEMENT                                    */}
      {/* ========================================================== */}
      {currentView === 'staff' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-700" />
                  <span>Authorized Staff Accounts ({staffList.length} Members)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Department staff handle assigned tickets, write internal triage notes, and record official resolutions.
                </p>
              </div>
            </div>

            {staffLoading ? (
              <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                <span>Loading staff directory...</span>
              </div>
            ) : staffList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <p>No department staff members registered yet. Click "Add Staff Member" to provision credentials.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Department Affiliation</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-4">Registered On</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffList.map((st) => (
                      <tr key={st._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-xs">{st.name}</div>
                          <div className="font-mono text-[11px] text-slate-400">{st.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md">
                            <Building2 className="w-3 h-3 text-purple-600" />
                            {st.department?.name || st.departmentName || 'General Staff'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {st.isActive !== false ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {formatRelativeTime(st.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStaffModal(st)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStaffActive(st)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                              st.isActive !== false
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {st.isActive !== false ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW: AUDIT TRAIL LOGS                                    */}
      {/* ========================================================== */}
      {currentView === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-700" />
                  <span>Administrative Operations Audit Trail ({auditPagination.total} Total Events)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tamper-evident record of ticket reassignments, SLA changes, privacy modifications, and resolutions.
                </p>
              </div>
            </div>

            {auditLoading ? (
              <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                <span>Querying audit log entries...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <p>No audit events recorded yet.</p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Operator</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Target Entity</th>
                        <th className="py-3 px-4">Operational Reason & Context</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{log.actor?.name || 'System Operator'}</div>
                            <div className="text-[10px] text-slate-400 capitalize">
                              {log.actor?.role || 'admin'} • {log.actor?.email}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              {log.action.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-medium text-slate-700">{log.entityType}</span>
                            {log.entityId && (
                              <span className="font-mono text-[10px] text-slate-400 block">
                                #{String(log.entityId).slice(-6)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 text-xs">
                            <div className="font-medium">{log.reason || 'Standard operational procedure'}</div>
                            {log.details && (
                              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                                {Object.entries(log.details)
                                  .filter(([_, v]) => v !== undefined && v !== null && v !== '')
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(' | ')}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {auditPagination.totalPages > 1 && (
                  <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Page {auditPage} of {auditPagination.totalPages} ({auditPagination.total} entries)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={auditPage <= 1}
                        onClick={() => setAuditPage((p) => p - 1)}
                        className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={auditPage >= auditPagination.totalPages}
                        onClick={() => setAuditPage((p) => p + 1)}
                        className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW: OVERVIEW / QUEUE / ALERTS (DEFAULT COMMAND CENTER)   */}
      {/* ========================================================== */}
      {(currentView === 'overview' || currentView === 'queue' || currentView === 'alerts') && (
        <>
          {/* Interactive Click-to-Filter Executive Metric Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Platform Metrics (Click to filter queue)
              </span>
              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Reset All Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {/* Card 1: Total Reports */}
              <button
                type="button"
                onClick={handleClearFilters}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  filterStatus === 'All' && filterSeverity === 'All' && !filterOverdue && !filterUnassigned
                    ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Active
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {statsLoading ? '...' : stats.totalIssues}
                </div>
                <span className="text-[10px] text-slate-400">All submissions</span>
              </button>

              {/* Card 2: Pending Review */}
              <button
                type="button"
                onClick={() => {
                  setFilterStatus((curr) => (curr === 'reported' ? 'All' : 'reported'));
                  setFilterOverdue(false);
                  setFilterUnassigned(false);
                  setPage(1);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  filterStatus === 'reported'
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    Pending
                  </span>
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-xl font-bold text-blue-700 mt-1">
                  {statsLoading ? '...' : stats.openIssues}
                </div>
                <span className="text-[10px] text-slate-500">Needs review</span>
              </button>

              {/* Card 3: In Progress */}
              <button
                type="button"
                onClick={() => {
                  setFilterStatus((curr) => (curr === 'in_progress' ? 'All' : 'in_progress'));
                  setFilterOverdue(false);
                  setFilterUnassigned(false);
                  setPage(1);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  filterStatus === 'in_progress'
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    In Progress
                  </span>
                  <Wrench className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-xl font-bold text-amber-700 mt-1">
                  {statsLoading ? '...' : stats.inProgress}
                </div>
                <span className="text-[10px] text-slate-500">Crew deployed</span>
              </button>

              {/* Card 4: Resolved */}
              <button
                type="button"
                onClick={() => {
                  setFilterStatus((curr) => (curr === 'resolved' ? 'All' : 'resolved'));
                  setFilterOverdue(false);
                  setFilterUnassigned(false);
                  setPage(1);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  filterStatus === 'resolved'
                    ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-emerald-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    Resolved
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-emerald-700 mt-1">
                  {statsLoading ? '...' : stats.resolved}
                </div>
                <span className="text-[10px] text-slate-500">Closed tickets</span>
              </button>

              {/* Card 5: Critical Hazards */}
              <button
                type="button"
                onClick={() => {
                  setFilterSeverity((curr) => (curr === 'critical' ? 'All' : 'critical'));
                  setFilterOverdue(false);
                  setFilterUnassigned(false);
                  setPage(1);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  filterSeverity === 'critical'
                    ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-200 shadow-xs'
                    : 'bg-white border-rose-200 hover:border-rose-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                    Critical
                  </span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="text-xl font-bold text-rose-700 mt-1">
                  {statsLoading ? '...' : stats.criticalIssues}
                </div>
                <span className="text-[10px] text-rose-600/80">Hazard alert</span>
              </button>

              {/* Card 6: Active Alerts */}
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('All');
                  setFilterOverdue(false);
                  setFilterUnassigned(false);
                  setPage(1);
                }}
                className="text-left p-3.5 rounded-xl border border-purple-200 bg-white hover:border-purple-300 shadow-2xs transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                    Alerts
                  </span>
                  <Megaphone className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="text-xl font-bold text-purple-700 mt-1">
                  {statsLoading ? '...' : stats.activeAlerts}
                </div>
                <span className="text-[10px] text-purple-600/80">Advisories</span>
              </button>

              {/* Card 7: Unassigned Tickets */}
              <button
                type="button"
                onClick={() => {
                  setFilterUnassigned((curr) => !curr);
                  setFilterOverdue(false);
                  setPage(1);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  filterUnassigned
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200 shadow-xs'
                    : 'bg-white border-amber-200 hover:border-amber-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Unassigned
                  </span>
                  <UserX className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-xl font-bold text-amber-700 mt-1">
                  {statsLoading ? '...' : stats.unassignedCount || 0}
                </div>
                <span className="text-[10px] text-amber-600/80">Needs routing</span>
              </button>

              {/* Card 8: Overdue SLA */}
              <button
                type="button"
                onClick={() => {
                  setFilterOverdue((curr) => !curr);
                  setFilterUnassigned(false);
                  setPage(1);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  filterOverdue
                    ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-200 shadow-xs'
                    : 'bg-white border-rose-200 hover:border-rose-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                    Overdue SLA
                  </span>
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="text-xl font-bold text-rose-700 mt-1">
                  {statsLoading ? '...' : stats.overdueCount || 0}
                </div>
                <span className="text-[10px] text-rose-600/80">Past target date</span>
              </button>
            </div>
          </div>

          {/* Visual Analytics Grid: 7-Day Velocity & Category/Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 7-Day Velocity Trend Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    7-Day Inflow Velocity
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Daily new incident reports</span>
              </div>

              {/* Bar Chart Container */}
              <div className="h-40 flex items-end justify-between gap-2 pt-6 pb-2 px-1 border-b border-slate-100">
                {(stats.recentVelocity || []).map((day, idx) => {
                  const heightPercent =
                    maxVelocityCount > 0 ? (day.count / maxVelocityCount) * 100 : 0;
                  const hasCount = day.count > 0;

                  return (
                    <div
                      key={day.date || idx}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                    >
                      <span
                        className={`text-[10px] font-bold transition-opacity ${
                          hasCount ? 'text-indigo-600' : 'text-slate-300'
                        }`}
                      >
                        {day.count}
                      </span>
                      <div className="w-full max-w-[28px] bg-slate-100 rounded-t-md h-full flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            hasCount
                              ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-700 group-hover:to-indigo-500'
                              : 'bg-transparent'
                          }`}
                          style={{ height: `${Math.max(hasCount ? 12 : 0, heightPercent)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>Aggregated past 7 calendar days</span>
                <span className="font-semibold text-slate-600">
                  Total Inflow: {(stats.recentVelocity || []).reduce((acc, v) => acc + v.count, 0)} reports
                </span>
              </div>
            </div>

            {/* Department & Operational Distribution */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Department Workload Routing
                  </h3>
                </div>
                <Link
                  to="/admin?view=departments"
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold"
                >
                  Manage Departments →
                </Link>
              </div>

              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {(stats.departmentDistribution || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-6 text-center">
                    No departmental tickets assigned yet.
                  </p>
                ) : (
                  (stats.departmentDistribution || []).map((dept) => {
                    const totalActiveDept = stats.totalIssues || 1;
                    const pct = Math.min(100, Math.round((dept.count / totalActiveDept) * 100));
                    return (
                      <div key={dept.departmentId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{dept.name}</span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {dept.count} {dept.count === 1 ? 'ticket' : 'tickets'} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(8, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Avg Resolution: <strong className="text-slate-800">{stats.avgResolutionTimeHours}h</strong></span>
                <span>Affirmations: <strong className="text-slate-800">{stats.totalAffirmations}</strong></span>
              </div>
            </div>
          </div>

          {/* Campus Hotspot Recurrence & Spatial Intelligence */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-purple-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Campus Recurrence Hotspots
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Spatial clustering identifying high-frequency campus infrastructure failures.
                </p>
              </div>

              <span className="text-xs text-slate-400 font-medium self-start sm:self-auto">
                14-Day Rolling Recurrence Window
              </span>
            </div>

            {hotspotsLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                <span>Aggregating campus zones...</span>
              </div>
            ) : hotspots.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No campus reports registered yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {hotspots
                  .filter((h) => h.totalReports > 0 || h.recurrenceScore > 0)
                  .slice(0, 6)
                  .map((h) => {
                    const isSelectedZone = filterCampusZone === h.zone;

                    return (
                      <div
                        key={h.zone}
                        className={`p-4 rounded-xl border transition-all ${
                          isSelectedZone
                            ? 'border-purple-400 bg-purple-50/60 ring-2 ring-purple-200'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-purple-600" />
                              <span>{getCampusZoneLabel(h.zone)}</span>
                            </h4>
                            <span className="text-[11px] text-slate-400">
                              {h.totalReports} total {h.totalReports === 1 ? 'report' : 'reports'}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              h.recurrenceScore >= 6
                                ? 'bg-rose-100 text-rose-700'
                                : h.recurrenceScore >= 3
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Flame className="w-3 h-3" />
                            <span>Score: {h.recurrenceScore}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-3">
                          <span className="bg-white border border-slate-200 px-2 py-0.5 rounded font-medium">
                            Active: <strong className="text-slate-900">{h.activeReports}</strong>
                          </span>
                          {h.criticalReports > 0 && (
                            <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded font-bold">
                              Critical: {h.criticalReports}
                            </span>
                          )}
                          <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                            Resolved: {h.resolvedReports}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setFilterCampusZone((curr) => (curr === h.zone ? 'All' : h.zone));
                            setPage(1);
                            document.getElementById('review-queue-section')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                            isSelectedZone
                              ? 'bg-purple-700 text-white border-purple-700'
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>{isSelectedZone ? 'Clear Zone Filter' : 'Drill Down Zone'}</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Review Queue Card */}
          <div id="review-queue-section" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header with Search and Advanced Filters */}
            <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Operational Review & Routing Queue
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review student reports, assign operational departments, set SLA deadlines, and authorize emergency alerts.
                  </p>
                </div>

                {/* Quick Sort Dropdown */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="urgency">Sort: Urgency (Critical First)</option>
                    <option value="oldest">Sort: Oldest Pending</option>
                    <option value="most_affirmed">Sort: Most Affirmed</option>
                  </select>
                </div>
              </div>

              {/* Multi-Attribute Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search title, building..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                >
                  <option value="All">All Statuses</option>
                  <option value="reported">Reported (Pending)</option>
                  <option value="verified">Verified</option>
                  <option value="in_progress">In Progress</option>
                  <option value="awaiting_info">Awaiting Info</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>

                {/* Department Filter */}
                <select
                  value={filterDepartment}
                  onChange={(e) => {
                    setFilterDepartment(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                >
                  <option value="All">All Departments</option>
                  {departmentsList.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>

                {/* Visibility Filter */}
                <select
                  value={filterVisibility}
                  onChange={(e) => {
                    setFilterVisibility(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                >
                  <option value="All">All Visibilities</option>
                  <option value="public">Public</option>
                  <option value="department_only">Department Only</option>
                  <option value="confidential">Confidential</option>
                </select>

                {/* Campus Zone Filter */}
                <select
                  value={filterCampusZone}
                  onChange={(e) => {
                    setFilterCampusZone(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                >
                  <option value="All">All Campus Zones</option>
                  {CAMPUS_ZONES.map((zone) => (
                    <option key={zone.value} value={zone.value}>
                      {zone.label}
                    </option>
                  ))}
                </select>

                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                >
                  {FILTER_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Filter Pills Bar */}
              {isAnyFilterActive && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Active filters:</span>
                  {filterStatus !== 'All' && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                      Status: {filterStatus}
                      <button type="button" onClick={() => setFilterStatus('All')} className="text-slate-400 hover:text-slate-600">✕</button>
                    </span>
                  )}
                  {filterDepartment !== 'All' && (
                    <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-[11px]">
                      Dept: {departmentsList.find((d) => d._id === filterDepartment)?.name || 'Filtered'}
                      <button type="button" onClick={() => setFilterDepartment('All')} className="text-purple-400 hover:text-purple-600">✕</button>
                    </span>
                  )}
                  {filterVisibility !== 'All' && (
                    <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-[11px]">
                      Visibility: {filterVisibility}
                      <button type="button" onClick={() => setFilterVisibility('All')} className="text-purple-400 hover:text-purple-600">✕</button>
                    </span>
                  )}
                  {filterOverdue && (
                    <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded-full text-[11px]">
                      Overdue SLA Only
                      <button type="button" onClick={() => setFilterOverdue(false)} className="text-rose-400 hover:text-rose-600">✕</button>
                    </span>
                  )}
                  {filterUnassigned && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-[11px]">
                      Unassigned Only
                      <button type="button" onClick={() => setFilterUnassigned(false)} className="text-amber-400 hover:text-amber-600">✕</button>
                    </span>
                  )}
                  {filterSeverity !== 'All' && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                      Severity: {filterSeverity}
                      <button type="button" onClick={() => setFilterSeverity('All')} className="text-slate-400 hover:text-slate-600">✕</button>
                    </span>
                  )}
                  {filterCampusZone !== 'All' && (
                    <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-[11px]">
                      Zone: {getCampusZoneLabel(filterCampusZone)}
                      <button type="button" onClick={() => setFilterCampusZone('All')} className="text-purple-400 hover:text-purple-600">✕</button>
                    </span>
                  )}
                  {filterCategory !== 'All' && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                      Category: {filterCategory}
                      <button type="button" onClick={() => setFilterCategory('All')} className="text-slate-400 hover:text-slate-600">✕</button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 ml-1"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Loading state */}
            {issuesLoading ? (
              <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span>Loading review queue from MongoDB...</span>
              </div>
            ) : error ? (
              <div className="p-6 text-center text-xs text-rose-600">
                <p>{error}</p>
              </div>
            ) : issues.length > 0 ? (
              <div>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Issue Details</th>
                        <th className="py-3 px-4">Department & Assignee</th>
                        <th className="py-3 px-4">Location & Zone</th>
                        <th className="py-3 px-4">Severity & SLA</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Signals / Alert</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {issues.map((issue) => (
                        <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 max-w-xs">
                            <Link
                              to={`/admin/issues/${issue.id}`}
                              className="font-semibold text-slate-900 hover:text-purple-700 block truncate"
                            >
                              {issue.title}
                            </Link>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="font-mono text-[11px] text-slate-400">
                                #{issue.id.slice(-6)}
                              </span>
                              <CategoryBadge category={issue.category} size="xs" />
                              {issue.visibility === 'confidential' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                                  <Lock className="w-2.5 h-2.5" /> Confidential
                                </span>
                              ) : issue.visibility === 'department_only' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  Dept Only
                                </span>
                              ) : null}
                              {issue.reopenCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                                  Reopened ({issue.reopenCount})
                                </span>
                              )}
                              <span className="text-slate-400 text-[11px]">
                                • {formatRelativeTime(issue.createdAt)}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {issue.department ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                  <Building2 className="w-3 h-3 text-purple-700" />
                                  {issue.department.name}
                                </span>
                                <div className="text-[11px] text-slate-500">
                                  {issue.assignedTo ? (
                                    <span className="text-slate-700 font-medium">
                                      👤 {issue.assignedTo.name}
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 font-medium">Unassigned specialist</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                Unassigned Dept
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600">
                            <div className="font-medium text-slate-800">
                              {issue.location?.building || 'Main Campus'}
                            </div>
                            <div className="text-[11px] text-indigo-700 font-medium">
                              {getCampusZoneLabel(issue.location?.campusZone)}
                            </div>
                            {issue.location?.area && (
                              <div className="text-[10px] text-slate-400">
                                {issue.location.area}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <SeverityBadge severity={issue.severity} size="xs" />
                              {issue.isOverdue ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                  <Clock className="w-2.5 h-2.5 text-rose-600" />
                                  Overdue SLA
                                </span>
                              ) : issue.resolutionDeadline ? (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  Due: {new Date(issue.resolutionDeadline).toLocaleDateString()}
                                </div>
                              ) : null}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <StatusBadge status={issue.status} size="xs" />
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                <Users className="w-3 h-3 text-slate-500" />
                                {issue.confirmationCount || 0} Affirmed
                              </span>
                              <div>
                                {issue.isCampusWideAlert ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                    <Megaphone className="w-3 h-3" />
                                    Alert Active
                                  </span>
                                ) : issue.campusAlertRequested ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                    <Megaphone className="w-3 h-3 text-amber-600" />
                                    Alert Req
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <Link
                              to={`/admin/issues/${issue.id}`}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md transition-colors inline-block"
                            >
                              Manage & Assign
                            </Link>

                            {/* If in reported status: Verify / Reject actions */}
                            {issue.status === 'reported' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReviewModal({
                                      issue,
                                      decision: 'verify',
                                      approveAlert: false,
                                      note: '',
                                    })
                                  }
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md transition-colors"
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReviewModal({
                                      issue,
                                      decision: 'reject',
                                      approveAlert: false,
                                      note: '',
                                    })
                                  }
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            ) : issue.status === 'verified' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setStatusModal({
                                    issue,
                                    targetStatus: 'in_progress',
                                    note: '',
                                  })
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md transition-colors"
                              >
                                Dispatch Crew
                              </button>
                            ) : issue.status === 'in_progress' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setStatusModal({
                                    issue,
                                    targetStatus: 'resolved',
                                    note: '',
                                  })
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md transition-colors"
                              >
                                Resolve
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Tablet List View */}
                <div className="lg:hidden divide-y divide-slate-100">
                  {issues.map((issue) => (
                    <div key={issue.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-400">
                          #{issue.id.slice(-6)}
                        </span>
                        <StatusBadge status={issue.status} size="xs" />
                      </div>
                      <h3 className="font-semibold text-sm text-slate-900">{issue.title}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <SeverityBadge severity={issue.severity} size="xs" />
                        <CategoryBadge category={issue.category} size="xs" />
                        {issue.department && (
                          <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                            {issue.department.name}
                          </span>
                        )}
                        {issue.visibility === 'confidential' && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                            Confidential
                          </span>
                        )}
                      </div>
                      <div className="pt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 truncate">{issue.location?.building}</span>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/admin/issues/${issue.id}`}
                            className="text-purple-700 font-semibold px-2 py-1 bg-purple-50 rounded"
                          >
                            Manage
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!pagination.hasPrevPage}
                        onClick={() => setPage((p) => p - 1)}
                        className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!pagination.hasNextPage}
                        onClick={() => setPage((p) => p + 1)}
                        className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                <EmptyState
                  title="No Issues Match Current Filters"
                  description="No campus reports in the queue match your active filter criteria."
                  action={
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-semibold"
                    >
                      Clear All Filters
                    </button>
                  }
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================== */}
      {/* MODALS SECTION                                            */}
      {/* ========================================================== */}

      {/* Department Create / Edit Modal */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingDept ? 'Edit Operational Department' : 'Create Operational Department'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Operational departments route campus issues and direct staff dispatch workloads.
            </p>

            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g. Electrical & Power, Campus Safety"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Routing Code *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingDept)}
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. ELEC, IT_SERVICES"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 uppercase font-mono disabled:opacity-60 focus:bg-white focus:border-purple-500"
                />
                {editingDept && (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Routing codes are immutable once created to preserve ticket links.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Description
                </label>
                <textarea
                  rows={3}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Operational scope, physical office location, and response specialties..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingDept ? 'Update Department' : 'Save Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Account Create / Edit Modal */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingStaff ? 'Edit Staff Member' : 'Provision Staff Account'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Staff members are granted access to the departmental triage work-queue (`/staff`).
            </p>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="e.g. John Doe, Lead Technician"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              {!editingStaff && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Institutional Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                      placeholder="staff.lead@campuspulse.edu"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Password *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                      placeholder="At least 6 characters"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Affiliation *
                </label>
                <select
                  required
                  value={staffForm.departmentId}
                  onChange={(e) => setStaffForm({ ...staffForm, departmentId: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                >
                  <option value="">Select Operational Department...</option>
                  {departmentsList.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingStaff ? 'Update Staff' : 'Create Staff Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {reviewModal.decision === 'verify' ? 'Verify Campus Report' : 'Reject Campus Report'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Issue #{reviewModal.issue.id.slice(-6)}: "{reviewModal.issue.title}"
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              {reviewModal.decision === 'verify' && reviewModal.issue.campusAlertRequested && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-1.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewModal.approveAlert}
                      onChange={(e) =>
                        setReviewModal({
                          ...reviewModal,
                          approveAlert: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-purple-900 block">
                        Approve Official Campus-Wide Advisory
                      </span>
                      <span className="text-purple-700/80 text-[11px]">
                        Reporter requested emergency broadcast visibility across student dashboards.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution / Review Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewModal.note}
                  onChange={(e) =>
                    setReviewModal({ ...reviewModal, note: e.target.value })
                  }
                  placeholder="Add notes for operations dispatch or reasons for review decision..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 ${
                    reviewModal.decision === 'verify'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{reviewModal.decision === 'verify' ? 'Confirm Verify' : 'Confirm Reject'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Transition Maintenance Status
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Moving issue #{statusModal.issue.id.slice(-6)} to target status:{' '}
              <strong className="text-purple-700 uppercase">
                {statusModal.targetStatus.replace('_', ' ')}
              </strong>
            </p>

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Transition Note
                </label>
                <textarea
                  rows={3}
                  value={statusModal.note}
                  onChange={(e) =>
                    setStatusModal({ ...statusModal, note: e.target.value })
                  }
                  placeholder="Describe maintenance crew deployment, parts ordered, or resolution summary..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModal(null)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Apply Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
