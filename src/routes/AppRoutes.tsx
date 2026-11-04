import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Loader2 } from 'lucide-react';

const LandingPage = React.lazy(() => import('../pages/LandingPage'));
const LoginPage = React.lazy(() => import('../pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('../pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const QuranSearchPage = React.lazy(() => import('../pages/QuranSearchPage').then(m => ({ default: m.QuranSearchPage })));
const MyLibraryPage = React.lazy(() => import('../pages/MyLibraryPage').then(m => ({ default: m.MyLibraryPage })));
const CreateCollectionPage = React.lazy(() => import('../pages/CreateCollectionPage').then(m => ({ default: m.CreateCollectionPage })));
const CollectionDetailsPage = React.lazy(() => import('../pages/CollectionDetailsPage').then(m => ({ default: m.CollectionDetailsPage })));
const EditCollectionPage = React.lazy(() => import('../pages/EditCollectionPage').then(m => ({ default: m.EditCollectionPage })));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ChatPage = React.lazy(() => import('../pages/ChatPage').then(m => ({ default: m.ChatPage })));

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

const RootRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-emerald-800 animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 text-emerald-800 animate-spin" />
        </div>
      }
    >
      <LandingPage />
    </React.Suspense>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-emerald-800 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-emerald-800 animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root Route: Landing Page for guests, Redirect to Dashboard for authenticated users */}
      <Route path="/" element={<RootRoute />} />

      {/* Public Auth Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Suspense fallback={<RouteLoadingFallback />}>
              <LoginPage />
            </Suspense>
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Suspense fallback={<RouteLoadingFallback />}>
              <RegisterPage />
            </Suspense>
          </PublicRoute>
        }
      />

      {/* Protected Application Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/search" element={<QuranSearchPage />} />
        <Route path="/library" element={<MyLibraryPage />} />
        <Route path="/collections/new" element={<CreateCollectionPage />} />
        <Route path="/collections/:id" element={<CollectionDetailsPage />} />
        <Route path="/collections/:id/edit" element={<EditCollectionPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
