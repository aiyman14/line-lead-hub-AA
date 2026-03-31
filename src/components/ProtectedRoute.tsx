import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/lib/constants";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Shorthand: only admin/owner roles can access */
  adminOnly?: boolean;
  /** Explicit list of allowed roles. Admin/owner always pass regardless. */
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, adminOnly, allowedRoles }: ProtectedRouteProps) {
  const { isAdminOrHigher, hasRole } = useAuth();

  // Admins and owners always have access to everything
  if (isAdminOrHigher()) return <>{children}</>;

  // Admin-only route and user is not admin → redirect
  if (adminOnly) return <Navigate to="/" replace />;

  // Check explicit allowed roles
  if (allowedRoles && !allowedRoles.some(role => hasRole(role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
