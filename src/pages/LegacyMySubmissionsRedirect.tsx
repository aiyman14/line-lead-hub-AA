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

  const isWorker =
    profile.department != null ||
    (hasRole("worker") && !hasRole("supervisor") && !isAdminOrHigher());

  return (
    <Navigate
      to={isWorker ? "/sewing/morning-targets" : "/dashboard"}
      replace
    />
  );
}
