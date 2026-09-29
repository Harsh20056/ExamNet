import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../contexts/AuthContext';
import { isRouteAllowedForRole, ROLE_HOME_ROUTES } from '../utils/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: NonNullable<Role>[];
  requireIdentity?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles, 
  requireIdentity = false 
}: ProtectedRouteProps) {
  const { role, loading, identityVerified } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if role is explicitly in allowedRoles list or matches permissions
  if (allowedRoles && !allowedRoles.includes(role)) {
    const home = ROLE_HOME_ROUTES[role] || '/login';
    return <Navigate to={home} replace />;
  }

  if (!isRouteAllowedForRole(role, location.pathname)) {
    const home = ROLE_HOME_ROUTES[role] || '/login';
    return <Navigate to={home} replace />;
  }

  // Identity check required for examiner marking
  if (requireIdentity && !identityVerified) {
    return <Navigate to="/examiner/identity" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
