import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LegacyMySubmissionsRedirect() {
  const { user, profile, loading, hasRole, isAdminOrHigher } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!profile) return null;

  if (!profile.factory_id) {
    return <Navigate to="/subscription" replace />;
  }

  if (hasRole("cutting")) {
    return <Navigate to="/cutting/submissions" replace />;
  }

  if (hasRole("storage")) {
    return <Navigate to="/storage" replace />;
  }

  // Admins and owners always go to dashboard
  if (isAdminOrHigher()) {
    return <Navigate to="/dashboard" replace />;
  }

  // Standalone sewing role
  if (hasRole("sewing")) {
    return <Navigate to="/sewing/my-submissions" replace />;
  }

  // Standalone finishing role
  if (hasRole("finishing")) {
    return <Navigate to="/finishing/my-submissions" replace />;
  }

  // Legacy: finishing department workers
  if (profile.department === "finishing") {
    return <Navigate to="/finishing/my-submissions" replace />;
  }

  // Remaining workers go to sewing my-submissions
  return <Navigate to="/sewing/my-submissions" replace />;
}
