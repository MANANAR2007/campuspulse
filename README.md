# CampusPulse 🏛️⚡

> Campus issue-reporting and awareness platform for colleges and universities.

CampusPulse allows students to easily report campus infrastructure, electrical, plumbing, network, and safety issues with location details and severity levels. Urgent hazards can request campus-wide alert visibility to immediately inform the student body and dispatch maintenance operations.

---

## 🛠️ Tech Stack

- **Frontend:** React 18 (Vite), JavaScript (ES Modules), React Router v6, Tailwind CSS
- **Icons:** `lucide-react`
- **Backend:** Node.js, Express.js (ES Modules, MVC architecture)
- **Database:** MongoDB Atlas with Mongoose ODM
- **Authentication & Security:** bcryptjs password hashing, JWT signed sessions in HttpOnly cookies, express-rate-limit brute force prevention, CORS with credentials
- **Tooling:** Concurrently for unified full-stack development orchestration

---

## 📁 Repository Structure

```text
campuspulse/
├── package.json                          # Full-stack dev, build, and admin provisioning scripts
├── .gitignore                            # Excludes node_modules, dist, .env, and logs
├── README.md                             # Project documentation & viva reference
│
├── server/                               # Express.js REST API
│   ├── package.json                      # Server dependencies ("type": "module")
│   ├── .env.example                      # Server environment variables template
│   └── src/
│       ├── server.js                     # Connects to Atlas before listening
│       ├── app.js                        # Express app setup, CORS, cookies, rate limiter, routes
│       ├── config/
│       │   ├── index.js                  # Centralized environment configuration
│       │   └── db.js                     # Reusable Mongoose connection with event listeners
│       ├── controllers/                  # Route controllers (MVC pattern)
│       │   ├── authController.js         # Register, Login, Logout, Me, AdminCheck
│       │   ├── issueController.js        # Student issue CRUD, feed, alerts, and filtering
│       │   ├── adminController.js        # Admin review queue, alert approvals, transitions, stats
│       │   └── healthController.js       # Reports uptime & sanitized DB status
│       ├── middleware/                   # Middlewares
│       │   ├── auth.js                   # authenticate & requireAdmin guards
│       │   ├── rateLimiter.js            # express-rate-limit protection
│       │   ├── errorHandler.js           # Central JSON error handler
│       │   └── notFound.js               # 404 handler
│       ├── models/
│       │   ├── User.js                   # Mongoose User model with bcryptjs methods
│       │   ├── Issue.js                  # Mongoose Issue model with text indexes & lifecycle
│       │   └── README.md
│       ├── routes/                       # Express router definitions
│       │   ├── index.js                  # Mounts /health, /auth, /issues, /admin
│       │   ├── authRoutes.js             # /api/auth routes
│       │   ├── issueRoutes.js            # /api/issues routes
│       │   ├── adminRoutes.js            # /api/admin routes
│       │   └── healthRoutes.js           # /api/health route
│       ├── scripts/
│       │   └── seedAdmin.js              # Safe admin provisioning CLI script
│       └── utils/
│           ├── categoryHelper.js         # Normalizes category labels to schema enums
│           └── token.js                  # JWT generation & HttpOnly cookie management
│
└── client/                               # React + Vite frontend
    ├── package.json                      # Client dependencies
    ├── vite.config.js                    # Vite config with /api proxy to backend
    ├── tailwind.config.js                # Refined campus utility theme
    ├── postcss.config.js                 # PostCSS configuration
    ├── index.html                        # HTML entry point
    ├── .env.example                      # Client environment variables
    └── src/
        ├── main.jsx                      # React DOM root with BrowserRouter
        ├── App.jsx                       # Routing tree with AuthProvider & ProtectedRoutes
        ├── index.css                     # Tailwind base and custom utilities
        ├── context/
        │   └── AuthContext.jsx           # Global user session state & hooks
        ├── services/
        │   └── api.js                    # Fetch wrapper configured with credentials: include
        ├── mock/
        │   └── mockData.js               # Centralized mock issues dataset
        ├── components/
        │   ├── auth/
        │   │   ├── ProtectedRoute.jsx    # Auth & adminOnly guard with fallback UI
        │   │   └── PublicOnlyRoute.jsx   # Redirects logged-in users away from login/register
        │   ├── common/                   # SeverityBadge, StatusBadge, EmptyState, etc.
        │   ├── layout/                   # AppLayout, Sidebar, Header, MobileNav
        │   └── issues/                   # IssueCard, AlertBanner, FeedFilters
        └── pages/
            ├── FeedPage.jsx              # / (Home Campus Feed & Filters)
            ├── LoginPage.jsx             # /login (Live authentication connected to MongoDB)
            ├── RegisterPage.jsx          # /register (Live student registration in MongoDB)
            ├── NewIssuePage.jsx          # /issues/new (Report issue form)
            ├── IssueDetailsPage.jsx      # /issues/:id (Detailed issue view)
            ├── MyReportsPage.jsx         # /my-reports (User submitted reports)
            ├── NotificationsPage.jsx     # /notifications (Interactive sample alerts)
            ├── AdminDashboardPage.jsx    # /admin (Admin operations - requires admin role)
            └── NotFoundPage.jsx          # 404 handler
```

---

## ⚙️ Environment Configuration

Environment variables must be configured in `server/.env` (never committed to Git). A template is provided in `server/.env.example`:

```env
NODE_ENV=development
PORT=5000
HOST=127.0.0.1
CLIENT_ORIGIN=http://localhost:5173

# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/campuspulse?retryWrites=true&w=majority

# JWT Session Secret
JWT_SECRET=your_jwt_strong_secret_key_here

# Admin Account Seed Credentials (for npm run seed:admin)
ADMIN_NAME="Campus Administrator"
ADMIN_EMAIL=admin@campuspulse.local
ADMIN_PASSWORD=change_this_admin_password_123

# Cloudinary Image Upload Credentials (Optional for text-only reports)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

---

## 🚀 Quick Start Commands

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Provision the Initial Administrator Account
Run the one-time admin seed script (reads credentials from `server/.env`):
```bash
npm run seed:admin
```
> **Security Note:** Hashes the admin password with `bcryptjs` and safely creates or updates the admin account in MongoDB Atlas with `role: 'admin'`.

### 3. Run Development Servers
Start both backend (Express) and frontend (Vite) concurrently:
```bash
npm run dev
```

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://127.0.0.1:5000](http://127.0.0.1:5000)
- **Database & API Health Check:** [http://localhost:5173/api/health](http://localhost:5173/api/health)

---

## 🏛️ Issue Model & Lifecycle State Machine

### Issue Schema (`server/src/models/Issue.js`)
- **`title`**: String, required, trimmed (5-150 chars)
- **`description`**: String, required, trimmed (10-2500 chars)
- **`category`**: Enum `['infrastructure', 'electrical', 'plumbing', 'it_wifi', 'safety', 'sanitation', 'other']`
- **`severity`**: Enum `['low', 'moderate', 'high', 'critical']`
- **`location`**: Embedded object with `building` (required), `area`, `floor`, `room`
- **`createdBy`**: ObjectId reference to `User` (authenticated student)
- **`status`**: Enum `['reported', 'verified', 'in_progress', 'resolved', 'rejected']`
- **`campusAlertRequested`**: Boolean, default `false` (student request for alert visibility)
- **`isCampusWideAlert`**: Boolean, default `false` (admin approved official advisory)
- **`reviewedBy`**: ObjectId reference to `User` (admin reviewer)
- **`reviewedAt`**: Date
- **`resolutionNote`**: String (optional resolution or rejection comments)

### Issue Lifecycle State Transitions

```
[Student Submits] 
       │
       ▼
   reported ──────────────────┐ (Admin Review: decision='reject')
       │                      │
       │ (Admin Review:       ▼
       │  decision='verify')  rejected (Excluded from feed & alerts)
       ▼
   verified
       │
       │ (Admin Status: status='in_progress')
       ▼
  in_progress ◄──────────────┐
       │                     │ (Admin Reopen)
       │ (Admin Status:      │
       │  status='resolved') │
       ▼                     │
   resolved ─────────────────┘
```

---

## 📡 Complete REST API Endpoints

### Student Issue Endpoints (`/api/issues`)

All student issue endpoints require an active authenticated session (`authenticate` middleware).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/issues` | Submits a new report. Assigns `status: 'reported'` and `createdBy: req.user._id`. Protects against field tampering (`isCampusWideAlert: false`). |
| `GET` | `/api/issues` | Paginated campus feed. Excludes rejected reports. Supports `category`, `severity`, `status`, `building`, `search`, `sort`, `page`, and `limit`. |
| `GET` | `/api/issues/mine` | Retrieves reports created strictly by the authenticated student. |
| `GET` | `/api/issues/alerts`| Returns currently approved, active campus-wide alerts (`isCampusWideAlert: true`, not resolved/rejected). |
| `GET` | `/api/issues/:id` | Returns report details with populated author, reviewer summary, and confirmation status. |
| `PATCH`| `/api/issues/:id` | Allows author to edit report details or image *only* while status is `reported`. Returns 403 for non-owners, 409 if already reviewed. |
| `DELETE`| `/api/issues/:id`| Allows author to delete report and associated Cloudinary asset *only* while status is `reported`. Returns 403 for non-owners, 409 if reviewed. |
| `POST` | `/api/issues/:id/confirm` | Affirms "Affects Me Too" on an issue. Idempotent and duplicate-safe (one vote per user). |
| `DELETE`| `/api/issues/:id/confirm` | Removes current user's "Affects Me Too" affirmation. |

### Comments Endpoints (`/api/issues/:id/comments` & `/api/comments`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/issues/:id/comments` | Paginated chronological comment feed for visible, non-rejected reports. |
| `POST` | `/api/issues/:id/comments` | Posts a persistent comment. Triggers an in-app notification to the issue author. |
| `PATCH`| `/api/comments/:commentId` | Edits comment text (author only). Enforces 1000-character limit. |
| `DELETE`| `/api/comments/:commentId` | Deletes comment (author only or admin moderation). |

### Notifications Endpoints (`/api/notifications`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | Paginated in-app notifications feed for the authenticated user (`unreadOnly` filter support). |
| `PATCH`| `/api/notifications/:id/read` | Marks a single notification as read (user privacy isolated). |
| `PATCH`| `/api/notifications/read-all` | Marks all notifications as read for the current user. |

### Admin Review & Lifecycle Endpoints (`/api/admin`)

All admin endpoints require administrative privileges (`authenticate` and `requireAdmin` middlewares).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/issues` | Admin review queue. Supports filtering by `status`, `severity`, `category`, `campusAlertRequested`, `isCampusWideAlert`, `search`, and pagination. |
| `PATCH`| `/api/admin/issues/:id/review` | Sets `decision: 'verify'` or `'reject'`. If `approveCampusAlert: true`, verifies student requested an alert (`campusAlertRequested === true`) or returns HTTP 400. Prevents re-review of in_progress/resolved tickets. |
| `PATCH`| `/api/admin/issues/:id/status` | Enforces legitimate lifecycle transitions (`verified` -> `in_progress` -> `resolved`). Accepts `resolutionNote` on resolution. |
| `GET` | `/api/admin/stats` | Aggregates database-derived metrics (`totalIssues`, `openIssues`, `criticalIssues`, `pendingReview`, `inProgress`, `resolved`, `activeAlerts`, `rejectedIssues`). |

---

## 🖥️ Stage 4 Frontend-to-Backend Integration

Stage 4 connects all primary user-facing screens and workflows to the persistent MongoDB Atlas database through the Express REST API. Mock issue data has been completely eliminated from all core student and administrator workflows.

### 1. Campus Feed (`/`)
- Connected to `GET /api/issues` with debounced search (350ms), category dropdown filter, severity/status pill filters, and live MongoDB pagination controls.
- Connected to `GET /api/issues/alerts` to surface active admin-approved campus-wide alerts in the top banner.
- Reports with `campusAlertRequested: true` are never conflated with approved alerts.

### 2. Report Issue Form (`/issues/new`)
- Submits structured payloads directly to `POST /api/issues`.
- Form inputs include `title`, `description`, `category` (enum mapping), `severity`, structured `location` (`building`, `floor`, `room`, `area`), and the `campusAlertRequested` checkbox.
- Automatically redirects to `/issues/:id` upon successful creation.
- Includes clear Stage 5 Cloudinary image upload placeholder.

### 3. Issue Details Page (`/issues/:id`)
- Connected to `GET /api/issues/:id` displaying live report details, author information, structured location, and status timeline.
- Dynamic Banner: Surfaces official campus-wide alert notice when `isCampusWideAlert: true`, or pending review advisory when `campusAlertRequested: true`.
- Author Actions: Edit and Delete buttons are rendered exclusively for the original author and are active only while `status === 'reported'`. Once verified or progressed by an admin, modifications are locked with informative tooltips.
- Connected to `PATCH /api/issues/:id` for inline modal editing and `DELETE /api/issues/:id` with confirmation modal.

### 4. My Reports (`/my-reports`)
- Connected to `GET /api/issues/mine` displaying only issues submitted by the logged-in student.
- Filterable by report status and severity with pagination.
- Direct links into individual issue detail pages.

### 5. Admin Operational Dashboard (`/admin`)
- Accessible only to authenticated users with `role: 'admin'`.
- Connected to `GET /api/admin/stats` displaying live database-derived metrics (total issues, open reports, critical hazards, in progress, resolved, active alerts, and rejected).
- Connected to `GET /api/admin/issues` with search, severity, and status filtering.
- Review Dialog (`PATCH /api/admin/issues/:id/review`):
  - Action options: `verify` or `reject`.
  - Approve Campus-Wide Alert toggle: Strictly constrained to issues where `campusAlertRequested === true`.
  - Optional review/rejection notes.
- Status Transition Dialog (`PATCH /api/admin/issues/:id/status`):
  - Strictly enforces permitted lifecycle transitions (`verified` -> `in_progress` -> `resolved`).
  - Mandatory resolution note when transitioning to `resolved` (automatically deactivating alert visibility).
  - Instant live re-fetching of metrics and table upon status modification.

---

---

## 📸 Stage 5 Comments, Affirmations, Notifications & Cloudinary

Stage 5 introduces four major persistent interactive features backed by MongoDB Atlas and Cloudinary:

### 1. Real Cloudinary Image Uploads
- **Upload Pipeline:** Utilizes Multer memory-backed buffer streaming to upload directly to Cloudinary without writing temporary files to local disk.
- **Strict Validation:** Enforces a 5 MB file size limit, validates declared MIME types against `image/jpeg`, `image/png`, and `image/webp`, and verifies buffer magic numbers.
- **Fallback / Text-Only Operation:** If Cloudinary credentials are not configured in `server/.env`, image uploads fail gracefully with HTTP 503 while normal text-only report submission continues with 100% functionality.
- **Asset Lifecycle Management:** When an author replaces or removes an image during the `reported` status, or deletes the report, the corresponding asset is permanently destroyed in Cloudinary via its stored `imagePublicId`. If a report creation fails after uploading, the newly uploaded image is cleaned up to prevent orphaned files.
- **UI Experience:** Drag-and-drop file picker on `/issues/new` with instant image preview, file size validation, responsive thumbnail on issue cards, and responsive evidence image with lightbox modal zoom on `/issues/:id`.

### 2. Persistent Comments Thread
- **Collection Architecture:** Utilizes a dedicated `Comment` collection (`issue`, `author`, `text`, timestamps) rather than embedding unbounded arrays inside Issue documents.
- **Authorization & Rules:** Non-blank comments (1-1000 characters) on active, non-rejected reports. Authors can edit or delete their own comments; administrators can moderate comments.
- **Notifications:** Commenting on an issue automatically generates an in-app notification for the report author (commenters are never self-notified).

### 3. "Affects Me Too" Community Affirmations
- **Unique Compound Index:** The `IssueConfirmation` collection enforces a unique compound index on `{ issue: 1, user: 1 }`. One student account can confirm a specific report only once.
- **Atomic Operations:** Endpoints `POST /api/issues/:id/confirm` and `DELETE /api/issues/:id/confirm` provide idempotent, race-condition-safe toggling.
- **Zero N+1 Query Feed Architecture:** When fetching feed or issue lists, confirmation counts and the current user's affirmation state are aggregated in two batched round-trips rather than N individual queries.

### 4. Database-Backed Notifications
- **Collection Architecture:** Stores in-app events in the `Notification` collection indexed by `{ recipient: 1, createdAt: -1 }` and `{ recipient: 1, readAt: 1 }`.
- **Supported Event Triggers:**
  1. `issue_verified`: Sent to author when an administrator reviews and verifies their report.
  2. `issue_rejected`: Sent to author with reason note if rejected.
  3. `status_updated`: Sent to author when an admin moves report to `in_progress` or `resolved`.
  4. `issue_comment`: Sent to author when another user posts a comment.
  5. `campus_alert`: Fanned out to all student accounts in a batched `insertMany` with idempotency protection against duplicate fan-outs.
- **Endpoints & UI:**
  - `GET /api/notifications` with `unreadOnly` filter and pagination.
  - `PATCH /api/notifications/:id/read` for single read status (strictly isolated to recipient).
  - `PATCH /api/notifications/read-all` for clearing unread state.
  - Live reactive unread badges rendered in header and sidebar via shared `AuthContext`.

---

## 🔒 Security & Authorization Highlights (Viva Reference)

1. **Alert Promotion Safety:** A student requesting a campus-wide alert (`campusAlertRequested: true`) **never** makes the issue an alert automatically. Only explicit admin review approval sets `isCampusWideAlert: true`.
2. **Alert Request Constraint:** If an admin attempts to approve an alert on an issue where the student did not request one (`campusAlertRequested === false`), the backend strictly rejects the request with **HTTP 400**.
3. **Mass Assignment Prevention:** When students submit or edit reports, protected fields (`status`, `isCampusWideAlert`, `createdBy`, `reviewedBy`, `reviewedAt`, `resolutionNote`) are stripped by backend controllers.
4. **Author-Only Editing Window:** Students may edit or delete their reports only while in `reported` status. Once an admin verifies or rejects a report, student modifications are locked with **HTTP 409 Conflict**.
5. **Feed Isolation:** Rejected reports (`status: 'rejected'`) are automatically excluded from the public student feed (`status: { $ne: 'rejected' }`) and alert banners.
6. **Query Safety:** MongoDB ObjectIds are strictly validated with `mongoose.Types.ObjectId.isValid()`. Search queries escape regex special characters to prevent ReDoS injection attacks.
7. **HttpOnly Cookie Authentication:** Sessions are secured via JWT stored exclusively in HttpOnly cookies with `sameSite: 'lax'`. No sensitive auth tokens are stored in `localStorage` or `sessionStorage`.
8. **Cloudinary Secret Protection:** Cloudinary API secrets are stored exclusively on the server and never sent to clients or logged.

---

## 🔍 Stage Scope & Roadmap

- **Completed (Stages 1 - 5):**
  - Stage 1: Full-stack repository layout, Vite + Tailwind frontend, Express MVC backend, development proxy.
  - Stage 2: MongoDB Atlas connection, User model, bcryptjs hashing, JWT HttpOnly authentication, student/admin role authorization.
  - Stage 3: Persistent Issue model, student issue CRUD, admin review queue, alert approvals, lifecycle transitions, filtering & search.
  - Stage 4: End-to-end frontend integration with live MongoDB Atlas APIs, eliminating mock issue data from all primary student & admin screens.
  - Stage 5: Cloudinary image uploads, persistent comments thread, "Affects Me Too" community affirmations, and database-backed in-app notifications.
- **Still Deferred (Stage 6):**
  - Stage 6: Socket.io real-time alerts & live WebSocket delivery, Gemini AI automated issue categorization and smart campus summaries.
