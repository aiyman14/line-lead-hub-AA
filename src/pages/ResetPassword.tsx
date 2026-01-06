import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { KeyRound, Loader2, Mail } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoSvg from "@/assets/logo.svg";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const hashParams = useMemo(() => {
    const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    return new URLSearchParams(hash);
  }, [location.hash]);

  const searchParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);

  const recoveryType = hashParams.get("type") ?? searchParams.get("type");
  const hasRecoverySignal = recoveryType === "recovery";

  const linkError =
    hashParams.get("error") ||
    hashParams.get("error_code") ||
    hashParams.get("error_description") ||
    searchParams.get("error") ||
    searchParams.get("error_code") ||
    searchParams.get("error_description");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [checkingLink, setCheckingLink] = useState(true);
  const [isInvalidLink, setIsInvalidLink] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const run = async () => {
      // Mark that we are in a forced reset flow so the rest of the app is blocked.
      if (typeof window !== "undefined" && hasRecoverySignal) {
        sessionStorage.setItem("pp_force_password_reset", "1");
      }

      if (linkError) {
        if (!cancelled) {
          setIsInvalidLink(true);
          setCheckingLink(false);
        }
        return;
      }

      // In some password-recovery flows, tokens may not appear in the URL hash.
      // Give the auth client a moment to establish the recovery session.
      if (hasRecoverySignal) {
        await sleep(350);
      }

      const getSessionOnce = async () => {
        const { data } = await supabase.auth.getSession();
        return data.session;
      };

      let session = await getSessionOnce();
      if (!session && hasRecoverySignal) {
        await sleep(650);
        session = await getSessionOnce();
      }

      if (!cancelled) {
        // Valid if we have a recovery signal OR a session exists (meaning user arrived via a verified link).
        const isValid = hasRecoverySignal || !!session;
        setIsInvalidLink(!isValid);
        setCheckingLink(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [hasRecoverySignal, linkError]);

  const requestNewLink = () => {
    // Allow user to request a new reset email.
    navigate("/auth?forgot=1", { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      resetSchema.parse({ password, confirmPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const next: Record<string, string> = {};
        err.errors.forEach((issue) => {
          if (issue.path[0]) next[issue.path[0] as string] = issue.message;
        });
        setErrors(next);
        return;
      }
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      // Invalid/expired links often end up here because there is no valid session.
      setIsInvalidLink(true);
      toast({
        variant: "destructive",
        title: "Unable to reset password",
        description: "This reset link is invalid or expired. Please request a new one.",
      });
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pp_force_password_reset");
    }

    // Security: sign out after reset so the user must re-authenticate with the new password.
    await supabase.auth.signOut();

    toast({
      title: "Password updated",
      description: "Please sign in with your new password.",
    });

    // Clear hash to avoid re-entering recovery mode.
    window.history.replaceState(null, "", window.location.pathname);

    navigate("/auth?reset=success", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="gradient-industrial text-sidebar-foreground py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoSvg} alt="Production Portal" className="h-12 w-12 rounded-xl" />
            <h1 className="text-2xl font-bold">Production Portal</h1>
          </div>
          <p className="text-lg text-sidebar-foreground/80 max-w-xl">
            Secure password reset.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center -mt-6 px-4 pb-12">
        <Card className="w-full max-w-md shadow-xl animate-fade-in">
          {checkingLink ? (
            <>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Validating link…</CardTitle>
                <CardDescription>Hang tight while we verify your reset link.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="ghost" className="w-full" onClick={requestNewLink}>
                  Request a new link
                </Button>
              </CardContent>
            </>
          ) : isInvalidLink ? (
            <>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Reset link expired</CardTitle>
                <CardDescription>
                  This password reset link is invalid or has expired. Request a new reset email to continue.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full h-11" onClick={requestNewLink}>
                  Request new reset link
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                  Back to Login
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <KeyRound className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Set New Password</CardTitle>
                <CardDescription>Enter your new password below</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11"
                      disabled={submitting}
                    />
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11"
                      disabled={submitting}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                  </Button>

                  <Button type="button" variant="ghost" className="w-full" onClick={requestNewLink}>
                    Need a new link?
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
