import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  PlusCircle,
  MapPin,
  AlertTriangle,
  UploadCloud,
  CheckCircle2,
  Info,
  ArrowLeft,
  Megaphone,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  Radar,
  ExternalLink,
  Link2,
} from 'lucide-react';
import { issuesAPI, departmentsAPI, CAMPUS_ZONES, ISSUE_VISIBILITIES } from '../services/api.js';
import SeverityBadge from '../components/common/SeverityBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { useToast } from '../context/ToastContext.jsx';

const FORM_CATEGORIES = [
  { id: 'infrastructure', label: 'Infrastructure & Buildings' },
  { id: 'electrical', label: 'Electrical & Power' },
  { id: 'plumbing', label: 'Plumbing & Water Supply' },
  { id: 'it_wifi', label: 'IT & Campus Wi-Fi' },
  { id: 'safety', label: 'Campus Safety & Hazards' },
  { id: 'sanitation', label: 'Sanitation & Hygiene' },
  { id: 'other', label: 'Other Campus Facilities' },
];

const FORM_SEVERITIES = [
  { id: 'low', label: 'Low', desc: 'Minor inconvenience, non-urgent' },
  { id: 'moderate', label: 'Moderate', desc: 'Affects daily routine or class' },
  { id: 'high', label: 'High', desc: 'Significant disruption or property damage' },
  { id: 'critical', label: 'Critical', desc: 'Immediate safety hazard or major shutdown' },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function NewIssuePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [searchParams] = useSearchParams();
  const preselectedIncidentId = searchParams.get('incidentId');
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    category: 'infrastructure',
    severity: 'moderate',
    visibility: 'public',
    department: '',
    campusZone: 'academic_blocks',
    building: '',
    area: '',
    floor: '',
    room: '',
    description: '',
    campusAlertRequested: false,
    parentIssueId: preselectedIncidentId || undefined,
  });

  const [linkedIncident, setLinkedIncident] = useState(null);

  // If incidentId is provided in URL, prefill and link
  useEffect(() => {
    if (preselectedIncidentId) {
      issuesAPI
        .getById(preselectedIncidentId)
        .then((res) => {
          if (res?.data?.issue) {
            const inc = res.data.issue;
            setLinkedIncident(inc);
            setFormData((prev) => ({
              ...prev,
              parentIssueId: inc.id || inc._id,
              category: inc.category || prev.category,
              campusZone: inc.location?.campusZone || prev.campusZone,
              building: inc.location?.building || prev.building,
            }));
          }
        })
        .catch(() => {});
    }
  }, [preselectedIncidentId]);

  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    departmentsAPI
      .getAll()
      .then((res) => {
        if (res?.data?.departments) setDepartments(res.data.departments);
      })
      .catch(() => {});
  }, []);

  // Duplicate Radar states
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [dismissDuplicates, setDismissDuplicates] = useState(false);

  const handleJoinIncident = (dup) => {
    setLinkedIncident(dup);
    setFormData((prev) => ({
      ...prev,
      parentIssueId: dup.id || dup._id,
      category: dup.category || prev.category,
      campusZone: dup.location?.campusZone || prev.campusZone,
      building: dup.location?.building || prev.building,
    }));
    setDismissDuplicates(true);
    showSuccess(`Linked your report to: "${dup.title}"`);
  };

  const handleDismissDuplicates = () => {
    setDismissDuplicates(true);
  };

  // Image upload states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced Duplicate Radar similarity query
  useEffect(() => {
    if (!formData.title || formData.title.trim().length < 3) {
      setDuplicateMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingDuplicates(true);
        const res = await issuesAPI.checkDuplicates({
          q: formData.title.trim(),
          category: formData.category,
          campusZone: formData.campusZone,
          building: formData.building.trim(),
        });
        if (res && res.data && Array.isArray(res.data.duplicates)) {
          setDuplicateMatches(res.data.duplicates);
        }
      } catch {
        // Non-blocking radar search
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.title, formData.category, formData.campusZone, formData.building]);

  // Clean up object URL memory on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleFileValidationAndSet = (file) => {
    setImageError(null);

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Unsupported format. Please select a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setImageError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB limit.`
      );
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    handleFileValidationAndSet(file);
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileValidationAndSet(file);
  };

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) {
      errs.title = 'Issue title is required';
    } else if (formData.title.trim().length < 5) {
      errs.title = 'Title must be at least 5 characters long';
    } else if (formData.title.trim().length > 150) {
      errs.title = 'Title cannot exceed 150 characters';
    }

    if (!formData.building.trim()) {
      errs.building = 'Campus building or block name is required';
    }

    if (!formData.description.trim()) {
      errs.description = 'Detailed description is required';
    } else if (formData.description.trim().length < 10) {
      errs.description = 'Please describe the problem in at least 10 characters';
    } else if (formData.description.trim().length > 2500) {
      errs.description = 'Description cannot exceed 2500 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;
    if (imageError) return;

    setIsSubmitting(true);
    try {
      let res;

      if (selectedImage) {
        // Submit as multipart/form-data for image upload
        const multipartData = new FormData();
        multipartData.append('title', formData.title.trim());
        multipartData.append('description', formData.description.trim());
        multipartData.append('category', formData.category);
        multipartData.append('severity', formData.severity);
        multipartData.append('visibility', formData.visibility);
        if (formData.department) {
          multipartData.append('department', formData.department);
        }
        multipartData.append(
          'location',
          JSON.stringify({
            building: formData.building.trim(),
            campusZone: formData.campusZone,
            area: formData.area.trim(),
            floor: formData.floor.trim(),
            room: formData.room.trim(),
          })
        );
        multipartData.append(
          'campusAlertRequested',
          formData.campusAlertRequested ? 'true' : 'false'
        );
        if (formData.parentIssueId || linkedIncident) {
          multipartData.append(
            'parentIssueId',
            formData.parentIssueId || (linkedIncident ? (linkedIncident.id || linkedIncident._id) : '')
          );
        }
        multipartData.append('image', selectedImage);

        res = await issuesAPI.create(multipartData);
      } else {
        // Normal text-only submission
        const payload = {
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category,
          severity: formData.severity,
          visibility: formData.visibility,
          department: formData.department || undefined,
          parentIssueId:
            formData.parentIssueId ||
            (linkedIncident ? (linkedIncident.id || linkedIncident._id) : undefined),
          location: {
            building: formData.building.trim(),
            campusZone: formData.campusZone,
            area: formData.area.trim(),
            floor: formData.floor.trim(),
            room: formData.room.trim(),
          },
          campusAlertRequested: Boolean(formData.campusAlertRequested),
        };

        res = await issuesAPI.create(payload);
      }

      if (res && res.data && res.data.issue) {
        showSuccess(
          linkedIncident
            ? 'Your report was added to an existing incident.'
            : 'Report submitted successfully.'
        );
        const newId = res.data.issue.id || res.data.issue._id;
        navigate(`/issues/${newId}`, { replace: true });
      } else {
        showSuccess('Report submitted successfully.');
        navigate('/', { replace: true });
      }
    } catch (err) {
      showError(err.message || 'Failed to submit report. Please check your inputs and try again.');
      setServerError(
        err.message || 'Failed to submit report. Please check your inputs and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb / Back button */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Campus Feed</span>
        </Link>
        <span className="text-xs text-slate-400">Live Report Submission</span>
      </div>

      {/* Header title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Report a Campus Issue</h1>
        <p className="text-sm text-slate-500 mt-1">
          Submit persistent infrastructure, safety, or facility maintenance requests to campus administration.
        </p>
      </div>

      {/* Server Error Alert */}
      {serverError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-semibold block">Submission Failed</strong>
            <span>{serverError}</span>
          </div>
        </div>
      )}

      {/* Active Incident Group Contribution Banner */}
      {linkedIncident && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-2.5 min-w-0">
            <Link2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <span className="font-semibold text-blue-950 block">Contributing to Existing Campus Incident</span>
              <p className="truncate text-slate-700">
                "{linkedIncident.title}" ({linkedIncident.location?.building || 'Campus'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLinkedIncident(null);
              setFormData((prev) => ({ ...prev, parentIssueId: undefined }));
              showInfo('Report unlinked. It will now be submitted as a separate standalone ticket.');
            }}
            className="self-start sm:self-center shrink-0 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
          >
            Submit as separate issue
          </button>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        {/* Title */}
        <div>
          <label
            htmlFor="issue-title"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
          >
            Issue Title *
          </label>
          <input
            id="issue-title"
            type="text"
            disabled={isSubmitting}
            placeholder="e.g. Water leak near 2nd floor science laboratory"
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              if (errors.title) setErrors({ ...errors, title: null });
            }}
            className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 transition-all disabled:opacity-60 ${
              errors.title
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
            }`}
          />
          {errors.title ? (
            <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.title}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Summarize the core problem concisely (5-150 characters).</p>
          )}

          {/* Smart Grouping / Duplicate Radar Suggestion Panel */}
          {duplicateMatches.length > 0 && !dismissDuplicates && !linkedIncident && (
            <div className="mt-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl space-y-3 transition-all shadow-xs animate-fadeIn">
              <div className="flex items-start justify-between gap-2 border-b border-amber-200 pb-2">
                <div className="flex items-center gap-2 text-amber-950">
                  <Radar className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    This issue may already have been reported.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDismissDuplicates}
                  className="text-amber-800 hover:text-amber-950 text-xs font-semibold px-2 py-0.5 rounded hover:bg-amber-200/50 transition-colors"
                >
                  Dismiss
                </button>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {duplicateMatches.slice(0, 3).map((dup) => {
                  const id = dup.id || dup._id;
                  const totalAffected = (dup.confirmationCount || 0) + (dup.groupedReportsCount || 0) + 1;
                  const deptName = dup.department?.name || 'Facilities Management';

                  return (
                    <div
                      key={id}
                      className="bg-white border border-amber-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs hover:border-amber-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">
                          "{dup.title}"
                        </h4>
                        <StatusBadge status={dup.status} size="xs" />
                      </div>

                      <ul className="text-xs text-slate-600 space-y-1">
                        <li className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span>
                            <strong className="text-slate-900 font-semibold">{totalAffected} students</strong> have reported or confirmed this issue.
                          </span>
                        </li>
                        {dup.groupedReportsCount > 0 && (
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span>
                              <strong className="text-slate-900 font-semibold">{dup.groupedReportsCount}</strong> related reports grouped under this incident.
                            </span>
                          </li>
                        )}
                        <li className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                          <span>
                            Currently assigned to: <span className="font-semibold text-slate-800">{deptName}</span>.
                          </span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                          <span>
                            Status: <span className="font-semibold text-slate-800 capitalize">{dup.status?.replace('_', ' ')}</span>.
                          </span>
                        </li>
                      </ul>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                        <Link
                          to={`/issues/${id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                          <span>View existing issue</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleJoinIncident(dup)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add my report</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDismissDuplicates}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1.5 transition-colors"
                        >
                          Report a different issue
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Category & Severity Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label
              htmlFor="issue-category"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Category *
            </label>
            <select
              id="issue-category"
              disabled={isSubmitting}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
            >
              {FORM_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Severity Level *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FORM_SEVERITIES.map((sev) => {
                const isSelected = formData.severity === sev.id;
                return (
                  <button
                    key={sev.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setFormData({ ...formData, severity: sev.id })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-between transition-colors disabled:opacity-60 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{sev.label}</span>
                    <SeverityBadge severity={sev.id} size="xs" showIcon={false} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Privacy & Department Classification */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Report Visibility & Privacy *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ISSUE_VISIBILITIES.map((vis) => {
                const isSelected = formData.visibility === vis.value;
                return (
                  <button
                    key={vis.value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setFormData({ ...formData, visibility: vis.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-600'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-900 mb-0.5">
                      {vis.label}
                    </span>
                    <span className="block text-[11px] text-slate-500 leading-snug">
                      {vis.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Suggested Department */}
          <div>
            <label
              htmlFor="issue-department"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Responsible Campus Department (Optional)
            </label>
            <select
              id="issue-department"
              disabled={isSubmitting}
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
            >
              <option value="">Let Campus Administration Route Automatically</option>
              {departments.map((dept) => (
                <option key={dept.id || dept._id} value={dept.id || dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Campus operations will confirm or redirect routing to the specialized staff team.
            </p>
          </div>
        </div>

        {/* Location Details Group */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Campus Location Details *
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="issue-campus-zone" className="block text-xs text-slate-600 mb-1">
                Campus Zone *
              </label>
              <select
                id="issue-campus-zone"
                disabled={isSubmitting}
                value={formData.campusZone}
                onChange={(e) => setFormData({ ...formData, campusZone: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
              >
                {CAMPUS_ZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="issue-building" className="block text-xs text-slate-600 mb-1">
                Building or Block Name *
              </label>
              <input
                id="issue-building"
                type="text"
                disabled={isSubmitting}
                placeholder="e.g. Science Complex Block B, Central Library"
                value={formData.building}
                onChange={(e) => {
                  setFormData({ ...formData, building: e.target.value });
                  if (errors.building) setErrors({ ...errors, building: null });
                }}
                className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 transition-all disabled:opacity-60 ${
                  errors.building
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {errors.building && (
                <p className="mt-1 text-xs text-rose-600">{errors.building}</p>
              )}
            </div>

            <div>
              <label htmlFor="issue-area" className="block text-xs text-slate-600 mb-1">
                Specific Area / Wing (Optional)
              </label>
              <input
                id="issue-area"
                type="text"
                disabled={isSubmitting}
                placeholder="e.g. East Wing, Main Entrance, Restroom Area"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="issue-floor" className="block text-xs text-slate-600 mb-1">
                Floor (Optional)
              </label>
              <input
                id="issue-floor"
                type="text"
                disabled={isSubmitting}
                placeholder="e.g. Ground Floor, 2nd Floor"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="issue-room" className="block text-xs text-slate-600 mb-1">
                Room or Lab Number (Optional)
              </label>
              <input
                id="issue-room"
                type="text"
                disabled={isSubmitting}
                placeholder="e.g. Lab B-014, Room 302"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="issue-description"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
          >
            Description & Impact *
          </label>
          <textarea
            id="issue-description"
            rows={4}
            disabled={isSubmitting}
            placeholder="Explain what is broken, hazards observed, and how it impacts students or classes..."
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              if (errors.description) setErrors({ ...errors, description: null });
            }}
            className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 transition-all disabled:opacity-60 ${
              errors.description
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
            }`}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-rose-600">{errors.description}</p>
          )}
        </div>

        {/* Photo Upload via Cloudinary */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Attach Evidence Photo (Optional)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
            id="photo-file-input"
            disabled={isSubmitting}
          />

          {!selectedImage ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/60'
              }`}
            >
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                Click to browse photo or drag & drop here
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                JPEG, PNG, or WebP up to 5 MB. Photos are safely processed via Cloudinary.
              </p>
            </div>
          ) : (
            <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50/70 flex items-center gap-3.5">
              {/* Thumbnail preview */}
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 relative">
                <img
                  src={imagePreviewUrl}
                  alt="Selected issue evidence"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* File details */}
              <div className="flex-1 min-w-0 text-xs">
                <span className="block font-semibold text-slate-800 truncate">
                  {selectedImage.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  {(selectedImage.size / (1024 * 1024)).toFixed(2)} MB • {selectedImage.type.split('/')[1]?.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Ready to upload on submission
                </span>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {imageError && (
            <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{imageError}</span>
            </p>
          )}
        </div>

        {/* Campus-Wide Alert Request */}
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
          <div className="flex items-start gap-3">
            <input
              id="request-alert"
              type="checkbox"
              disabled={isSubmitting}
              checked={formData.campusAlertRequested}
              onChange={(e) =>
                setFormData({ ...formData, campusAlertRequested: e.target.checked })
              }
              className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer disabled:opacity-60"
            />
            <label htmlFor="request-alert" className="text-xs text-slate-800 cursor-pointer">
              <strong className="block font-bold text-rose-900 mb-0.5 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-rose-600" />
                Request Official Campus-Wide Alert Visibility
              </strong>
              Check this if the issue is an immediate campus-wide danger (power outage, gas odor, flooding, fire hazard).
              <span className="block mt-1 text-[11px] text-slate-500 italic">
                * Note: Requesting an alert does not publish it immediately. Only campus administrators can approve and broadcast official advisories.
              </span>
            </label>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100">
          <Link
            to="/"
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-colors disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{selectedImage ? 'Uploading & Submitting...' : 'Submitting Report...'}</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 stroke-[2.2]" />
                <span>Submit Issue Report</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
