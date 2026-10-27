import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  ExternalLink,
  Link2,
  FolderKanban,
} from 'lucide-react';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import CategoryBadge from '../components/common/CategoryBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  adminAPI,
  departmentsAPI,
  getCampusZoneLabel,
  getCategoryLabel,
  CAMPUS_ZONES,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_VISIBILITIES,
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatRelativeTime, formatDate } from '../utils/formatters.js';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { showSuccess, showError, showInfo } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL View & Tab State
  const rawView = searchParams.get('view') || 'overview';
  const rawTab = searchParams.get('tab') || '';

  // Consolidate views:
  // 'overview' -> Overview
  // 'issues', 'queue', 'alerts' -> Issues & Incidents
  // 'operations', 'departments', 'staff' -> Operations
  // 'audit' -> Audit Trail
  const currentView = useMemo(() => {
    if (rawView === 'queue' || rawView === 'alerts' || rawView === 'issues') return 'issues';
    if (rawView === 'departments' || rawView === 'staff' || rawView === 'operations') return 'operations';
    if (rawView === 'audit') return 'audit';
    return 'overview';
  }, [rawView]);

  // Operations Sub-Tabs: 'departments' | 'staff' | 'workloads'
  const operationsTab = useMemo(() => {
    if (rawTab === 'staff' || rawView === 'staff') return 'staff';
    if (rawTab === 'workloads') return 'workloads';
    return 'departments';
  }, [rawTab, rawView]);

  // Issues Workspace Quick Tabs: 'all' | 'reported' | 'unassigned' | 'in_progress' | 'awaiting_info' | 'overdue' | 'alerts' | 'grouped' | 'resolved'
  const issuesTab = useMemo(() => {
    if (rawTab) return rawTab;
    if (rawView === 'queue') return 'reported';
    if (rawView === 'alerts') return 'alerts';
    return 'all';
  }, [rawTab, rawView]);

  // Filter States for Issues & Incidents
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterCampusZone, setFilterCampusZone] = useState('All');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterVisibility, setFilterVisibility] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  // Issues Data States
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Overview Statistics States
  const [stats, setStats] = useState({
    totalIssues: 0,
    openIssues: 0,
    inProgress: 0,
    resolved: 0,
    criticalCount: 0,
    overdueCount: 0,
    unassignedCount: 0,
    avgResolutionTimeHours: 0,
    totalAffirmations: 0,
    categoryDistribution: [],
    statusDistribution: {},
    recentVelocity: [],
    departmentDistribution: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Hotspot Analytics States
  const [hotspots, setHotspots] = useState([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);

  // Operations States: Departments
  const [departmentsList, setDepartmentsList] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });

  // Operations States: Staff
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffModalError, setStaffModalError] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', departmentId: '' });

  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState({ totalPages: 1, total: 0 });

  // Action Modals for Issues
  const [reviewModal, setReviewModal] = useState(null); // { issue, decision, approveAlert: false, note: '' }
  const [statusModal, setStatusModal] = useState(null); // { issue, targetStatus: '', note: '' }
  const [groupModal, setGroupModal] = useState(null); // { issue, targetIncidentId: '', reason: '' }
  const [ungroupModal, setUngroupModal] = useState(null); // { issue, reason: '' }
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Data Fetchers
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

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await adminAPI.getStats();
      if (res && res.data) {
        setStats(res.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchHotspots = useCallback(async () => {
    try {
      setHotspotsLoading(true);
      const res = await adminAPI.getHotspots();
      if (res && res.data && Array.isArray(res.data.hotspots)) {
        setHotspots(res.data.hotspots);
      }
    } catch {
      // Non-blocking
    } finally {
      setHotspotsLoading(false);
    }
  }, []);

  const fetchIssues = useCallback(async () => {
    setIssuesLoading(true);
    setError(null);

    const params = {
      page,
      limit: 10,
    };

    // Apply quick tab filter
    if (issuesTab === 'reported') {
      params.status = 'reported';
    } else if (issuesTab === 'unassigned') {
      params.unassignedOnly = 'true';
    } else if (issuesTab === 'in_progress') {
      params.status = 'in_progress';
    } else if (issuesTab === 'awaiting_info') {
      params.status = 'awaiting_info';
    } else if (issuesTab === 'overdue') {
      params.isOverdue = 'true';
    } else if (issuesTab === 'alerts') {
      params.isCampusWideAlert = 'true';
    } else if (issuesTab === 'grouped') {
      params.groupedOnly = 'true';
    } else if (issuesTab === 'resolved') {
      params.status = 'resolved';
    }

    if (filterSeverity !== 'All') params.severity = filterSeverity.toLowerCase();
    if (filterCampusZone !== 'All') params.campusZone = filterCampusZone.toLowerCase();
    if (filterCategory !== 'All') params.category = filterCategory.toLowerCase();
    if (filterDepartment !== 'All') params.department = filterDepartment;
    if (filterVisibility !== 'All') params.visibility = filterVisibility;
    if (sort !== 'newest') params.sort = sort;
    if (searchQuery.trim()) params.search = searchQuery.trim();

    try {
      const res = await adminAPI.getIssues(params);
      if (res && res.data) {
        setIssues(res.data.issues || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch issues.');
    } finally {
      setIssuesLoading(false);
    }
  }, [
    page,
    issuesTab,
    filterSeverity,
    filterCampusZone,
    filterCategory,
    filterDepartment,
    filterVisibility,
    sort,
    searchQuery,
  ]);

  // Initial and reactive effects
  useEffect(() => {
    fetchDepartments();
    fetchStats();
    fetchHotspots();
  }, [fetchDepartments, fetchStats, fetchHotspots]);

  useEffect(() => {
    if (currentView === 'issues') {
      fetchIssues();
    } else if (currentView === 'operations') {
      if (operationsTab === 'departments' || operationsTab === 'workloads') fetchDepartments();
      if (operationsTab === 'staff' || operationsTab === 'workloads') fetchStaff();
    } else if (currentView === 'audit') {
      fetchAuditLogs();
    }
  }, [currentView, operationsTab, fetchIssues, fetchDepartments, fetchStaff, fetchAuditLogs]);

  // Realtime Socket listener
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeSync = () => {
      fetchStats();
      fetchHotspots();
      if (currentView === 'issues') fetchIssues();
      else if (currentView === 'operations') {
        fetchDepartments();
        fetchStaff();
      } else if (currentView === 'audit') {
        fetchAuditLogs();
      }
    };

    socket.on('issue:created', handleRealtimeSync);
    socket.on('issue:updated', handleRealtimeSync);
    socket.on('issue:statusChanged', handleRealtimeSync);
    socket.on('alert:approved', handleRealtimeSync);
    socket.on('issue:grouped', handleRealtimeSync);
    socket.on('issue:ungrouped', handleRealtimeSync);

    return () => {
      socket.off('issue:created', handleRealtimeSync);
      socket.off('issue:updated', handleRealtimeSync);
      socket.off('issue:statusChanged', handleRealtimeSync);
      socket.off('alert:approved', handleRealtimeSync);
      socket.off('issue:grouped', handleRealtimeSync);
      socket.off('issue:ungrouped', handleRealtimeSync);
    };
  }, [socket, currentView, fetchStats, fetchHotspots, fetchIssues, fetchDepartments, fetchStaff, fetchAuditLogs]);

  // 2. Action Handlers
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

      await adminAPI.reviewIssue(reviewModal.issue.id || reviewModal.issue._id, payload);
      showSuccess(
        `Report was marked as ${reviewModal.decision === 'verify' ? 'Verified' : 'Rejected'}.`
      );
      setReviewModal(null);
      fetchStats();
      fetchIssues();
    } catch (err) {
      showError(err.message || 'Failed to complete review decision.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusModal || !statusModal.targetStatus) return;

    setIsProcessing(true);
    try {
      const payload = {
        status: statusModal.targetStatus,
        resolutionNote: statusModal.note ? statusModal.note.trim() : '',
      };

      await adminAPI.updateStatus(statusModal.issue.id || statusModal.issue._id, payload);
      showSuccess(`Status updated to '${statusModal.targetStatus.replace('_', ' ')}'.`);
      setStatusModal(null);
      fetchStats();
      fetchIssues();
    } catch (err) {
      showError(err.message || 'Failed to update status.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupModal || !groupModal.targetIncidentId) {
      showError('Please select a target incident to group into.');
      return;
    }

    setIsProcessing(true);
    try {
      await adminAPI.groupIssue(groupModal.issue.id || groupModal.issue._id, {
        targetIncidentId: groupModal.targetIncidentId,
        reason: groupModal.reason ? groupModal.reason.trim() : 'Grouped by administrator',
      });
      showSuccess('Report successfully grouped into incident.');
      setGroupModal(null);
      fetchIssues();
      fetchStats();
    } catch (err) {
      showError(err.message || 'Failed to group report.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUngroupSubmit = async (e) => {
    e.preventDefault();
    if (!ungroupModal) return;

    setIsProcessing(true);
    try {
      await adminAPI.ungroupIssue(ungroupModal.issue.id || ungroupModal.issue._id, {
        reason: ungroupModal.reason ? ungroupModal.reason.trim() : 'Unlinked by administrator',
      });
      showSuccess('Report unlinked from incident group.');
      setUngroupModal(null);
      fetchIssues();
      fetchStats();
    } catch (err) {
      showError(err.message || 'Failed to ungroup report.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Department Handlers
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

  const handleSaveDept = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim() || !deptForm.code.trim()) return;

    setIsProcessing(true);
    try {
      if (editingDept) {
        await departmentsAPI.update(editingDept._id || editingDept.id, {
          name: deptForm.name.trim(),
          description: deptForm.description.trim(),
        });
        showSuccess(`Department "${deptForm.name}" updated successfully.`);
      } else {
        await departmentsAPI.create({
          name: deptForm.name.trim(),
          code: deptForm.code.trim().toUpperCase(),
          description: deptForm.description.trim(),
        });
        showSuccess(`Department "${deptForm.name}" created successfully.`);
      }
      setDeptModalOpen(false);
      fetchDepartments();
    } catch (err) {
      showError(err.message || 'Failed to save department.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleDeptActive = async (dept) => {
    try {
      await departmentsAPI.update(dept._id || dept.id, {
        isActive: !dept.isActive,
      });
      showSuccess(
        `Department "${dept.name}" ${!dept.isActive ? 'activated' : 'deactivated'}.`
      );
      fetchDepartments();
    } catch (err) {
      showError(err.message || 'Failed to update department status.');
    }
  };

  // Staff Handlers
  const handleOpenNewStaffModal = () => {
    setEditingStaff(null);
    setStaffModalError(null);
    setStaffForm({
      name: '',
      email: '',
      password: '',
      departmentId: '',
    });
    setStaffModalOpen(true);
  };

  const handleOpenEditStaffModal = (staffUser) => {
    setEditingStaff(staffUser);
    setStaffModalError(null);
    const existingDeptId =
      staffUser.department?._id ||
      staffUser.department?.id ||
      (typeof staffUser.department === 'string' ? staffUser.department : '');
    setStaffForm({
      name: staffUser.name || '',
      email: staffUser.email || '',
      password: '',
      departmentId: existingDeptId,
    });
    setStaffModalOpen(true);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setStaffModalError(null);

    const name = staffForm.name.trim();
    const departmentId = (staffForm.departmentId || '').trim();

    if (!name || name.length < 2) {
      setStaffModalError('Staff name is required (minimum 2 characters).');
      return;
    }

    if (!departmentId) {
      setStaffModalError('Please select a valid operational department.');
      return;
    }

    setIsProcessing(true);
    try {
      if (editingStaff) {
        const staffId = editingStaff._id || editingStaff.id;
        await adminAPI.updateStaff(staffId, {
          name,
          departmentId,
        });
        showSuccess(`Staff account "${name}" updated successfully.`);
        setStaffModalOpen(false);
        fetchStaff();
      } else {
        const email = staffForm.email.trim();
        const password = staffForm.password;

        if (!email) {
          throw new Error('A valid institutional email address is required.');
        }
        if (!password || password.length < 6) {
          throw new Error('Initial password must be at least 6 characters long.');
        }

        await adminAPI.createStaff({
          name,
          email,
          password,
          departmentId,
        });
        showSuccess(`Staff member "${name}" created successfully.`);
        setStaffModalOpen(false);
        fetchStaff();
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to save staff member.';
      setStaffModalError(errMsg);
      showError(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStaffActive = async (staffUser) => {
    try {
      const staffId = staffUser._id || staffUser.id;
      await adminAPI.updateStaff(staffId, {
        isActive: !staffUser.isActive,
      });
      showSuccess(
        `Staff account "${staffUser.name}" ${!staffUser.isActive ? 'activated' : 'deactivated'}.`
      );
      fetchStaff();
    } catch (err) {
      showError(err.message || 'Failed to toggle staff active state.');
    }
  };

  // Department Workloads Map
  const deptWorkloadMap = useMemo(() => {
    const map = new Map();
    (stats.departmentDistribution || []).forEach((d) => {
      map.set(d.departmentId?.toString(), d.count);
    });
    return map;
  }, [stats.departmentDistribution]);

  // Max daily count in velocity chart
  const maxVelocityCount = Math.max(
    1,
    ...(stats.recentVelocity || []).map((v) => v.count)
  );

  // Top Urgent Items requiring immediate attention on Overview
  const urgentItems = useMemo(() => {
    return issues
      .filter(
        (i) =>
          i.status === 'reported' ||
          i.severity === 'critical' ||
          i.severity === 'high' ||
          Boolean(i.isOverdue)
      )
      .slice(0, 5);
  }, [issues]);

  const handleResetFilters = () => {
    setFilterCategory('All');
    setFilterSeverity('All');
    setFilterCampusZone('All');
    setFilterDepartment('All');
    setFilterVisibility('All');
    setSearchQuery('');
    setSort('newest');
    setPage(1);
  };

  const isAnyFilterActive =
    filterCategory !== 'All' ||
    filterSeverity !== 'All' ||
    filterCampusZone !== 'All' ||
    filterDepartment !== 'All' ||
    filterVisibility !== 'All' ||
    searchQuery.trim().length > 0 ||
    sort !== 'newest';

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-purple-700 text-white px-2 py-0.5 rounded">
              Campus Command Center
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Operations Lead: {user?.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {currentView === 'overview' && 'Administrative Overview'}
            {currentView === 'issues' && 'Issues & Incidents Management'}
            {currentView === 'operations' && 'Operational Administration'}
            {currentView === 'audit' && 'System Audit Trail'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentView === 'overview' &&
              'High-level campus health, critical priorities, velocity metrics, and items requiring attention.'}
            {currentView === 'issues' &&
              'Primary consolidated workspace to review, triage, group, assign, and resolve campus incident reports.'}
            {currentView === 'operations' &&
              'Manage campus operational units, specialist staff rosters, and department workload distributions.'}
            {currentView === 'audit' &&
              'Immutable chronological security log of reassignments, status transitions, and confidentiality updates.'}
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {currentView === 'operations' && operationsTab === 'departments' && (
            <button
              type="button"
              onClick={handleOpenNewDeptModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Department</span>
            </button>
          )}

          {currentView === 'operations' && operationsTab === 'staff' && (
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
              if (currentView === 'issues') fetchIssues();
              else if (currentView === 'operations') {
                fetchDepartments();
                fetchStaff();
              } else if (currentView === 'audit') fetchAuditLogs();
            }}
            disabled={issuesLoading || deptLoading || staffLoading || auditLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                issuesLoading || deptLoading || staffLoading || auditLoading ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. VIEW: OVERVIEW (CONCISE LANDING PAGE)                   */}
      {/* ========================================================== */}
      {currentView === 'overview' && (
        <div className="space-y-6">
          {/* Executive Metric Cards (Click to navigate to Issues workspace with filter) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Open Issues Card */}
            <button
              type="button"
              onClick={() => navigate('/admin?view=issues&tab=all')}
              className="text-left p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white hover:border-blue-400 hover:shadow-md transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between text-blue-700">
                <span className="text-xs font-bold uppercase tracking-wider">Open Issues</span>
                <Clock className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {statsLoading ? '...' : (stats.openIssues || 0) + (stats.inProgress || 0)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Active issues across campus →
              </span>
            </button>

            {/* High Priority Card */}
            <button
              type="button"
              onClick={() => navigate('/admin?view=issues&tab=all&severity=high')}
              className="text-left p-4 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/50 to-white hover:border-rose-400 hover:shadow-md transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between text-rose-700">
                <span className="text-xs font-bold uppercase tracking-wider">High & Critical</span>
                <AlertTriangle className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-rose-700 mt-2">
                {statsLoading ? '...' : stats.criticalCount || 0}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Urgent safety & facility hazards →
              </span>
            </button>

            {/* Overdue Issues Card */}
            <button
              type="button"
              onClick={() => navigate('/admin?view=issues&tab=overdue')}
              className="text-left p-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white hover:border-amber-400 hover:shadow-md transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between text-amber-700">
                <span className="text-xs font-bold uppercase tracking-wider">Overdue Issues</span>
                <Flame className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-amber-700 mt-2">
                {statsLoading ? '...' : stats.overdueCount || 0}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Passed resolution SLA deadline →
              </span>
            </button>

            {/* Awaiting Assignment Card */}
            <button
              type="button"
              onClick={() => navigate('/admin?view=issues&tab=unassigned')}
              className="text-left p-4 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/50 to-white hover:border-purple-400 hover:shadow-md transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between text-purple-700">
                <span className="text-xs font-bold uppercase tracking-wider">Awaiting Staff</span>
                <Users className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-purple-700 mt-2">
                {statsLoading ? '...' : stats.unassignedCount || 0}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Needs department staff assigned →
              </span>
            </button>
          </div>

          {/* Items Requiring Immediate Attention */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Items Requiring Immediate Attention
                </h3>
              </div>
              <Link
                to="/admin?view=issues&tab=reported"
                className="text-xs font-semibold text-purple-700 hover:text-purple-900"
              >
                Open Review Queue →
              </Link>
            </div>

            {urgentItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <span>All priority issues are currently reviewed and on schedule!</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {urgentItems.map((item) => {
                  const id = item.id || item._id;
                  return (
                    <div
                      key={id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/admin/issues/${id}`}
                            className="font-bold text-slate-900 hover:text-purple-700 truncate max-w-md text-sm"
                          >
                            {item.title}
                          </Link>
                          <SeverityBadge severity={item.severity} size="xs" />
                          <StatusBadge status={item.status} size="xs" />
                          {item.isCampusWideAlert && (
                            <span className="text-[10px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded">
                              Alert
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>📍 {item.location?.building}</span>
                          <span>•</span>
                          <span>👤 {item.createdBy?.name || 'Student'}</span>
                          <span>•</span>
                          <span>🕒 {formatRelativeTime(item.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'reported' && (
                          <button
                            type="button"
                            onClick={() =>
                              setReviewModal({
                                issue: item,
                                decision: 'verify',
                                approveAlert: Boolean(item.campusAlertRequested),
                                note: '',
                              })
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-xs transition-colors"
                          >
                            Quick Review
                          </button>
                        )}
                        <Link
                          to={`/admin/issues/${id}`}
                          className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trend Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category Breakdown Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Category Distribution
                  </h3>
                </div>
                <span className="text-xs text-slate-400">Total: {stats.totalIssues}</span>
              </div>

              <div className="space-y-3">
                {(stats.categoryDistribution || []).map((cat) => {
                  const pct = stats.totalIssues > 0 ? Math.round((cat.count / stats.totalIssues) * 100) : 0;
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 capitalize">
                          {getCategoryLabel(cat.category)}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {cat.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 7-Day Velocity Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      7-Day Inflow Velocity
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">Daily reports</span>
                </div>

                <div className="h-40 flex items-end justify-between gap-2 pt-6 pb-2 px-1 border-b border-slate-100">
                  {(stats.recentVelocity || []).map((day, idx) => {
                    const heightPercent = maxVelocityCount > 0 ? (day.count / maxVelocityCount) * 100 : 0;
                    const hasCount = day.count > 0;

                    return (
                      <div
                        key={day.date || idx}
                        className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                      >
                        <span
                          className={`text-[10px] font-bold ${
                            hasCount ? 'text-purple-700' : 'text-slate-300'
                          }`}
                        >
                          {day.count}
                        </span>
                        <div className="w-full max-w-[28px] bg-slate-100 rounded-t-md h-full flex items-end overflow-hidden">
                          <div
                            className={`w-full rounded-t-md transition-all duration-500 ${
                              hasCount
                                ? 'bg-gradient-to-t from-purple-700 to-purple-400 group-hover:from-purple-800'
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
              </div>

              <div className="pt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Avg Resolution Time: <strong className="text-slate-800">{stats.avgResolutionTimeHours}h</strong></span>
                <span>Community Affirmations: <strong className="text-slate-800">{stats.totalAffirmations}</strong></span>
              </div>
            </div>
          </div>

          {/* Campus Hotspots Intelligence */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-purple-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Campus Recurrence Hotspots
                </h3>
              </div>
              <span className="text-xs text-slate-400">14-Day Rolling Window</span>
            </div>

            {hotspotsLoading ? (
              <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span>Aggregating hotspots...</span>
              </div>
            ) : hotspots.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No campus hotspots detected yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {hotspots.map((h) => (
                  <div
                    key={h.zone}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">
                        {getCampusZoneLabel(h.zone)}
                      </span>
                      <span className="font-bold text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                        {h.count} reports
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Top Building: <strong className="text-slate-700">{h.topBuilding || 'Multiple'}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 2. VIEW: ISSUES & INCIDENTS (UNIFIED WORKSPACE)           */}
      {/* ========================================================== */}
      {currentView === 'issues' && (
        <div className="space-y-4">
          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
            {[
              { id: 'all', label: 'All Issues' },
              { id: 'reported', label: 'Unreviewed' },
              { id: 'unassigned', label: 'Unassigned' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'awaiting_info', label: 'Awaiting Info' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'alerts', label: 'Campus Alerts' },
              { id: 'grouped', label: 'Grouped Incidents' },
              { id: 'resolved', label: 'Resolved' },
            ].map((tab) => {
              const isActive = issuesTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSearchParams({ view: 'issues', tab: tab.id });
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search input */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search issues by title, description, building..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-purple-500"
                />
              </div>

              {/* Category filter */}
              <div>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full py-2 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                >
                  <option value="All">All Categories</option>
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department filter */}
              <div>
                <select
                  value={filterDepartment}
                  onChange={(e) => {
                    setFilterDepartment(e.target.value);
                    setPage(1);
                  }}
                  className="w-full py-2 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                >
                  <option value="All">All Departments</option>
                  {departmentsList.map((d) => (
                    <option key={d.id || d._id} value={d.id || d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity filter */}
              <div>
                <select
                  value={filterSeverity}
                  onChange={(e) => {
                    setFilterSeverity(e.target.value);
                    setPage(1);
                  }}
                  className="w-full py-2 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                >
                  <option value="All">All Severities</option>
                  {ISSUE_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filters pill & reset */}
            {isAnyFilterActive && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-medium">
                  Custom filters applied to table
                </span>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-purple-700 hover:text-purple-900 font-semibold"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>

          {/* Issues Data Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {issuesLoading ? (
              <div className="p-16 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                <span>Loading issues workspace...</span>
              </div>
            ) : issues.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">No issues found matching current criteria.</p>
                <p className="text-slate-400">Try adjusting your filters or search keywords.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Issue Details</th>
                      <th className="py-3 px-4">Category & Zone</th>
                      <th className="py-3 px-4">Department & Staff</th>
                      <th className="py-3 px-4">Status & Priority</th>
                      <th className="py-3 px-4">Grouping Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {issues.map((issue) => {
                      const id = issue.id || issue._id;
                      const isGroup = issue.isIncidentGroup || issue.groupedReportsCount > 0;
                      const isChild = Boolean(issue.parentIssueId);

                      return (
                        <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 max-w-sm">
                            <div className="space-y-0.5">
                              <Link
                                to={`/admin/issues/${id}`}
                                className="font-bold text-slate-900 hover:text-purple-700 leading-snug line-clamp-1 text-xs"
                              >
                                {issue.title}
                              </Link>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                <span>📍 {issue.location?.building}</span>
                                <span>•</span>
                                <span>👤 {issue.createdBy?.name || 'Student'}</span>
                                <span>•</span>
                                <span>🕒 {formatRelativeTime(issue.createdAt)}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <CategoryBadge category={issue.category} size="xs" />
                              <div className="text-[10px] text-slate-500">
                                {getCampusZoneLabel(issue.location?.campusZone)}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-0.5 text-xs">
                              <div className="font-semibold text-slate-800">
                                {issue.department?.name || (
                                  <span className="text-amber-600 font-normal">Unassigned</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {issue.assignedTo?.name ? (
                                  <span>Staff: {issue.assignedTo.name}</span>
                                ) : (
                                  <span className="text-slate-400">No staff assigned</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <StatusBadge status={issue.status} size="xs" />
                                {issue.isCampusWideAlert && (
                                  <span className="text-[9px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded uppercase">
                                    Alert
                                  </span>
                                )}
                              </div>
                              <SeverityBadge severity={issue.severity} size="xs" />
                            </div>
                          </td>

                          {/* Smart Grouping Status Cell */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isGroup ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                <Layers className="w-3 h-3 text-indigo-600" />
                                Group ({issue.groupedReportsCount} linked)
                              </span>
                            ) : isChild ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                  <Link2 className="w-3 h-3 text-slate-500" />
                                  Linked to Incident
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setUngroupModal({ issue, reason: '' })}
                                  className="block text-[10px] text-rose-600 hover:text-rose-800 font-semibold"
                                >
                                  Ungroup
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setGroupModal({ issue, targetIncidentId: '', reason: '' })
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-purple-700 hover:underline"
                              >
                                <Layers className="w-3 h-3" />
                                <span>Group into Incident</span>
                              </button>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {issue.status === 'reported' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewModal({
                                    issue,
                                    decision: 'verify',
                                    approveAlert: Boolean(issue.campusAlertRequested),
                                    note: '',
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
                              >
                                Review
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setStatusModal({
                                  issue,
                                  targetStatus: issue.status,
                                  note: '',
                                })
                              }
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                            >
                              Status
                            </button>
                            <Link
                              to={`/admin/issues/${id}`}
                              className="px-2 py-1 text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md transition-colors"
                            >
                              Details →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50">
                <span className="text-slate-500">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded bg-white border border-slate-200 font-semibold disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2.5 py-1 rounded bg-white border border-slate-200 font-semibold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 3. VIEW: OPERATIONS (DEPARTMENTS, STAFF & WORKLOADS)       */}
      {/* ========================================================== */}
      {currentView === 'operations' && (
        <div className="space-y-4">
          {/* Operations Sub-Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {[
              { id: 'departments', label: 'Departments & Routing', icon: Building2 },
              { id: 'staff', label: 'Staff Accounts', icon: Users },
              { id: 'workloads', label: 'Department Workloads', icon: Briefcase },
            ].map((subTab) => {
              const isActive = operationsTab === subTab.id;
              const Icon = subTab.icon;
              return (
                <button
                  key={subTab.id}
                  type="button"
                  onClick={() => setSearchParams({ view: 'operations', tab: subTab.id })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{subTab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sub-Tab 1: Departments */}
          {operationsTab === 'departments' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-700" />
                    <span>Campus Operations Roster ({departmentsList.length} Departments)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Departments receive routed issues and have dedicated staff work queues.
                  </p>
                </div>
              </div>

              {deptLoading ? (
                <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  <span>Loading departments...</span>
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
                        <th className="py-3 px-4">Department & Code</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Active Workload</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departmentsList.map((dept) => {
                        const deptId = dept.id || dept._id;
                        const workload = deptWorkloadMap.get(deptId) || 0;
                        return (
                          <tr key={deptId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                <span>{dept.name}</span>
                                <span className="font-mono text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded uppercase font-semibold">
                                  {dept.code}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-md text-slate-600 text-xs">
                              {dept.description || <span className="text-slate-400 italic">No description</span>}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                <Briefcase className="w-3 h-3 text-slate-500" />
                                {workload} active
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {dept.isActive ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Active
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
          )}

          {/* Sub-Tab 2: Staff Accounts */}
          {operationsTab === 'staff' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-700" />
                    <span>Department Staff Roster ({staffList.length} Staff Accounts)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authorized maintenance specialists and technicians with dedicated department queues.
                  </p>
                </div>
              </div>

              {staffLoading ? (
                <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  <span>Loading staff roster...</span>
                </div>
              ) : staffList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <p>No department staff accounts provisioned yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Staff Name & Email</th>
                        <th className="py-3 px-4">Assigned Department</th>
                        <th className="py-3 px-4">Assigned Workload</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffList.map((member) => {
                        const memberId = member.id || member._id;
                        return (
                          <tr key={memberId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 text-xs">{member.name}</div>
                              <div className="text-[11px] text-slate-500">{member.email}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800">
                                {member.department?.name || member.departmentName || 'Unassigned'}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                {member.activeIssuesCount || 0} active tickets
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {member.isActive !== false ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                  Suspended
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenEditStaffModal(member)}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStaffActive(member)}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                                  member.isActive !== false
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {member.isActive !== false ? 'Suspend' : 'Activate'}
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
          )}

          {/* Sub-Tab 3: Department Workloads */}
          {operationsTab === 'workloads' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Active Tickets per Department
                </h3>
                <div className="space-y-3">
                  {departmentsList.map((dept) => {
                    const deptId = dept.id || dept._id;
                    const count = deptWorkloadMap.get(deptId) || 0;
                    const pct = stats.totalIssues > 0 ? Math.round((count / stats.totalIssues) * 100) : 0;
                    return (
                      <div key={deptId} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-slate-800">{dept.name} ({dept.code})</span>
                          <span className="text-slate-500 font-mono">{count} tickets ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Staff Specialist Assignment
                </h3>
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {staffList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No staff provisioned yet.</p>
                  ) : (
                    staffList.map((st) => (
                      <div
                        key={st.id || st._id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 block">{st.name}</span>
                          <span className="text-[11px] text-slate-500">
                            {st.department?.name || st.departmentName || 'General Maintenance'}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded font-bold bg-purple-50 text-purple-700 text-[11px]">
                          {st.activeIssuesCount || 0} active tickets
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* 4. VIEW: AUDIT TRAIL                                       */}
      {/* ========================================================== */}
      {currentView === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-700" />
                <span>Administrative Audit Trail ({auditPagination.total || 0} Events)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Full chronological ledger of security, assignment, and status modifications.
              </p>
            </div>
          </div>

          {auditLoading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <span>Loading audit ledger...</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <p>No audit events recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => {
                    const logId = log.id || log._id;
                    return (
                      <tr key={logId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded font-semibold uppercase">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {log.actor?.name || 'Administrator'}
                        </td>
                        <td className="py-3 px-4 max-w-xs text-slate-600 truncate">
                          {log.reason || <span className="text-slate-400 italic">No reason provided</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {log.entityType}: {log.entityId?.toString().slice(-6)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 whitespace-nowrap">
                          {formatDate(log.timestamp || log.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {auditPagination.totalPages > 1 && (
            <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50">
              <span className="text-slate-500">
                Page {auditPagination.page} of {auditPagination.totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded bg-white border border-slate-200 font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={auditPage >= auditPagination.totalPages}
                  onClick={() => setAuditPage((p) => p + 1)}
                  className="px-2.5 py-1 rounded bg-white border border-slate-200 font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* MODALS                                                     */}
      {/* ========================================================== */}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">Moderation Review Decision</h3>
            <p className="text-xs text-slate-500 mb-4">
              Review report #{reviewModal.issue.id?.slice(-6) || reviewModal.issue._id?.slice(-6)}: "{reviewModal.issue.title}"
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewModal({ ...reviewModal, decision: 'verify' })}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    reviewModal.decision === 'verify'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                  <span className="text-xs block">Verify Issue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewModal({ ...reviewModal, decision: 'reject' })}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    reviewModal.decision === 'reject'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-200 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <X className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                  <span className="text-xs block">Reject Issue</span>
                </button>
              </div>

              {reviewModal.decision === 'verify' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewModal.approveAlert}
                      onChange={(e) => setReviewModal({ ...reviewModal, approveAlert: e.target.checked })}
                      className="mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-purple-900 block">
                        Approve Official Campus-Wide Advisory
                      </span>
                      <span className="text-purple-700/80 text-[11px]">
                        Broadcast priority emergency visibility across all student dashboards.
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
                  onChange={(e) => setReviewModal({ ...reviewModal, note: e.target.value })}
                  placeholder="Add notes for operations dispatch..."
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
            <h3 className="text-base font-bold text-slate-900 mb-1">Update Issue Status</h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating report #{statusModal.issue.id?.slice(-6) || statusModal.issue._id?.slice(-6)}: "{statusModal.issue.title}"
            </p>

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Status *
                </label>
                <select
                  value={statusModal.targetStatus}
                  onChange={(e) => setStatusModal({ ...statusModal, targetStatus: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                >
                  {ISSUE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st.toUpperCase().replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Transition Note
                </label>
                <textarea
                  rows={3}
                  value={statusModal.note}
                  onChange={(e) => setStatusModal({ ...statusModal, note: e.target.value })}
                  placeholder="Describe maintenance progress or resolution note..."
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

      {/* Group Issue Modal */}
      {groupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Group into Campus Incident</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Link report #{groupModal.issue.id?.slice(-6) || groupModal.issue._id?.slice(-6)}: "{groupModal.issue.title}" into an existing incident group.
            </p>

            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Target Incident Group *
                </label>
                <select
                  required
                  value={groupModal.targetIncidentId}
                  onChange={(e) => setGroupModal({ ...groupModal, targetIncidentId: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                >
                  <option value="">Select an open canonical incident...</option>
                  {issues
                    .filter(
                      (i) =>
                        (i.id || i._id) !== (groupModal.issue.id || groupModal.issue._id) &&
                        !i.parentIssueId &&
                        i.status !== 'rejected'
                    )
                    .map((cand) => (
                      <option key={cand.id || cand._id} value={cand.id || cand._id}>
                        {cand.title} ({cand.location?.building}) — {cand.status}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Reports will be grouped under the selected incident. The student reporter's details and photo are completely preserved.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Grouping *
                </label>
                <input
                  type="text"
                  required
                  value={groupModal.reason}
                  onChange={(e) => setGroupModal({ ...groupModal, reason: e.target.value })}
                  placeholder="e.g. Duplicate report describing identical water cooler failure"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGroupModal(null)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Grouping</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ungroup Issue Modal */}
      {ungroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">Unlink from Incident Group</h3>
            <p className="text-xs text-slate-500 mb-4">
              Restore report "{ungroupModal.issue.title}" as an independent standalone campus issue.
            </p>

            <form onSubmit={handleUngroupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Unlinking *
                </label>
                <input
                  type="text"
                  required
                  value={ungroupModal.reason}
                  onChange={(e) => setUngroupModal({ ...ungroupModal, reason: e.target.value })}
                  placeholder="e.g. Separate issue located in adjacent electrical closet"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUngroupModal(null)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Ungroup</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingDept ? 'Edit Operational Department' : 'Create Campus Department'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure department routing rules and incident assignment categories.
            </p>

            <form onSubmit={handleSaveDept} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g. IT Support & Networking"
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
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  placeholder="e.g. it_support"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Describe operational responsibilities and service coverage..."
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
                  <span>{editingDept ? 'Save Changes' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingStaff ? 'Edit Staff Account' : 'Provision Staff Specialist'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Manage technician assignment and privileged departmental work queues.
            </p>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              {staffModalError && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="flex-1 font-medium">{staffModalError}</span>
                  <button
                    type="button"
                    onClick={() => setStaffModalError(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.name}
                  onChange={(e) => {
                    setStaffModalError(null);
                    setStaffForm({ ...staffForm, name: e.target.value });
                  }}
                  placeholder="e.g. John Doe, Lead Technician"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              {!editingStaff && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Institutional Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={staffForm.email}
                      onChange={(e) => {
                        setStaffModalError(null);
                        setStaffForm({ ...staffForm, email: e.target.value });
                      }}
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
                      onChange={(e) => {
                        setStaffModalError(null);
                        setStaffForm({ ...staffForm, password: e.target.value });
                      }}
                      placeholder="At least 6 characters"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Operational Department *
                </label>
                <select
                  required
                  value={staffForm.departmentId}
                  onChange={(e) => {
                    setStaffModalError(null);
                    setStaffForm({ ...staffForm, departmentId: e.target.value });
                  }}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-purple-500"
                >
                  <option value="">Select Operational Department...</option>
                  {departmentsList
                    .filter((d) => d.isActive !== false)
                    .map((d) => {
                      const id = d._id || d.id;
                      return (
                        <option key={id} value={id}>
                          {d.name} ({d.code})
                        </option>
                      );
                    })}
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
                  <span>{editingStaff ? 'Update Staff Member' : 'Create Staff Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
