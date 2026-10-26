# CampusPulse 2.0 — End-Term Viva Demonstration Script 🎓⚡

> **Estimated Presentation Time:** 3 – 5 minutes  
> **Target Audience:** College Examination Panel / Evaluators  
> **Preparation:** Open three browser windows or tabs:
> - **Window 1 (Student Mode):** Regular browser session (`http://localhost:5173`)
> - **Window 2 (Staff Mode):** Incognito window logged in as Department Staff (`/staff`)
> - **Window 3 (Admin Mode):** Second profile or separate window logged in as Campus Admin (`/admin`)

---

## 📋 Pre-Demo Verification Checklist

1. **Automated Test Suite Verification:**
   ```bash
   npm test
   ```
   *(Executes **99/99 passing tests**: verifies MongoDB Atlas connectivity, JWT HttpOnly cookie authentication, RBAC boundaries for Student, Staff, and Admin, Socket.IO authenticated handshakes, Duplicate Radar, 11 default seeded departments, staff account creation & work queues, 3-tier visibility enforcement, confidential 404 security checks, department redirection with history, public comments vs. internal staff notes, SLA deadline calculations, resolution verification and student reopen workflows, and audit trail logging).*

2. **Start Dev Servers:**
   ```bash
   npm run dev
   ```
   - Server runs on `http://127.0.0.1:5000`
   - Client runs on `http://localhost:5173`

3. **Sample Accounts Prepared:**
   - **Student:** `alex.rivera@campus.edu` / `Password123!` (or register fresh via `/register`)
   - **Staff Member:** Created via `/admin?view=staff` (e.g. `tech@campuspulse.edu` / `Password123!`)
   - **Administrator:** `admin@campus.edu` / `AdminPass123!` (seeded via `npm run seed:admin`)

---

## ⏱️ Step-by-Step Live Demo Script

### Minute 0:00 – 0:45 | Strict Role Separation & Multi-Tier Architecture
1. **Explain the 3-Role Operational Architecture:**
   > *"CampusPulse 2.0 features three distinct operational tiers: **Student Mode** for reporting campus issues and tracking personal tickets, **Department Staff Mode** (`/staff`) for maintenance crews and technicians working on assigned queues, and **Administrator Command Center** (`/admin`) for routing, department management, and SLA enforcement."*
2. **Demonstrate Route Guards & Privacy Boundaries:**
   - In Student Window, navigate to `/staff` or `/admin`:
     - Result: Instantly intercepted by `StaffRouteGuard` or `AdminRouteGuard` with clear security notices.
   - In Staff Window, navigate to `/issues/new` or `/admin`:
     - Result: Staff members are guided directly to their work-queue (`/staff`).
   - In Admin Window, navigate to `/issues/new`:
     - Result: Redirects back to `/admin` to preserve role separation.

---

### Minute 0:45 – 1:45 | Department-Aware Reporting & Confidentiality
1. **In Window 1 (Student Mode):**
   - Click **"Report Issue"** (`/issues/new`).
   - Title: `Persistent High-Voltage Arc in Transformer Room`
   - Category: `Electrical & Power`
   - Suggested Department: `Electrical & Power` (demonstrates dynamic department dropdown).
   - Visibility: Select **"Confidential (Sensitive)"** or **"Department Only"**.
   - Explain: *"When a report is flagged as Confidential, it is strictly omitted from the public campus feed and duplicate radar. It is visible ONLY to the reporter, administrators, and the assigned technician."*
   - Click **"Submit Report"**.
2. **In Window 2 (Another Student / Unrelated Account):**
   - Try to access the direct URL of the confidential issue:
     - Result: Returns an HTTP 404 Not Found. The server completely masks the existence of the ticket from unauthorized students.

---

### Minute 1:45 – 2:45 | Admin Command Center, Department Routing & SLA Deadlines
1. **In Window 3 (Admin Mode):**
   - View `/admin`:
     - Notice the new report appeared immediately via Socket.IO live sync.
     - Review Queue displays the **Confidential** badge and **Electrical & Power** department pill.
   - Click **"Manage & Assign"** on the ticket to open the dedicated **Admin Issue Details View**:
     - **Department Routing Panel:** Assign issue to `Electrical & Power` and select the designated staff member (`Tech Specialist`).
     - **SLA Deadlines Panel:** Set priority to `High`, configure target resolution deadline (e.g. 24 hours), and enter reason: `Requires emergency certified electrician`.
     - Click **"Save Assignment"**.
   - **Show Assignment History Timeline:**
     - The bottom timeline records: `Action: Assigned | Previous: None | New: Electrical & Power | Assignee: Tech Specialist | Changed By: Admin`.
   - **Demonstrate Redirection:**
     - Click **"Redirect Department"** to simulate an operational misroute (e.g. to `IT Services`).
     - Explain how the system clears incompatible technicians to maintain accountability, recording a second entry in the immutable assignment history.

---

### Minute 2:45 – 3:45 | Staff Work-Queue, Internal Notes & Official Resolution
1. **In Window 2 (Staff Mode - `/staff`):**
   - Notice the ticket is now in the technician's **Assigned to Me** queue with its priority and SLA target countdown.
   - Click **"Triage & Actions"**:
     - Staff member can transition status to `In Progress` or `Awaiting Student Info`.
   - **Post an Internal Staff Note:**
     - Under Discussion, enter: `Breaker tripped on secondary circuit. Ordered 400A replacement fuse from supplier.`
     - Toggle **"Internal Staff Note"** ON and post.
     - The note displays with distinct amber triage styling.
2. **In Window 1 (Student View):**
   - Refresh or view discussion on the ticket:
     - The student **cannot see** the internal technician note.
     - Only official public comments are displayed.

---

### Minute 3:45 – 4:30 | Resolution Verification, Student Reopen & Audit Trail
1. **Technician/Admin Marks Resolved:**
   - In Staff or Admin view, click **"Mark Resolved"** with resolution note: `New 400A fuse installed and load tested at 100% capacity.`
   - Ticket moves to `Resolved` status.
2. **Student Verification & Reopen Workflow:**
   - In Student window, the ticket shows green `Resolved` with resolution details.
   - Suppose the issue recurs: Student clicks **"Reopen Issue"**:
     - Modal demands a mandatory explanation (minimum 10 characters).
     - Enter reason: `Power tripped again immediately when lab machinery turned on.`
     - Submit: Issue status automatically shifts back to `In Progress`, incrementing `reopenCount` to `1`.
3. **Inspect the System Audit Trail:**
   - In Admin view, navigate to `/admin?view=audit`:
     - Full chronological audit log displaying every action (`issue_created`, `issue_assigned`, `issue_redirected`, `status_changed`, `issue_reopened`) with the responsible actor's role, timestamps, and justification context.

---

## 🎯 Viva Q&A Cheat Sheet (Evaluator Questions)

### Q1: How does CampusPulse enforce ticket confidentiality across different APIs?
> **Answer:** Confidentiality is enforced through a centralized `canUserViewIssue(issue, user)` helper invoked on every route (feed, search, details, comments, and Socket.IO subscriptions). If an issue has `visibility === 'confidential'`, only the creator, administrators, and the assigned staff member (`assignedTo`) can access it. For all other users, the API returns a standard 404 to avoid leaking the ticket's existence. Furthermore, confidential tickets are excluded from public Socket broadcasts and Duplicate Radar.

### Q2: What prevents staff members from modifying issues outside their department?
> **Answer:** `staffController.updateStaffIssueStatus` enforces that the requesting staff member is either explicitly assigned to the ticket (`assignedTo`) or belongs to the department currently responsible for the issue (`department`). Unauthorized modification attempts return an HTTP 403 Forbidden.

### Q3: How do you prevent internal staff notes from leaking to students?
> **Answer:** Comments have a boolean flag `isInternal` and visibility `internal`. On the backend, `commentController.getComments` inspects `req.user.role`. If the user is a student, the query filter automatically adds `{ isInternal: { $ne: true } }`. In addition, `createComment` strictly rejects students attempting to post internal notes with an HTTP 403 error.

### Q4: How is the SLA deadline tracked and calculated?
> **Answer:** Each issue stores `responseDeadline` and `resolutionDeadline`. `adminController.js` and `staffController.js` dynamically compute `isOverdue: true` when `resolutionDeadline < new Date()` for tickets not yet resolved or rejected. This powers the "Overdue SLA" filter cards across both the Admin Command Center and Staff Work Queues.

### Q5: How is the audit trail secured?
> **Answer:** The `AuditEvent` collection is an append-only log. Every administrative assignment, department redirection, priority update, and resolution writes an immutable record with the actor's ObjectId, action name, target entity, timestamp, and details diff. No delete or update endpoints exist for the audit log.
