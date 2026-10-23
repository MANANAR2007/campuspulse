# CampusPulse — End-Term Viva Demonstration Script 🎓⚡

> **Estimated Presentation Time:** 3 – 5 minutes  
> **Target Audience:** College Examination Panel / Evaluators  
> **Preparation:** Open two side-by-side browser windows:
> - **Left Window:** Student Session (`http://localhost:5173` or production URL)
> - **Right Window:** Admin Session (Incognito window or separate profile)

---

## 📋 Pre-Demo Verification Checklist

1. **Database & Server Running:**
   ```bash
   npm run test
   ```
   *(Confirms 51/51 test cases pass: MongoDB Atlas connection, JWT HttpOnly cookies, RBAC role separation, Socket.IO handshake, room isolation, alerts, and CRUD).*
2. **Start Dev Servers (if running locally):**
   ```bash
   npm run dev
   ```
   - Server runs on `http://127.0.0.1:5000`
   - Client runs on `http://localhost:5173`
3. **Accounts Prepared:**
   - **Student:** `alex.rivera@campus.edu` / `Password123!` (or register fresh via `/register`)
   - **Admin:** `admin@campus.edu` / `AdminPass123!` (seeded via `npm run seed:admin`)

---

## ⏱️ Step-by-Step Live Demo Script

```
+-----------------------------------+-----------------------------------+
|     LEFT WINDOW (Student View)     |      RIGHT WINDOW (Admin View)    |
|   Logged in as: Alex Rivera       |   Logged in as: Campus Admin      |
|   Layout: AppLayout (Student Mode)|   Layout: AdminLayout (Admin Mode)|
+-----------------------------------+-----------------------------------+
```

### Minute 0:00 – 0:45 | Strict Role Separation & Architecture
1. **Explain the Dual-Mode Role Architecture:**
   > *"CampusPulse features two completely distinct role-based experiences: **Student Mode** for reporting, tracking, and peer affirmation, and **Admin Mode** for facilities dispatch, queue review, and emergency alert approval."*
2. **Demonstrate Navigation Isolation:**
   - **In Left Window (Student):**
     - Point to the student sidebar: only displays **Campus Feed**, **Report Issue**, **My Reports**, and **Notifications**.
     - Notice: **Zero administrative links or controls exist**.
   - **In Right Window (Admin):**
     - Point to the admin sidebar: only displays **Admin Overview**, **Issue Review Queue**, **Campus Alert Management**, and **Sign Out**.
     - Notice: **Zero student features exist** (no feed, no report form, no personal reports).
3. **Demonstrate Role Boundary Enforcement (Direct URL Manipulation):**
   - In Right Window (Admin), type `/` or `/issues/new` in the address bar and press Enter:
     - The browser **immediately redirects back to `/admin`**. Admins cannot access student reporting or feeds.
   - In Left Window (Student), type `/admin` in the address bar:
     - The system renders a clean **Access Denied** security boundary, explaining that the current user has the Student role.
   - Mention: This is enforced at both the React Router boundary and on the backend (`requireAdmin` and `requireStudent` middleware return HTTP 403 Forbidden).

---

### Minute 0:45 – 1:30 | Student Report with Emergency Alert Request
1. **In Left Window (Student):**
   - Click **"Report Issue"** (`/issues/new`).
   - Title: `Major Water Main Leak in Science Wing B`
   - Description: `Main overhead pipe burst on 2nd floor corridor. Water spreading rapidly toward computer lab 204.`
   - Category: `Plumbing`
   - Severity: `Critical`
   - Location: Building: `Science Complex`, Area: `North Wing`, Floor: `Floor 2`, Room: `Corridor / Lab 204`.
   - Toggle **"Request Campus-Wide Alert"** ON.
   - *(Optional)* Attach an image (demonstrating Cloudinary multi-part upload).
   - Click **"Submit Report"**.
2. **Immediate Real-time Synchronization:**
   - The student's screen transitions to `/my-reports`.
   - **LOOK AT RIGHT WINDOW (Admin):** Without refreshing the page, the Admin Review Queue counter increments, and the new report appears in the live queue labeled with a yellow `Reported` status and an amber badge `Alert Requested`.

---

### Minute 1:30 – 2:30 | Admin Verification & Campus Alert Fan-Out
1. **In Right Window (Admin Dashboard):**
   - Click **"Verify Report"** on the newly submitted issue.
   - Check **"Approve Official Campus-Wide Alert"**.
   - Enter Administrator Note: `Facilities emergency plumbing team dispatched. Electrical mains in Wing B isolated for safety.`
   - Click **"Confirm Decision"**.
2. **Watch Real-Time Reactive Propagation:**
   - **LOOK AT LEFT WINDOW (Student Feed):**
     - Instantly, a high-priority red **Campus Alert Banner** animates onto the top of the feed.
     - The issue card status updates live from `Reported` to `Verified`.
   - **LOOK AT STUDENT HEADER:**
     - The notification bell updates with a live badge (+1).
     - Click **Notifications** (`/notifications`): An official alert card reads:  
       `🚨 Official Campus-Wide Alert Issued: An urgent alert regarding "Major Water Main Leak..."`

---

### Minute 2:30 – 3:30 | Peer Affirmation & Admin Inspection View
1. **In Left Window (Student):**
   - Click on the issue card to open **Issue Details** (`/issues/:id`).
   - Click **"Affects Me Too"**:
     - Counter increments from `0` to `1` in real-time.
   - Under Discussion, post a comment: `Water is now dripping into ground floor lecture hall 102.`
2. **In Right Window (Admin Mode):**
   - In the review queue, click **"Details"** (`/admin/issues/:id`):
     - Opens the dedicated **Admin Issue Details View** (rendered inside `AdminLayout`).
     - Admin can inspect the full report, reporter credentials, photographic evidence, and discussion thread audit.
     - Point out: **Admins cannot click "Affects Me Too"** (it is a student-only affirmation).
3. **Dispatch Maintenance & Resolve:**
   - On the Admin Issue Details page, click **"Dispatch Maintenance (In Progress)"**.
   - Left Window status badge updates live to orange `In Progress`.
   - Click **"Mark Issue Resolved"** with resolution note: `Pipe replaced and pressure tested. All corridors dried and cleared for access.`
   - Status transitions to green `Resolved`, and the alert banner disappears from active student feeds.

---

### Minute 3:30 – 4:15 | Technical Architecture & Viva Defense
Conclude with these key points:
- **Strict Role Separation:** Frontend layouts (`AppLayout` vs `AdminLayout`) and route guards prevent accidental interface overlap. Backend middleware (`requireAdmin`, `requireStudent`) guarantees API security.
- **Session Restoration:** Upon browser refresh, `/api/auth/me` restores user credentials; guards ensure admins stay in `/admin` and students stay in `/` without UI flashing.
- **Single-Origin Deployment:** Express serves the compiled React client as a single origin (`client/dist`), with SPA routing fallback for client routes while preserving strict JSON 404 responses for invalid `/api/*` requests.

---

## 🎯 Viva Q&A Cheat Sheet (Evaluator Questions)

### Q1: How do you prevent an administrator from creating student reports or using "Affects Me Too"?
> **Answer:** We enforce role separation at the backend level using `requireStudent` middleware on `POST /api/issues`, `POST /api/issues/:id/confirm`, and `GET /api/issues/mine`. If an admin attempts to invoke these endpoints using their JWT cookie, the server rejects the request with HTTP 403 Forbidden. On the frontend, `StudentRouteGuard` automatically redirects any logged-in administrator away from student reporting screens to `/admin`.

### Q2: How do you prevent students from accessing administrative queues or actions?
> **Answer:** All `/api/admin/*` routes are protected by `requireAdmin` middleware, which decodes the JWT and validates that `req.user.role === 'admin'`. Students receive HTTP 403 Forbidden. On the frontend, `AdminRouteGuard` intercepts students navigating to `/admin` or `/admin/*` and renders a clear "Access Denied" view without exposing admin statistics or queue data.

### Q3: What happens when an admin refreshes the page? Is there a flash of student feed?
> **Answer:** No. While `/api/auth/me` is running on page load, `loading` is set to `true`. Both `StudentRouteGuard` and `AdminRouteGuard` render an accessible loading spinner while the session restores. Once the user's role is confirmed as `admin`, the router keeps them inside `AdminLayout` without any flash of student navigation.

### Q4: Why use HttpOnly cookies for JWT instead of localStorage?
> **Answer:** `localStorage` is accessible to client-side JavaScript, leaving sessions vulnerable to Cross-Site Scripting (XSS). HttpOnly cookies cannot be read by `document.cookie`, preventing token exfiltration even in the presence of an XSS vulnerability. Combined with `SameSite: Lax`, this provides robust protection against CSRF and credential theft.

### Q5: How is Socket.IO authenticated and partitioned?
> **Answer:** Sockets authenticate during the WebSocket handshake by reading the HttpOnly `token` cookie directly from `socket.request.headers.cookie`. We use three isolated room layers: `user:<userId>` for personal notifications, `role:admin` for operations staff alerts, and `issue:<issueId>` for thread discussions.
