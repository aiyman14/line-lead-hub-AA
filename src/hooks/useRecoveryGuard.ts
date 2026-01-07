// Hook to enforce password recovery flow
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useRecoveryGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    // Check for recovery signal in URL
    const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(location.search);

    const recoveryType = hashParams.get("type") ?? searchParams.get("type");
    const hasRecoverySignal = recoveryType === "recovery";

    // Check session storage for forced reset
    const isForcedReset = sessionStorage.getItem("pp_force_password_reset") === "1";

    if (hasRecoverySignal) {
      sessionStorage.setItem("pp_force_password_reset", "1");
      setIsRecoveryMode(true);
    } else if (isForcedReset) {
      setIsRecoveryMode(true);
    }
  }, [location]);

  // Clear recovery mode after successful password reset
  const clearRecoveryMode = () => {
    sessionStorage.removeItem("pp_force_password_reset");
    setIsRecoveryMode(false);
  };

  // Check if current route is allowed during recovery
  const isAllowedRoute = (pathname: string) => {
    return pathname === "/reset-password" || pathname === "/auth";
  };

  // Redirect to reset password if in recovery mode and on disallowed route
  useEffect(() => {
    if (isRecoveryMode && !isAllowedRoute(location.pathname)) {
      navigate("/reset-password", { replace: true });
    }
  }, [isRecoveryMode, location.pathname, navigate]);

  return { isRecoveryMode, clearRecoveryMode };
}
