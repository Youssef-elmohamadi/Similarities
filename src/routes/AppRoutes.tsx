import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { QuranSearchPage } from '../pages/QuranSearchPage';
import { MyLibraryPage } from '../pages/MyLibraryPage';
import { CreateCollectionPage } from '../pages/CreateCollectionPage';
import { CollectionDetailsPage } from '../pages/CollectionDetailsPage';
import { EditCollectionPage } from '../pages/EditCollectionPage';
import { SettingsPage } from '../pages/SettingsPage';
import { Loader2 } from 'lucide-react';

const LandingPage = React.lazy(() => import('../pages/LandingPage'));

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
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
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
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
