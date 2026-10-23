/**
 * CampusPulse Mock Data Module
 * Reusable, structured mock dataset for Stage 1 frontend prototype.
 */

export const CURRENT_USER = {
  id: 'user_1',
  name: 'Aarav Sharma',
  email: 'aarav.sharma@campus.edu',
  rollNo: 'CS-2023-042',
  department: 'Computer Science & Engineering',
  role: 'student',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
};

export const ISSUE_CATEGORIES = [
  'Infrastructure',
  'Electrical & Power',
  'Plumbing & Water',
  'IT & Network',
  'Academic Facilities',
  'Sanitation & Hygiene',
  'Campus Safety',
];

export const ISSUE_SEVERITIES = ['Critical', 'High', 'Moderate', 'Low'];

export const ISSUE_STATUSES = ['Reported', 'Under Review', 'In Progress', 'Resolved'];

export const MOCK_ISSUES = [
  {
    id: 'CP-1042',
    title: 'Exposed live electrical wiring along Cafeteria outdoor pathway',
    description:
      'Several insulated cables have frayed open after the rainstorm near the light pole along the main Cafeteria walkway. Wire sparks were observed when students walked nearby. High risk of shock during evening foot traffic.',
    category: 'Campus Safety',
    severity: 'Critical',
    status: 'In Progress',
    location: {
      building: 'Student Center & Cafeteria',
      roomOrArea: 'North Outdoor Walkway, Pole #4',
      landmark: 'Near the bicycle parking lot entrance',
    },
    author: {
      id: 'user_1',
      name: 'Aarav Sharma',
      role: 'Student',
      department: 'Computer Science',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    affectedCount: 84,
    isCampusAlert: true,
    alertHeadline: 'Safety Hazard: Avoid Cafeteria North Pathway',
    alertMessage:
      'Estate Maintenance team has cordoned off Pole #4 walkway. Please use the South Veranda until electrical repairs conclude at 3:00 PM.',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    comments: [
      {
        id: 'c-1',
        author: 'Campus Security Office',
        role: 'Admin',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        text: 'Cordon tape deployed. Electrician team dispatched on site.',
      },
      {
        id: 'c-2',
        author: 'Priya Verma',
        role: 'Student',
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        text: 'Confirming caution tape is visible. Glad this was flagged fast.',
      },
    ],
  },
  {
    id: 'CP-1039',
    title: 'Campus Wi-Fi gateway outage across Central Library & Study Halls',
    description:
      'Complete loss of eduroam and CampusPulse-Guest SSID connectivity across Floors 1, 2 and 3 of the Central Library. IP allocation times out, preventing digital research and term-paper submissions.',
    category: 'IT & Network',
    severity: 'Critical',
    status: 'Under Review',
    location: {
      building: 'Central Library',
      roomOrArea: 'Floors 1-3 & Quiet Study Rooms',
      landmark: 'Adjacent to Dean of Students office',
    },
    author: {
      id: 'user_2',
      name: 'Neha Sundaram',
      role: 'Student',
      department: 'Electrical Engineering',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    affectedCount: 156,
    isCampusAlert: true,
    alertHeadline: 'Library Wi-Fi Connectivity Disruption',
    alertMessage:
      'Core switch reboot underway in IT datacenter. Access point telemetry expected to stabilize shortly.',
    imageUrl: '',
    comments: [
      {
        id: 'c-3',
        author: 'IT Services Helpdesk',
        role: 'Admin',
        createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
        text: 'Core switch diagnostics in progress. Secondary fiber link has been engaged.',
      },
    ],
  },
  {
    id: 'CP-1035',
    title: 'Severe water pipe leakage in Science Block B Basement Laboratory',
    description:
      'Pressurized water main joint has burst under Sink 4 in the Materials Testing Lab. Water is pooling rapidly across the floor toward electrical power strip trunks.',
    category: 'Plumbing & Water',
    severity: 'High',
    status: 'In Progress',
    location: {
      building: 'Science Block B',
      roomOrArea: 'Basement Room B-014 (Materials Lab)',
      landmark: 'Near the chemical storage lockers',
    },
    author: {
      id: 'user_3',
      name: 'Rohan Mehta',
      role: 'Lab Assistant',
      department: 'Materials Science',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    affectedCount: 32,
    isCampusAlert: false,
    alertHeadline: null,
    alertMessage: null,
    imageUrl: '',
    comments: [
      {
        id: 'c-4',
        author: 'Plumbing Facility Ops',
        role: 'Admin',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        text: 'Sub-valve shut off. Replacement gasket requested from vendor.',
      },
    ],
  },
  {
    id: 'CP-1028',
    title: 'Classroom AC unit completely non-functional in Ramanujan Hall 301',
    description:
      'The split-unit HVAC in Lecture Hall 301 is blowing hot air and emitting a loud clicking sound during lectures. The room gets stuffy and uncomfortable for afternoon 80-student batches.',
    category: 'Academic Facilities',
    severity: 'Moderate',
    status: 'Reported',
    location: {
      building: 'Ramanujan Academic Complex',
      roomOrArea: 'Lecture Hall 301 (3rd Floor)',
      landmark: 'Opposite to Department Staff Lounge',
    },
    author: {
      id: 'user_1',
      name: 'Aarav Sharma',
      role: 'Student',
      department: 'Computer Science',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), // 20 hours ago
    affectedCount: 47,
    isCampusAlert: false,
    alertHeadline: null,
    alertMessage: null,
    imageUrl: '',
    comments: [],
  },
  {
    id: 'CP-1021',
    title: 'Elevator Lift B halted with door error in Vivekananda Tower',
    description:
      'Passenger elevator Lift B is stuck at Level 4 with blinking red error code E-12. Wheelchair access to upper faculty floors is presently constrained to Lift A.',
    category: 'Infrastructure',
    severity: 'High',
    status: 'Reported',
    location: {
      building: 'Vivekananda Tower',
      roomOrArea: 'Elevator Core (Lift B)',
      landmark: 'Main Atrium',
    },
    author: {
      id: 'user_4',
      name: 'Kavita Sen',
      role: 'Student',
      department: 'Management Studies',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), // 1+ day ago
    affectedCount: 65,
    isCampusAlert: false,
    alertHeadline: null,
    alertMessage: null,
    imageUrl: '',
    comments: [],
  },
  {
    id: 'CP-1014',
    title: 'Flickering ceiling tube lights and loose switchboard in Lab 204',
    description:
      'Fluorescent tubes #2 and #4 oscillate vigorously, causing eye strain during 3-hour evening programming practicals. The corner switchboard faceplate is also dislodged.',
    category: 'Electrical & Power',
    severity: 'Moderate',
    status: 'Under Review',
    location: {
      building: 'Aryabhata Computing Center',
      roomOrArea: 'Software Lab 204',
      landmark: 'Second floor west wing',
    },
    author: {
      id: 'user_5',
      name: 'Ananya Roy',
      role: 'Student',
      department: 'Information Technology',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    affectedCount: 19,
    isCampusAlert: false,
    alertHeadline: null,
    alertMessage: null,
    imageUrl: '',
    comments: [],
  },
  {
    id: 'CP-1008',
    title: 'Drinking water dispenser chiller malfunction on 2nd Floor',
    description:
      'The water filtration unit on Aryabhata 2nd Floor dispenses room-temperature water only. Filter status light is amber indicating maintenance due.',
    category: 'Sanitation & Hygiene',
    severity: 'Low',
    status: 'Resolved',
    location: {
      building: 'Aryabhata Computing Center',
      roomOrArea: '2nd Floor Water Station',
      landmark: 'Next to restrooms',
    },
    author: {
      id: 'user_1',
      name: 'Aarav Sharma',
      role: 'Student',
      department: 'Computer Science',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    affectedCount: 28,
    isCampusAlert: false,
    alertHeadline: null,
    alertMessage: null,
    imageUrl: '',
    comments: [
      {
        id: 'c-5',
        author: 'Health & Sanitation Officer',
        role: 'Admin',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        text: 'Coolant refill completed and filter cartridge replaced. Sanitized and tested.',
      },
    ],
  },
  {
    id: 'CP-1002',
    title: 'Damaged wooden bench with protruding screws in Botanical Quad',
    description:
      'One of the perimeter wooden benches has broken slats and rusted nails exposed. Repaired and made safe for student seating.',
    category: 'Infrastructure',
    severity: 'Low',
    status: 'Resolved',
    location: {
      building: 'Botanical Garden Quad',
      roomOrArea: 'Bench #7 (East Perimeter)',
      landmark: 'Under the banyan tree shade',
    },
    author: {
      id: 'user_6',
      name: 'Vikram Joshi',
      role: 'Student',
      department: 'Biotechnology',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 days ago
    affectedCount: 12,
    isCampusAlert: false,
    alertHeadline: null,
    alertMessage: null,
    imageUrl: '',
    comments: [
      {
        id: 'c-6',
        author: 'Campus Carpentry Unit',
        role: 'Admin',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
        text: 'Slats replaced with treated teak wood and sanded smooth.',
      },
    ],
  },
];

export const MOCK_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Campus-Wide Safety Alert Issued',
    message: 'Estate Maintenance cordoned off Cafeteria outdoor pathway due to live cable hazard.',
    type: 'alert',
    issueId: 'CP-1042',
    timestamp: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    isRead: false,
  },
  {
    id: 'notif-2',
    title: 'Status Updated on Your Report',
    message: 'Your report "Water dispenser chiller malfunction" has been marked as Resolved.',
    type: 'status_update',
    issueId: 'CP-1008',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    isRead: false,
  },
  {
    id: 'notif-3',
    title: 'Students Confirmed Your Issue',
    message: '47 students confirmed they are also affected by "Classroom AC unit in LH 301".',
    type: 'endorsement',
    issueId: 'CP-1028',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    isRead: true,
  },
  {
    id: 'notif-4',
    title: 'New Admin Response',
    message: 'IT Services Helpdesk posted an update regarding Central Library Wi-Fi outage.',
    type: 'comment',
    issueId: 'CP-1039',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    isRead: true,
  },
  {
    id: 'notif-5',
    title: 'Maintenance Ticket Assigned',
    message: 'Your report "Classroom AC unit in LH 301" is now Under Review with HVAC Department.',
    type: 'assignment',
    issueId: 'CP-1028',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isRead: true,
  },
];

export const ADMIN_STATS = {
  totalIssues: MOCK_ISSUES.length,
  openIssues: MOCK_ISSUES.filter((i) => i.status === 'Reported').length,
  criticalIssues: MOCK_ISSUES.filter((i) => i.severity === 'Critical' && i.status !== 'Resolved').length,
  pendingReview: MOCK_ISSUES.filter((i) => i.status === 'Under Review').length,
  inProgress: MOCK_ISSUES.filter((i) => i.status === 'In Progress').length,
  resolved: MOCK_ISSUES.filter((i) => i.status === 'Resolved').length,
  activeAlerts: MOCK_ISSUES.filter((i) => i.isCampusAlert && i.status !== 'Resolved').length,
};

/**
 * Format relative time helper
 */
export function formatRelativeTime(dateString) {
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
