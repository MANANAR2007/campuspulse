import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

// Layouts
import AppLayout from './components/layout/AppLayout.jsx';
import AdminLayout from './components/layout/AdminLayout.jsx';
import StaffLayout from './components/layout/StaffLayout.jsx';

// Guards
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute.jsx';
import AdminRouteGuard from './components/auth/AdminRouteGuard.jsx';
import StaffRouteGuard from './components/auth/StaffRouteGuard.jsx';
import StudentRouteGuard from './components/auth/StudentRouteGuard.jsx';

// Pages
import FeedPage from './pages/FeedPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import NewIssuePage from './pages/NewIssuePage.jsx';
import IssueDetailsPage from './pages/IssueDetailsPage.jsx';
import MyReportsPage from './pages/MyReportsPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import AdminIssueDetailsPage from './pages/AdminIssueDetailsPage.jsx';
import StaffDashboardPage from './pages/StaffDashboardPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <Routes>
          {/* Guest Only Routes (Redirect if already authenticated based on role) */}
          <Route
            path="login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />

          {/* Admin Mode Routes (Strict Admin Layout & Route Guards) */}
          <Route
            path="admin"
            element={
              <AdminRouteGuard>
                <AdminLayout />
              </AdminRouteGuard>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="issues/:id" element={<AdminIssueDetailsPage />} />
          </Route>

          {/* Department Staff Operations Routes */}
          <Route
            path="staff"
            element={
              <StaffRouteGuard>
                <StaffLayout />
              </StaffRouteGuard>
            }
          >
            <Route index element={<StaffDashboardPage />} />
          </Route>

          {/* Student Mode Routes (Protected by StudentRouteGuard: Admins are redirected to /admin) */}
          <Route
            path="/"
            element={
              <StudentRouteGuard>
                <AppLayout />
              </StudentRouteGuard>
            }
          >
            {/* Student Public Feed & Details */}
            <Route index element={<FeedPage />} />
            <Route path="issues/:id" element={<IssueDetailsPage />} />

            {/* Student Authenticated Actions */}
            <Route
              path="issues/new"
              element={
                <ProtectedRoute>
                  <NewIssuePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-reports"
              element={
                <ProtectedRoute>
                  <MyReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback 404 handler */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ToastProvider>
    </SocketProvider>
  </AuthProvider>
  );
}
