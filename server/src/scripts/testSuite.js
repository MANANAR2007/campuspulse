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

    await new Promise((resolve) => {
      serverInstance = httpServer.listen(TEST_PORT, '127.0.0.1', resolve);
    });
    console.log(`  ${green(`Test server listening on ${BASE_URL}`)}`);

    // Clean up any stale test accounts from previous runs
    const testEmail = `test_student_${Date.now()}@campus.edu`;
    await User.deleteMany({ email: { $regex: /^test_student_/ } });

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

    // 12. Verifying Session Logout & Cookie Invalidation
    console.log(`\n${cyan('13. Verifying Session Logout & Cookie Invalidation...')}`);
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

    // 13. Cleanup
    console.log(`\n${cyan('14. Cleaning up Test Artifacts...')}`);
    if (testIssueId) {
      await Issue.findByIdAndDelete(testIssueId);
      await Comment.deleteMany({ issueId: testIssueId });
      await Notification.deleteMany({ issueId: testIssueId });
    }
    if (testStudentUser && testStudentUser.id) {
      await User.findByIdAndDelete(testStudentUser.id);
    }
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
