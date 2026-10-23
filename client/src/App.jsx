import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute.jsx';

import FeedPage from './pages/FeedPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import NewIssuePage from './pages/NewIssuePage.jsx';
import IssueDetailsPage from './pages/IssueDetailsPage.jsx';
import MyReportsPage from './pages/MyReportsPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            {/* Public feeds & details */}
            <Route index element={<FeedPage />} />
            <Route path="issues/:id" element={<IssueDetailsPage />} />

            {/* Guest only routes (redirect to / if already logged in) */}
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

            {/* Authenticated user routes */}
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

            {/* Admin role protected route */}
            <Route
              path="admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback 404 handler */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
