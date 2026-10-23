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
   *(Confirms 40/40 test cases pass: MongoDB Atlas connection, JWT HttpOnly cookies, Socket.IO handshake, room isolation, alerts, and CRUD).*
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
+-----------------------------------+-----------------------------------+
```

### Minute 0:00 – 0:30 | Architecture & Health Check
1. **Explain the Purpose:**
   > *"CampusPulse is a real-time campus issue reporting and operations platform. It bridges students and facilities management using a single MERN stack with authenticated WebSocket synchronization."*
2. **Show Health Endpoint:**
   - In a new tab or via curl, open `http://127.0.0.1:5000/api/health`.
   - Point out: `status: "ok"`, `database: "connected"`, uptime counter, and that **no database secrets or URIs are leaked**.
3. **Show Socket Indicator:**
   - Point to the live socket pulse indicator in the navigation bar (`● Live Sync Connected`).
   - Mention: Sockets authenticate via **HttpOnly JWT cookies during the initial handshake**—no secrets exist in JavaScript variables or URL parameters.

---

### Minute 0:30 – 1:15 | Student Report with Emergency Alert Request
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

### Minute 1:15 – 2:15 | Admin Verification & Campus Alert Fan-Out
1. **In Right Window (Admin Dashboard):**
   - Click **"Review"** on the newly submitted issue.
   - Select Decision: **"Verify Report"**.
   - Check **"Approve Campus-Wide Emergency Alert"**.
   - Enter Administrator Note: `Facilities emergency plumbing team dispatched. Electrical mains in Wing B isolated for safety.`
   - Click **"Confirm Review"**.
2. **Watch Real-Time Reactive Propagation:**
   - **LOOK AT LEFT WINDOW (Student Feed):**
     - Instantly, a high-priority red **Campus Alert Banner** animates onto the top of the feed.
     - The issue card status updates live from `Reported` to `Verified`.
   - **LOOK AT STUDENT HEADER:**
     - The notification bell updates with a live badge (+1).
     - Click **Notifications** (`/notifications`): An official alert card reads:  
       `🚨 Official Campus-Wide Alert Issued: An urgent alert regarding "Major Water Main Leak..."`

---

### Minute 2:15 – 3:00 | Social Affirmation & Real-Time Discussion Thread
1. **In Left Window (Student):**
   - Click on the issue card to open **Issue Details** (`/issues/:id`).
   - Point out that entering this page automatically joins the WebSocket room `issue:<id>`.
   - Click **"Affects Me Too"**:
     - Counter increments from `0` to `1` in real-time.
     - The button updates to show confirmed state.
2. **Real-Time Discussion:**
   - Under Discussion, post a comment: `Water is now dripping into ground floor lecture hall 102.`
   - **LOOK AT RIGHT WINDOW (Admin):**
     - The comment immediately appears in the thread with student name, department, and relative timestamp—**zero manual polling or reload needed**.
3. **Admin Response:**
   - Right Window (Admin) posts: `Ground floor power cut off. Buckets and extraction pumps on site.`
   - Left Window (Student) sees the admin comment appear with a distinct blue `Admin` badge.

---

### Minute 3:00 – 3:45 | Status Lifecycle & Alert Clearing
1. **In Right Window (Admin):**
   - Click **"Update Status"** on the issue.
   - Transition status from `Verified` -> `In Progress`.
   - Left Window status badge updates live to orange `In Progress`.
   - Once repaired, transition status to `Resolved` with note: `Pipe replaced and pressure tested. All corridors dried and cleared for access.`
2. **Live Resolution:**
   - The status updates live to green `Resolved`.
   - The emergency alert banner automatically disappears from the top of the feed because resolved issues no longer pose active hazards.

---

### Minute 3:45 – 4:30 | Technical Resilience & Viva Defense
Conclude with these key points:
- **Fallback Reliability:** If the WebSocket connection drops (e.g. mobile network hiccup), all features fall back smoothly to REST endpoints. Database persistence is 100% authoritative in MongoDB Atlas.
- **Production Architecture:** Express serves the compiled React client as a single origin (`client/dist`), with SPA routing fallback for client routes (`/feed`, `/admin`, `/my-reports`) while preserving strict JSON 404 responses for invalid `/api/*` requests.

---

## 🎯 Viva Q&A Cheat Sheet (Evaluator Questions)

### Q1: Why use HttpOnly cookies for JWT instead of localStorage?
> **Answer:** `localStorage` is vulnerable to Cross-Site Scripting (XSS)—any malicious injected script can read `localStorage.getItem('token')`. HttpOnly cookies cannot be read by JavaScript `document.cookie`, preventing token exfiltration even in the presence of an XSS vulnerability. We combine this with `SameSite: Lax` to mitigate Cross-Site Request Forgery (CSRF).

### Q2: How is Socket.IO authenticated without exposing tokens?
> **Answer:** Socket.IO's initial HTTP handshake inspects `socket.request.headers.cookie`. We extract the `token` cookie, verify the signature with `jwt.verify(token, JWT_SECRET)`, query MongoDB to ensure the user still exists and has not been deleted, and attach `socket.user` to the socket instance. Unauthenticated handshakes are immediately rejected before the connection is established.

### Q3: How do Socket.IO rooms work here?
> **Answer:** We use three distinct room layers:
> 1. `user:<userId>`: Private targeted room for direct notifications (e.g., when an author's report status changes).
> 2. `role:admin`: Admin-only operations room for staff alerts.
> 3. `issue:<issueId>`: Thread-level room for discussion and comments. Users can only join an issue room if the issue is accessible (e.g., non-admin students cannot join rooms for rejected issues).

### Q4: What happens if Cloudinary credentials are not provided?
> **Answer:** CampusPulse degrades gracefully. If Cloudinary credentials are omitted, image upload returns a clear 503 response stating that image upload is temporarily disabled, while text-only issue reporting remains fully functional. When configured, Multer validates file size (5MB), MIME types, and binary magic bytes (`0xFFD8FF` for JPEG, `0x89504E47` for PNG) before streaming to Cloudinary.

### Q5: How is single-origin deployment handled?
> **Answer:** In `server/src/app.js`, Express mounts static middleware to serve `client/dist`. Any non-API GET request serves `index.html` allowing React Router to handle client-side routing. Any unhandled route starting with `/api` bypasses static serving and triggers the `notFound` middleware, returning a standardized JSON 404 error.
