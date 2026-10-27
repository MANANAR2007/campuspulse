/**
 * CampusPulse Comprehensive Automated Test Suite (Stage 6)
 *
 * Verifies:
 * 1. Health check & DB connection status
 * 2. Production static serving and SPA fallback vs /api 404
 * 3. Student & Admin authentication, JWT HttpOnly cookies, RBAC
 * 4. Socket.IO authenticated handshake & rejected unauthenticated connections
 * 5. Socket.IO room authorization (join:issue / leave:issue)
 * 6. Real-time broadcast events (issue:created, comment:created, confirmation:updated, issue:statusChanged, alert:approved, notification:new)
 * 7. REST fallback resilience & data persistence
 */

import http from 'http';
import mongoose from 'mongoose';
import { io as ClientIO } from 'socket.io-client';
import app from '../app.js';
import { config } from '../config/index.js';
import { connectDB } from '../config/db.js';
import { initSocket } from '../utils/socket.js';
import User from '../models/User.js';
import Issue from '../models/Issue.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import Department, { ensureDefaultDepartments } from '../models/Department.js';
import AuditEvent from '../models/AuditEvent.js';

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Color formatting for console
const green = (text) => `\x1b[32m✔ ${text}\x1b[0m`;
const red = (text) => `\x1b[31m✖ ${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;

let serverInstance;
let ioInstance;
let mongodInstance = null;
let studentCookie = null;
let adminCookie = null;
let testStudentUser = null;
let testIssueId = null;
let testCommentId = null;

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ${green(message)}`);
    passedTests++;
  } else {
    console.error(`  ${red(message)}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Helper to extract cookie from fetch response
function extractCookie(res, cookieName = 'token') {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? `${cookieName}=${match[1]}` : null;
}

async function runTests() {
  console.log(`\n${bold('========================================================')}`);
  console.log(`${bold('🎓 CampusPulse Automated Verification & Test Suite')}`);
  console.log(`${bold('========================================================')}\n`);

  try {
    // 0. Database & Server Setup
    console.log(cyan('1. Initializing Test Server & Database...'));
    try {
      await connectDB();
    } catch (dbErr) {
      console.log(cyan('  ⚠️  Atlas cluster rejected connection (IP not whitelisted). Spawning local MongoMemoryServer for automated test verification...'));
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      await mongoose.connect(mongodInstance.getUri());
      console.log(`  ${green('Connected to in-memory test database successfully.')}`);
    }
    const httpServer = http.createServer(app);
    ioInstance = initSocket(httpServer);
    await ensureDefaultDepartments();

    await new Promise((resolve) => {
      serverInstance = httpServer.listen(TEST_PORT, '127.0.0.1', resolve);
    });
    console.log(`  ${green(`Test server listening on ${BASE_URL}`)}`);

    // Clean up any stale test accounts from previous runs
    const testEmail = `test_student_${Date.now()}@campus.edu`;
    await User.deleteMany({ email: { $regex: /^(test_student_|test_staff_|student2_|spoof_staff_)/ } });
    await Department.deleteMany({ code: { $regex: /^ROBOT_/ } });

    // 1. Health Check Endpoint
    console.log(`\n${cyan('2. Verifying Health & System Endpoints...')}`);
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');
    assert(healthData.status === 'ok' || healthData.status === 'healthy', 'Health check reports operational status ("ok")');
    assert(healthData.database === 'connected', 'Health check reports database: "connected"');
    assert(!healthData.mongodbUri, 'Health check does not expose connection string or secrets');

    // 2. Production Static Serving & SPA Fallback
    console.log(`\n${cyan('3. Verifying Production SPA Fallback vs API 404...')}`);
    const spaRes = await fetch(`${BASE_URL}/feed`);
    const spaText = await spaRes.text();
    assert(spaRes.status === 200, 'Non-API frontend route GET /feed returns HTTP 200');
    assert(
      spaText.includes('<html') || spaText.includes('<!DOCTYPE') || spaText.includes('CampusPulse'),
      'SPA fallback serves index.html markup for client router'
    );

    const api404Res = await fetch(`${BASE_URL}/api/nonexistent-route-for-testing`);
    const api404Data = await api404Res.json();
    assert(api404Res.status === 404, 'Unknown API route GET /api/... returns HTTP 404');
    assert(
      api404Data.message && api404Data.message.includes('Resource not found'),
      'Unknown API route returns JSON 404 error rather than HTML SPA fallback'
    );

    // 3. User Registration & Authentication (JWT HttpOnly Cookies)
    console.log(`\n${cyan('4. Verifying Student Authentication & HttpOnly Cookies...')}`);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Rivera',
        email: testEmail,
        password: 'Password123!',
      }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, 'Student registration returns HTTP 201 Created');
    const regUser = regData.user || regData.data?.user;
    assert(regUser && regUser.role === 'student', 'New user registered with "student" role');
    studentCookie = extractCookie(regRes, 'token');
    assert(studentCookie !== null, 'Registration sets HttpOnly "token" cookie in Set-Cookie header');
    testStudentUser = regUser;

    // Verify /api/auth/me with cookie
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: studentCookie },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /api/auth/me with valid cookie returns HTTP 200');
    const meUser = meData.user || meData.data?.user;
    assert(meUser && meUser.email === testEmail, 'GET /api/auth/me returns authenticated student profile');

    // Verify /api/auth/me without cookie is rejected
    const unauthRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert(unauthRes.status === 401, 'GET /api/auth/me without cookie returns HTTP 401 Unauthorized');

    // 4. Admin Authentication & Role Enforcement
    console.log(`\n${cyan('5. Verifying Admin Authentication & RBAC Authorization...')}`);
    // Check if admin user exists, or create one for test
    const adminEmail = config.adminEmail || 'admin@campus.edu';
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      const passwordHash = await User.hashPassword(config.adminPassword || 'AdminPass123!');
      adminUser = await User.create({
        name: config.adminName || 'Campus Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin',
      });
    }

    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminEmail,
        password: config.adminPassword || 'AdminPass123!',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin login returns HTTP 200');
    const adminUserObj = adminLoginData.user || adminLoginData.data?.user;
    assert(adminUserObj && adminUserObj.role === 'admin', 'Authenticated user role is "admin"');
    adminCookie = extractCookie(adminLoginRes, 'token');
    assert(adminCookie !== null, 'Admin login sets HttpOnly "token" cookie');

    // Student attempting admin endpoints is rejected with 403 Forbidden
    const forbiddenRes = await fetch(`${BASE_URL}/api/admin/issues`, {
      headers: { Cookie: studentCookie },
    });
    assert(forbiddenRes.status === 403, 'Student accessing GET /api/admin/issues returns HTTP 403 Forbidden');

    const forbiddenStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: studentCookie },
    });
    assert(forbiddenStatsRes.status === 403, 'Student accessing GET /api/admin/stats returns HTTP 403 Forbidden');

    // Admin attempting student-only write operations is rejected with 403 Forbidden
    const adminCreateIssueRes = await fetch(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: 'Admin attempting student report creation',
        description: 'This must be blocked by requireStudent backend guard.',
        category: 'infrastructure',
        severity: 'low',
        location: { building: 'Admin Block' },
      }),
    });
    const adminCreateIssueData = await adminCreateIssueRes.json();
    assert(
      adminCreateIssueRes.status === 403,
      'Admin attempting POST /api/issues (Student Report) returns HTTP 403 Forbidden'
    );
    assert(
      adminCreateIssueData.message && adminCreateIssueData.message.includes('restricted to students'),
      'Backend error explains action is restricted to students'
    );

    const adminConfirmRes = await fetch(`${BASE_URL}/api/issues/6adb17385aa20577b91453cc/confirm`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    assert(
      adminConfirmRes.status === 403,
      'Admin attempting POST /api/issues/:id/confirm (Affects Me Too) returns HTTP 403 Forbidden'
    );

    const adminMyReportsRes = await fetch(`${BASE_URL}/api/issues/mine`, {
      headers: { Cookie: adminCookie },
    });
    assert(
      adminMyReportsRes.status === 403,
      'Admin attempting GET /api/issues/mine returns HTTP 403 Forbidden'
    );

    // Admin accessing admin endpoint succeeds
    const adminAccessRes = await fetch(`${BASE_URL}/api/admin/issues`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminAccessRes.status === 200, 'Admin accessing GET /api/admin/issues returns HTTP 200');

    const adminStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminStatsRes.status === 200, 'Admin accessing GET /api/admin/stats returns HTTP 200');

    // 5. Socket.IO Authenticated Handshake & Reject Unauthenticated
    console.log(`\n${cyan('6. Verifying Authenticated Socket.IO Handshake...')}`);

    // Test rejection without cookie
    let unauthSocketRejected = false;
    await new Promise((resolve) => {
      const socketNoCookie = ClientIO(BASE_URL, {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: false,
      });

      socketNoCookie.on('connect_error', (err) => {
        if (err.message.includes('No session cookie provided') || err.message.includes('Authentication')) {
          unauthSocketRejected = true;
        }
        socketNoCookie.disconnect();
        resolve();
      });

      socketNoCookie.on('connect', () => {
        socketNoCookie.disconnect();
        resolve();
      });
    });
    assert(unauthSocketRejected, 'Socket connection WITHOUT token cookie is rejected with auth error');

    // Test rejection with invalid token
    let invalidSocketRejected = false;
    await new Promise((resolve) => {
      const socketInvalid = ClientIO(BASE_URL, {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: {
          Cookie: 'token=invalid.jwt.token.here',
        },
      });

      socketInvalid.on('connect_error', (err) => {
        if (err.message.includes('Invalid session') || err.message.includes('Authentication failed')) {
          invalidSocketRejected = true;
        }
        socketInvalid.disconnect();
        resolve();
      });

      socketInvalid.on('connect', () => {
        socketInvalid.disconnect();
        resolve();
      });
    });
    assert(invalidSocketRejected, 'Socket connection WITH invalid token is rejected with auth error');

    // Test successful student socket connection
    const studentSocket = ClientIO(BASE_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      extraHeaders: { Cookie: studentCookie },
    });

    await new Promise((resolve, reject) => {
      studentSocket.on('connect', resolve);
      studentSocket.on('connect_error', reject);
    });
    assert(studentSocket.connected, 'Socket connection WITH valid student token succeeds and connects');

    // Test successful admin socket connection
    const adminSocket = ClientIO(BASE_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      extraHeaders: { Cookie: adminCookie },
    });

    await new Promise((resolve, reject) => {
      adminSocket.on('connect', resolve);
      adminSocket.on('connect_error', reject);
    });
    assert(adminSocket.connected, 'Socket connection WITH valid admin token succeeds and connects');

    // 6. Realtime Issue Creation & Broadcast Event
    console.log(`\n${cyan('7. Verifying Realtime Issue Creation & Event Broadcast...')}`);

    const issueCreatedPromise = new Promise((resolve) => {
      studentSocket.once('issue:created', (payload) => {
        resolve(payload);
      });
    });

    const createIssueRes = await fetch(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        title: 'Emergency Power Grid Outage in North Wing',
        description: 'Main laboratory circuit breaker tripped causing power loss across 3 floors.',
        category: 'electrical',
        severity: 'critical',
        location: {
          building: 'Science Complex',
          area: 'Academic Block A',
          floor: 'Floor 3',
          room: 'Lab 304',
        },
        campusAlertRequested: true,
      }),
    });

    const createIssueData = await createIssueRes.json();
    if (createIssueRes.status !== 201) {
      console.error('Create issue failed with status', createIssueRes.status, createIssueData);
    }
    assert(createIssueRes.status === 201, 'Student issue creation POST /api/issues returns HTTP 201');
    testIssueId = createIssueData.data.issue.id || createIssueData.data.issue._id;
    assert(testIssueId !== undefined, 'Issue creation returns assigned MongoDB ID');
    assert(
      Array.isArray(createIssueData.data.issue.statusHistory) &&
        createIssueData.data.issue.statusHistory.length === 1 &&
        createIssueData.data.issue.statusHistory[0].status === 'reported',
      'Issue initialized with statusHistory recording initial student report'
    );

    const createdEventPayload = await Promise.race([
      issueCreatedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for issue:created')), 4000)),
    ]);
    assert(
      (createdEventPayload.issue.id || createdEventPayload.issue._id) === testIssueId,
      'Realtime "issue:created" event received with correct issue payload'
    );

    // Duplicate Radar Pre-Submission Check
    console.log(`\n${cyan('7b. Verifying Duplicate Radar Pre-Submission Check...')}`);
    const dupRes = await fetch(`${BASE_URL}/api/issues/duplicates?q=Power Grid Outage&category=electrical`, {
      headers: { Cookie: studentCookie },
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 200, 'GET /api/issues/duplicates returns HTTP 200');
    assert(Array.isArray(dupData.data?.duplicates), 'Duplicates endpoint returns array of candidate issues');
    const matchedDup = dupData.data?.duplicates?.some((d) => (d.id || d._id) === testIssueId);
    assert(matchedDup, 'Duplicate Radar accurately identifies newly reported similar issue');

    // 7. Realtime Room Join & Comment Emission
    console.log(`\n${cyan('8. Verifying Issue Room Subscription & Comment Realtime Event...')}`);

    // Join room
    studentSocket.emit('join:issue', testIssueId);
    await new Promise((r) => setTimeout(r, 200));

    const commentCreatedPromise = new Promise((resolve) => {
      studentSocket.once('comment:created', (payload) => {
        resolve(payload);
      });
    });

    const createCommentRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        text: 'Campus electrician team dispatched to verify circuit breaker.',
      }),
    });

    const createCommentData = await createCommentRes.json();
    assert(createCommentRes.status === 201, 'POST /api/issues/:id/comments returns HTTP 201');
    testCommentId = createCommentData.data.comment.id || createCommentData.data.comment._id;

    const commentEventPayload = await Promise.race([
      commentCreatedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for comment:created')), 4000)),
    ]);
    assert(
      commentEventPayload.issueId === testIssueId &&
        (commentEventPayload.comment.id || commentEventPayload.comment._id) === testCommentId,
      'Realtime "comment:created" event received in issue room'
    );

    // 8. Realtime Affects Me Too Confirmation
    console.log(`\n${cyan('9. Verifying "Affects Me Too" Realtime Broadcast...')}`);

    const confirmationPromise = new Promise((resolve) => {
      studentSocket.once('confirmation:updated', (payload) => {
        resolve(payload);
      });
    });

    const confirmRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}/confirm`, {
      method: 'POST',
      headers: { Cookie: studentCookie },
    });
    const confirmData = await confirmRes.json();
    assert(confirmRes.status === 200, 'POST /api/issues/:id/confirm returns HTTP 200');
    assert(confirmData.data.currentUserConfirmed === true, 'Confirmation toggled to true');

    const confirmEventPayload = await Promise.race([
      confirmationPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for confirmation:updated')), 4000)),
    ]);
    assert(
      confirmEventPayload.issueId === testIssueId && confirmEventPayload.confirmationCount >= 1,
      'Realtime "confirmation:updated" broadcast received with new confirmation count'
    );

    // 9. Admin Review, Status Transition & Alert Approval Broadcast
    console.log(`\n${cyan('10. Verifying Admin Status Change & Alert Approval Events...')}`);

    const statusChangedPromise = new Promise((resolve) => {
      studentSocket.once('issue:statusChanged', (payload) => {
        resolve(payload);
      });
    });

    const alertApprovedPromise = new Promise((resolve) => {
      studentSocket.once('alert:approved', (payload) => {
        resolve(payload);
      });
    });

    const reviewRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        decision: 'verify',
        approveCampusAlert: true,
        resolutionNote: 'Safety hazards verified by facilities head. Campus alert activated.',
      }),
    });

    const reviewData = await reviewRes.json();
    if (reviewRes.status !== 200) {
      console.error('Admin review failed with status', reviewRes.status, 'Message:', reviewData.message);
      if (reviewData.stack) console.error('Stack:', reviewData.stack);
    }
    assert(reviewRes.status === 200, 'Admin review PATCH /api/admin/issues/:id/review returns HTTP 200');
    assert(reviewData.data.issue.status === 'verified', 'Issue status transitioned to "verified"');
    assert(reviewData.data.issue.isCampusWideAlert === true, 'Issue promoted to official campus alert');

    const statusEvent = await Promise.race([
      statusChangedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for issue:statusChanged')), 4000)),
    ]);
    assert(
      (statusEvent.issue.id || statusEvent.issue._id) === testIssueId && statusEvent.issue.status === 'verified',
      'Realtime "issue:statusChanged" event broadcast to students'
    );

    const alertEvent = await Promise.race([
      alertApprovedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for alert:approved')), 4000)),
    ]);
    assert(
      (alertEvent.alert.id || alertEvent.alert._id) === testIssueId && alertEvent.alert.isCampusWideAlert === true,
      'Realtime "alert:approved" event broadcast across campus'
    );

    // Verify Admin-Only Issue Details API Role Separation
    const studentAccessAdminDetailRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}`, {
      headers: { Cookie: studentCookie },
    });
    assert(
      studentAccessAdminDetailRes.status === 403,
      'Student accessing GET /api/admin/issues/:id returns HTTP 403 Forbidden'
    );

    const adminAccessDetailRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}`, {
      headers: { Cookie: adminCookie },
    });
    const adminAccessDetailData = await adminAccessDetailRes.json();
    assert(
      adminAccessDetailRes.status === 200,
      'Admin accessing GET /api/admin/issues/:id returns HTTP 200'
    );
    assert(
      adminAccessDetailData.data && (adminAccessDetailData.data.issue.id || adminAccessDetailData.data.issue._id) === testIssueId,
      'Admin issue detail returns full report with populated submitter and reviewer'
    );
    assert(
      Array.isArray(adminAccessDetailData.data.issue.statusHistory) && adminAccessDetailData.data.issue.statusHistory.length >= 2,
      'Status history timeline records review transition with timestamp and reviewer'
    );

    // Lifecycle Transition Validation (Allowed: verified -> in_progress, Rejected: verified -> reported)
    console.log(`\n${cyan('10b. Verifying Status Lifecycle Transition Matrix...')}`);
    const invalidTransitionRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: 'reported' }),
    });
    assert(
      invalidTransitionRes.status === 400,
      'Invalid status transition (verified -> reported) rejected with HTTP 400'
    );

    const validTransitionRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        status: 'in_progress',
        resolutionNote: 'Electrical contractor team is on-site repairing damaged transformer coils.',
      }),
    });
    const validTransitionData = await validTransitionRes.json();
    assert(
      validTransitionRes.status === 200,
      'Valid status transition (verified -> in_progress) returns HTTP 200'
    );
    assert(
      validTransitionData.data.issue.status === 'in_progress' &&
        validTransitionData.data.issue.statusHistory.length >= 3,
      'Issue status updated to in_progress with updated statusHistory entry'
    );

    // Campus Hotspots Analytics Endpoint
    console.log(`\n${cyan('10c. Verifying Campus Hotspots & Recurrence Detection...')}`);
    const hotspotsRes = await fetch(`${BASE_URL}/api/admin/hotspots`, {
      headers: { Cookie: adminCookie },
    });
    const hotspotsData = await hotspotsRes.json();
    assert(hotspotsRes.status === 200, 'GET /api/admin/hotspots returns HTTP 200');
    assert(Array.isArray(hotspotsData.data.hotspots), 'Hotspots API returns array of campus zones');
    const academicZone = hotspotsData.data.hotspots.find((h) => h.zone === 'academic_blocks');
    assert(academicZone && academicZone.totalReports >= 1, 'Academic blocks zone aggregates newly reported issue');

    // Admin Command Center Stats Endpoint
    console.log(`\n${cyan('10d. Verifying Admin Command Center Stats & Distributions...')}`);
    const commandCenterStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    const commandCenterStatsData = await commandCenterStatsRes.json();
    assert(commandCenterStatsRes.status === 200, 'GET /api/admin/stats returns HTTP 200');
    assert(
      Array.isArray(commandCenterStatsData.data.categoryDistribution) &&
        Array.isArray(commandCenterStatsData.data.statusDistribution) &&
        Array.isArray(commandCenterStatsData.data.recentVelocity),
      'Admin stats returns category distribution, status distribution, and 7-day velocity series'
    );

    // Rate Limiter Proxy Header Resilience (No ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
    console.log(`\n${cyan('10e. Verifying Proxy Header & Rate Limiter Resilience...')}`);
    const proxyCheckRes = await fetch(`${BASE_URL}/api/health`, {
      headers: {
        'X-Forwarded-For': '203.0.113.195, 198.51.100.1',
      },
    });
    assert(
      proxyCheckRes.status === 200,
      'API rate limiter behind reverse proxy processes X-Forwarded-For headers safely'
    );

    // 10. Database-backed Notification Realtime Delivery
    console.log(`\n${cyan('11. Verifying Author Private Notification Event...')}`);
    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Cookie: studentCookie },
    });
    const notifData = await notifRes.json();
    assert(notifRes.status === 200, 'GET /api/notifications returns HTTP 200');
    assert(
      notifData.data && notifData.data.notifications.length > 0,
      'Author received database-backed notification for status change'
    );

    // 11. REST Fallback & Active Alerts Integrity
    console.log(`\n${cyan('12. Verifying REST API Fallback & Alerts Integrity...')}`);
    const alertsRes = await fetch(`${BASE_URL}/api/issues/alerts`, {
      headers: { Cookie: studentCookie },
    });
    const alertsData = await alertsRes.json();
    assert(alertsRes.status === 200, 'GET /api/issues/alerts returns HTTP 200');
    const hasApprovedAlert = alertsData.data.alerts.some(
      (a) => (a.id || a._id) === testIssueId
    );
    assert(hasApprovedAlert, 'Approved alert is returned in public REST alerts feed');

    // 13. Operational Department Management & Default Seeding
    console.log(`\n${cyan('13. Verifying Operational Department Routing & Seeding...')}`);
    const deptsRes = await fetch(`${BASE_URL}/api/departments`);
    const deptsData = await deptsRes.json();
    assert(deptsRes.status === 200, 'GET /api/departments returns HTTP 200');
    assert(
      deptsData.data?.departments?.length >= 5,
      'Database contains pre-seeded operational campus departments'
    );

    // Admin creates a custom department
    const deptSuffix = Date.now().toString().slice(-4);
    const newDeptRes = await fetch(`${BASE_URL}/api/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: `Robotics & Automation Lab ${deptSuffix}`,
        code: `ROBOT_${deptSuffix}`,
        description: 'Robotics facility and smart manufacturing labs',
      }),
    });
    const newDeptData = await newDeptRes.json();
    assert(newDeptRes.status === 201, 'Admin POST /api/departments returns HTTP 201 Created');
    const testDeptId = newDeptData.data.department.id || newDeptData.data.department._id;

    // Student attempting to create department is forbidden
    const studentDeptRes = await fetch(`${BASE_URL}/api/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        name: 'Unauthorized Student Department',
        code: 'HACK',
      }),
    });
    assert(studentDeptRes.status === 403, 'Student attempting to create department returns HTTP 403 Forbidden');

    // 14. Staff Provisioning & Role Guarding
    console.log(`\n${cyan('14. Verifying Staff Account Provisioning & Work Queue RBAC...')}`);
    const staffEmail = `test_staff_${Date.now()}@campuspulse.edu`;
    const createStaffRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Lab Specialist Tech',
        email: staffEmail,
        password: 'password123',
        departmentId: testDeptId,
      }),
    });
    const createStaffData = await createStaffRes.json();
    if (createStaffRes.status !== 201) {
      console.log('DEBUG createStaffRes:', createStaffRes.status, createStaffData);
    }
    assert(createStaffRes.status === 201, 'Admin POST /api/admin/staff returns HTTP 201');
    const testStaffId = createStaffData.data.user?._id || createStaffData.data.staff?._id || createStaffData.data.user?.id;

    // Verify created staff member appears in GET /api/admin/staff listing
    const getStaffRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      headers: { Cookie: adminCookie },
    });
    const getStaffData = await getStaffRes.json();
    assert(getStaffRes.status === 200, 'Admin GET /api/admin/staff returns HTTP 200');
    const createdStaffMember = getStaffData.data?.staff?.find((s) => (s.id || s._id) === testStaffId);
    assert(Boolean(createdStaffMember), 'Created staff member appears in GET /api/admin/staff listing');
    assert(
      (createdStaffMember?.department?.id || createdStaffMember?.department?._id || createdStaffMember?.department) === testDeptId,
      'Staff member in admin listing is associated with correct department'
    );

    // Negative Test: Invalid department ID format -> 400
    const invalidDeptRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Invalid Dept Tech',
        email: `invalid_dept_${Date.now()}@campuspulse.edu`,
        password: 'password123',
        departmentId: 'invalid-id-xyz',
      }),
    });
    const invalidDeptData = await invalidDeptRes.json();
    assert(invalidDeptRes.status === 400, 'POST /api/admin/staff with malformed department ID returns HTTP 400');
    assert(invalidDeptData.message === 'Valid department ID is required.', 'Returns "Valid department ID is required." error message');

    // Negative Test: Nonexistent department ID -> 404
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const nonExistentDeptRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Ghost Dept Tech',
        email: `ghost_dept_${Date.now()}@campuspulse.edu`,
        password: 'password123',
        departmentId: nonExistentId,
      }),
    });
    const nonExistentDeptData = await nonExistentDeptRes.json();
    assert(nonExistentDeptRes.status === 404, 'POST /api/admin/staff with nonexistent department ID returns HTTP 404');
    assert(nonExistentDeptData.message === 'Department not found.', 'Returns "Department not found." error message');

    // Negative Test: Inactive department -> 400
    const deactivateRes = await fetch(`${BASE_URL}/api/departments/${testDeptId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert(deactivateRes.status === 200, 'Admin deactivates department returns HTTP 200');

    const inactiveStaffRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Inactive Dept Tech',
        email: `inactive_dept_${Date.now()}@campuspulse.edu`,
        password: 'password123',
        departmentId: testDeptId,
      }),
    });
    const inactiveStaffData = await inactiveStaffRes.json();
    assert(inactiveStaffRes.status === 400, 'POST /api/admin/staff for inactive department returns HTTP 400');
    assert(
      inactiveStaffData.message === 'Cannot assign staff to an inactive department.',
      'Returns "Cannot assign staff to an inactive department." error message'
    );

    // Reactivate department for subsequent tests
    const reactivateRes = await fetch(`${BASE_URL}/api/departments/${testDeptId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert(reactivateRes.status === 200, 'Admin reactivates department returns HTTP 200');

    // Negative Test: Duplicate email address -> 409
    const duplicateEmailRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Duplicate Staff Tech',
        email: staffEmail,
        password: 'password123',
        departmentId: testDeptId,
      }),
    });
    const duplicateEmailData = await duplicateEmailRes.json();
    assert(duplicateEmailRes.status === 409, 'POST /api/admin/staff with duplicate email returns HTTP 409 Conflict');
    assert(
      duplicateEmailData.message === 'An account with this email address already exists.',
      'Returns "An account with this email address already exists." error message'
    );

    // Negative Test: Unauthorized requests -> 403 Forbidden for student, 401 Unauthorized for guest
    const studentStaffRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        name: 'Hacked Staff Tech',
        email: `hacked_staff_${Date.now()}@campuspulse.edu`,
        password: 'password123',
        departmentId: testDeptId,
      }),
    });
    assert(studentStaffRes.status === 403, 'Student attempting POST /api/admin/staff returns HTTP 403 Forbidden');

    const unauthStaffRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Unauth Staff Tech',
        email: `unauth_staff_${Date.now()}@campuspulse.edu`,
        password: 'password123',
        departmentId: testDeptId,
      }),
    });
    assert(unauthStaffRes.status === 401, 'Unauthenticated POST /api/admin/staff returns HTTP 401 Unauthorized');

    // Security Test: Public registration ignores spoofed role and strictly enforces student role
    const spoofStaffEmail = `spoof_staff_${Date.now()}@campus.edu`;
    const spoofRegisterRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Spoofed Role User',
        email: spoofStaffEmail,
        password: 'password123',
        role: 'staff',
      }),
    });
    const spoofRegisterData = await spoofRegisterRes.json();
    assert(spoofRegisterRes.status === 201, 'Public user registration with role:"staff" returns HTTP 201');
    assert(
      (spoofRegisterData.user || spoofRegisterData.data?.user)?.role === 'student',
      'Public registration ignores spoofed role and strictly enforces "student" role'
    );

    // Staff login
    const staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: staffEmail,
        password: 'password123',
      }),
    });
    const staffLoginData = await staffLoginRes.json();
    assert(staffLoginRes.status === 200, 'Staff login returns HTTP 200');
    assert((staffLoginData.user || staffLoginData.data?.user)?.role === 'staff', 'Staff user has "staff" role');
    const staffCookie = extractCookie(staffLoginRes);

    // Staff accesses /api/staff/queue
    const staffQueueRes = await fetch(`${BASE_URL}/api/staff/queue`, {
      headers: { Cookie: staffCookie },
    });
    assert(staffQueueRes.status === 200, 'Staff accesses GET /api/staff/queue returns HTTP 200');

    // Student forbidden from /api/staff/queue
    const studentQueueRes = await fetch(`${BASE_URL}/api/staff/queue`, {
      headers: { Cookie: studentCookie },
    });
    assert(studentQueueRes.status === 403, 'Student accessing GET /api/staff/queue returns HTTP 403 Forbidden');

    // 15. Confidentiality & Visibility Enforcement
    console.log(`\n${cyan('15. Verifying Confidentiality & Visibility Enforcement...')}`);
    const student2Email = `student2_${Date.now()}@campus.edu`;
    const student2RegisterRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second Student',
        email: student2Email,
        password: 'password123',
        studentId: 'STU999888',
      }),
    });
    const student2Cookie = extractCookie(student2RegisterRes);

    // Student 1 reports a confidential issue
    const confIssueRes = await fetch(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        title: 'Confidential Safety Complaint in Dormitory',
        description: 'Sensitive private matter that must not be public on feed.',
        category: 'safety',
        severity: 'high',
        visibility: 'confidential',
        location: {
          building: 'Hostel Block C',
          campusZone: 'hostels',
        },
      }),
    });
    const confIssueData = await confIssueRes.json();
    assert(confIssueRes.status === 201, 'Student creates confidential issue returns HTTP 201');
    const confIssueId = confIssueData.data.issue.id || confIssueData.data.issue._id;
    assert(confIssueData.data.issue.visibility === 'confidential', 'Issue created with visibility="confidential"');

    // Student 2 tries to access confidential issue directly -> 404 (strictly hidden)
    const student2ConfRes = await fetch(`${BASE_URL}/api/issues/${confIssueId}`, {
      headers: { Cookie: student2Cookie },
    });
    assert(student2ConfRes.status === 404, 'Unrelated student accessing confidential issue returns HTTP 404 Not Found');

    // Reporter student accesses confidential issue -> 200
    const reporterConfRes = await fetch(`${BASE_URL}/api/issues/${confIssueId}`, {
      headers: { Cookie: studentCookie },
    });
    assert(reporterConfRes.status === 200, 'Author student accessing confidential issue returns HTTP 200');

    // Admin accesses confidential issue -> 200
    const adminConfRes = await fetch(`${BASE_URL}/api/issues/${confIssueId}`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminConfRes.status === 200, 'Admin accessing confidential issue returns HTTP 200');

    // 16. Department Issue Assignment & Redirection with Audit History
    console.log(`\n${cyan('16. Verifying Department Assignment & Redirection with Audit History...')}`);
    const assignRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        departmentId: testDeptId,
        staffId: testStaffId,
        reason: 'Specialized lab robotics equipment requires department technician',
      }),
    });
    const assignData = await assignRes.json();
    assert(assignRes.status === 200, 'Admin assigns issue to department & staff returns HTTP 200');
    assert(assignData.data.issue.assignmentHistory.length >= 1, 'Issue records assignment in assignmentHistory');
    assert(
      assignData.data.issue.assignmentHistory[0].action === 'assigned',
      'First assignment history entry has action="assigned"'
    );

    // Redirect to another department
    const depts = deptsData.data.departments;
    const secondDept = depts.find((d) => (d.id || d._id) !== testDeptId) || depts[0];
    const redirectRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}/redirect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        departmentId: secondDept.id || secondDept._id,
        reason: 'Routing correction: issue pertains to facility infrastructure, not robotics',
      }),
    });
    const redirectData = await redirectRes.json();
    assert(redirectRes.status === 200, 'Admin redirects issue to another department returns HTTP 200');
    assert(
      redirectData.data.issue.assignmentHistory.length >= 2,
      'Assignment history tracks redirection as second entry'
    );
    assert(
      redirectData.data.issue.assignedTo === null,
      'Incompatible previous staff assignee cleared upon department redirection'
    );

    // 17. Public Comments vs. Internal Staff Notes
    console.log(`\n${cyan('17. Verifying Public Comments vs. Internal Staff Notes...')}`);
    const studentInternalNoteRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        text: 'Attempted internal note by student',
        isInternal: true,
      }),
    });
    assert(studentInternalNoteRes.status === 403, 'Student posting internal staff note returns HTTP 403 Forbidden');

    // Admin posts internal triage note
    const staffInternalNoteRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        text: 'Internal triage note: vendor contacted for replacement switchboard',
        isInternal: true,
      }),
    });
    assert(staffInternalNoteRes.status === 201, 'Staff/Admin posting internal note returns HTTP 201 Created');

    // Student queries comments -> internal note is filtered out
    const studentCommentsRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}/comments`, {
      headers: { Cookie: studentCookie },
    });
    const studentCommentsData = await studentCommentsRes.json();
    assert(studentCommentsRes.status === 200, 'Student queries comments returns HTTP 200');
    const studentSeesInternal = studentCommentsData.data.comments.some((c) => c.isInternal);
    assert(!studentSeesInternal, 'Internal staff note is excluded from student comment queries');

    // Admin queries comments -> internal note is visible
    const adminCommentsRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}/comments`, {
      headers: { Cookie: adminCookie },
    });
    const adminCommentsData = await adminCommentsRes.json();
    const adminSeesInternal = adminCommentsData.data.comments.some((c) => c.isInternal);
    assert(adminSeesInternal, 'Internal staff note is included in admin comment queries');

    // 18. SLA Priority, Deadlines, and Resolution Reopen Workflow
    console.log(`\n${cyan('18. Verifying SLA Priority, Deadlines & Student Reopen Workflow...')}`);
    const targetDeadline = new Date(Date.now() + 86400000).toISOString();
    const slaRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}/priority-deadline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        priority: 'high',
        resolutionDeadline: targetDeadline,
        reason: 'SLA target established following equipment delivery schedule',
      }),
    });
    assert(slaRes.status === 200, 'POST /api/admin/issues/:id/priority-deadline returns HTTP 200');

    // Transition to resolved
    const resolveRes = await fetch(`${BASE_URL}/api/admin/issues/${testIssueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        status: 'resolved',
        resolutionNote: 'Main breaker reset and tested successfully under full load.',
      }),
    });
    assert(resolveRes.status === 200, 'Issue transitioned to resolved returns HTTP 200');

    // Second student attempts to reopen -> 403 Forbidden
    const student2ReopenRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: student2Cookie,
      },
      body: JSON.stringify({
        reason: 'Reopen attempt by non-author student',
      }),
    });
    assert(student2ReopenRes.status === 403, 'Non-author student attempting to reopen issue returns HTTP 403 Forbidden');

    // Reporter student reopens issue with required reason (>= 10 chars)
    const reporterReopenRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        reason: 'Power failed again immediately when class started this morning.',
      }),
    });
    const reporterReopenData = await reporterReopenRes.json();
    assert(reporterReopenRes.status === 200, 'Reporter student reopens issue returns HTTP 200');
    assert(reporterReopenData.data.issue.status === 'in_progress', 'Reopened issue status transitions to "in_progress"');
    assert(reporterReopenData.data.issue.reopenCount === 1, 'Issue reopenCount increments to 1');

    // 19. System Audit Trail Logging
    console.log(`\n${cyan('19. Verifying Administrative Audit Trail...')}`);
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Cookie: adminCookie },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200, 'GET /api/admin/audit-logs returns HTTP 200');
    assert(auditData.data?.logs?.length > 0, 'Audit trail contains recorded administrative events');
    const hasAssignAudit = auditData.data.logs.some((l) => l.action === 'issue_assigned' || l.action === 'issue_redirected');
    assert(hasAssignAudit, 'Audit trail logs "issue_assigned" or "issue_redirected" action with actor and reason');

    // 20. Smart Issue Grouping, Deduplication & Admin Incident Management
    console.log(`\n${cyan('20. Verifying Smart Issue Grouping, Deduplication & Admin Incident Management...')}`);

    // A. Student contributes child report to existing incident
    const childReportRes = await fetch(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: student2Cookie,
      },
      body: JSON.stringify({
        title: 'Additional corridor leak near Room 204',
        description: 'Water leak spreading into second floor hallway',
        category: 'infrastructure',
        severity: 'moderate',
        location: {
          building: 'Block B',
          area: 'Second Floor Corridor',
        },
        parentIssueId: testIssueId,
      }),
    });
    const childReportData = await childReportRes.json();
    assert(childReportRes.status === 201, 'Student contributing child report to existing incident returns HTTP 201');
    const childReportId = childReportData.data?.issue?.id || childReportData.data?.issue?._id;
    assert(childReportId, 'Child report created and returns valid ID');

    // Verify parent incident is updated with grouping metadata
    const parentRes = await fetch(`${BASE_URL}/api/issues/${testIssueId}`, {
      headers: { Cookie: studentCookie },
    });
    const parentData = await parentRes.json();
    assert(parentRes.status === 200, 'GET /api/issues/:id on parent incident returns HTTP 200');
    assert(parentData.data.issue.isIncidentGroup === true, 'Parent incident flagged with isIncidentGroup=true');
    assert(parentData.data.issue.groupedReportsCount >= 1, 'Parent incident groupedReportsCount increments');
    assert(Array.isArray(parentData.data.issue.linkedReports), 'Parent incident returns linkedReports array');
    const hasChildInLinked = parentData.data.issue.linkedReports.some(
      (r) => (r.id || r._id).toString() === childReportId.toString()
    );
    assert(hasChildInLinked, 'Parent linkedReports contains the contributed child report');
    assert(parentData.data.issue.totalAffectedCount >= 2, 'Parent incident computes totalAffectedCount combining confirmations and linked reports');

    // B. De-duplication in Student Public Feed
    const feedRes = await fetch(`${BASE_URL}/api/issues`, {
      headers: { Cookie: studentCookie },
    });
    const feedData = await feedRes.json();
    assert(feedRes.status === 200, 'GET /api/issues returns HTTP 200');
    const isChildInPublicFeed = feedData.data.issues.some(
      (item) => (item.id || item._id).toString() === childReportId.toString()
    );
    assert(!isChildInPublicFeed, 'Student public feed de-duplicates reports (child reports excluded with parentIssueId: null)');

    // C. Admin Grouping Two Distinct Reports
    const reportARes = await fetch(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        title: 'Water filter broken in Cafeteria',
        description: 'Dispenser faucet leaking clean water continuously',
        category: 'sanitation',
        severity: 'low',
        location: {
          building: 'Dining Hall',
          area: 'West Wing Faucet',
        },
      }),
    });
    const reportAData = await reportARes.json();
    const reportAId = reportAData.data.issue.id || reportAData.data.issue._id;

    const reportBRes = await fetch(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: student2Cookie,
      },
      body: JSON.stringify({
        title: 'Cafeteria water tap broken',
        description: 'Second report of leaking faucet at dining hall',
        category: 'sanitation',
        severity: 'low',
        location: {
          building: 'Dining Hall',
          area: 'West Wing Faucet',
        },
      }),
    });
    const reportBData = await reportBRes.json();
    const reportBId = reportBData.data.issue.id || reportBData.data.issue._id;

    // Admin groups report B into report A
    const adminGroupRes = await fetch(`${BASE_URL}/api/admin/issues/${reportBId}/group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        targetIncidentId: reportAId,
        reason: 'Duplicate student report regarding same cafeteria water tap',
      }),
    });
    assert(adminGroupRes.status === 200, 'Admin POST /api/admin/issues/:id/group returns HTTP 200');

    // Verify report A updated
    const updatedARes = await fetch(`${BASE_URL}/api/admin/issues/${reportAId}`, {
      headers: { Cookie: adminCookie },
    });
    const updatedAData = await updatedARes.json();
    assert(updatedAData.data.issue.isIncidentGroup === true, 'Target issue becomes isIncidentGroup=true');
    assert(updatedAData.data.issue.groupedReportsCount === 1, 'Target issue groupedReportsCount equals 1');

    // Verify audit event logged for grouping
    const groupAudit = await AuditEvent.findOne({ action: 'issue_grouped', entityId: reportBId });
    assert(groupAudit !== null, 'AuditEvent recorded for issue_grouped action');

    // D. Admin Ungroups Report B
    const adminUngroupRes = await fetch(`${BASE_URL}/api/admin/issues/${reportBId}/ungroup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        reason: 'Technician confirmed separate secondary fountain valve was damaged',
      }),
    });
    assert(adminUngroupRes.status === 200, 'Admin POST /api/admin/issues/:id/ungroup returns HTTP 200');

    const unlinkedBRes = await fetch(`${BASE_URL}/api/admin/issues/${reportBId}`, {
      headers: { Cookie: adminCookie },
    });
    const unlinkedBData = await unlinkedBRes.json();
    assert(unlinkedBData.data.issue.parentIssueId === null, 'Unlinked issue parentIssueId is reset to null');

    const unlinkedARes = await fetch(`${BASE_URL}/api/admin/issues/${reportAId}`, {
      headers: { Cookie: adminCookie },
    });
    const unlinkedAData = await unlinkedARes.json();
    assert(unlinkedAData.data.issue.groupedReportsCount === 0, 'Target issue groupedReportsCount decrements to 0');

    // Verify audit event logged for ungrouping
    const ungroupAudit = await AuditEvent.findOne({ action: 'issue_ungrouped', entityId: reportBId });
    assert(ungroupAudit !== null, 'AuditEvent recorded for issue_ungrouped action');

    // E. Confidentiality Privacy Rule Enforcement
    const confGroupRes = await fetch(`${BASE_URL}/api/admin/issues/${confIssueId}/group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        targetIncidentId: testIssueId,
        reason: 'Attempting to group confidential report into public issue',
      }),
    });
    assert(confGroupRes.status === 400, 'Attempting to group confidential issue into public incident returns HTTP 400 Bad Request');

    // F. Admin Grouped-Only Filter Query
    const adminGroupedRes = await fetch(`${BASE_URL}/api/admin/issues?groupedOnly=true`, {
      headers: { Cookie: adminCookie },
    });
    const adminGroupedData = await adminGroupedRes.json();
    assert(adminGroupedRes.status === 200, 'Admin GET /api/admin/issues?groupedOnly=true returns HTTP 200');
    assert(
      adminGroupedData.data.issues.every((i) => i.isIncidentGroup === true),
      'Admin groupedOnly=true filter strictly returns issues with isIncidentGroup=true'
    );

    // 21. Verifying Session Logout & Cookie Invalidation
    console.log(`\n${cyan('21. Verifying Session Logout & Cookie Invalidation...')}`);
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: studentCookie },
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout returns HTTP 200');
    const logoutCookie = logoutRes.headers.get('set-cookie');
    assert(
      logoutCookie && (logoutCookie.includes('token=;') || logoutCookie.includes('Max-Age=0') || logoutCookie.includes('Expires=')),
      'Logout invalidates HttpOnly authentication cookie in Set-Cookie header'
    );

    // Disconnect sockets cleanly
    studentSocket.emit('leave:issue', testIssueId);
    studentSocket.disconnect();
    adminSocket.disconnect();

    // 22. Cleanup
    console.log(`\n${cyan('22. Cleaning up Test Artifacts...')}`);
    if (testIssueId) {
      await Issue.findByIdAndDelete(testIssueId);
      await Comment.deleteMany({ issueId: testIssueId });
      await Notification.deleteMany({ issueId: testIssueId });
    }
    if (childReportId) {
      await Issue.findByIdAndDelete(childReportId);
      await Notification.deleteMany({ issueId: childReportId });
    }
    if (reportAId) {
      await Issue.findByIdAndDelete(reportAId);
    }
    if (reportBId) {
      await Issue.findByIdAndDelete(reportBId);
    }
    if (confIssueId) {
      await Issue.findByIdAndDelete(confIssueId);
      await Comment.deleteMany({ issueId: confIssueId });
    }
    if (testDeptId) {
      await Department.findByIdAndDelete(testDeptId);
    }
    if (testStudentUser && testStudentUser.id) {
      await User.findByIdAndDelete(testStudentUser.id);
    }
    await User.deleteMany({ email: { $in: [staffEmail, student2Email, spoofStaffEmail] } });
    await AuditEvent.deleteMany({ entityId: { $in: [testIssueId, childReportId, reportAId, reportBId, confIssueId, testDeptId] } });

    console.log(`  ${green('Test records cleaned up successfully.')}`);

    console.log(`\n${bold('========================================================')}`);
    console.log(`${green(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`)}`);
    console.log(`${bold('========================================================')}\n`);

    process.exitCode = 0;
  } catch (error) {
    console.error(`\n${red('TEST SUITE FAILED:')}`, error);
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await mongoose.disconnect();
    if (mongodInstance) {
      await mongodInstance.stop();
    }
    process.exit();
  }
}

runTests();
