import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from './auth';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { token } = useAdminAuth();
  const loc = useLocation();
  if (!token) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
