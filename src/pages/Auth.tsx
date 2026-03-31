import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, ArrowRight, KeyRound } from "lucide-react";
import { SewingMachine } from "@/components/icons/SewingMachine";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getRememberMe } from "@/lib/auth-storage";

import { getPasswordResetRedirectUrl } from "@/lib/capacitor";
import logoSvg from "@/assets/logo.svg";
import i18n from "@/i18n/config";

const strongPassword = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number");

const passwordSchema = z.object({
  password: strongPassword,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: strongPassword,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const { signIn, signUp, signOut, user, profile, roles, hasRole, isAdminOrHigher, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();


  // Force English language on Auth page since it doesn't support translations
  useEffect(() => {
    if (i18n.language !== 'en') {
      i18n.changeLanguage('en');
    }
    document.documentElement.lang = 'en';

    return () => {
      const savedLanguage = localStorage.getItem('app-language');
      if (savedLanguage && savedLanguage !== 'en') {
        i18n.changeLanguage(savedLanguage);
      }
    };
  }, []);

  const isForcedPasswordReset =
    typeof window !== "undefined" && sessionStorage.getItem("pp_force_password_reset") === "1";

  // Password reset mode state - check synchronously from URL on mount
  const getIsRecoveryMode = () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    return !!(accessToken && type === 'recovery');
  };
  
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(getIsRecoveryMode);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordErrors, setResetPasswordErrors] = useState<Record<string, string>>({});

  // Also listen for PASSWORD_RECOVERY event from Supabase auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordResetMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Redirect if already logged in (but not if in password reset mode)
  useEffect(() => {
    // Important: wait until roles are loaded, otherwise cutting users can be mis-routed.
    if (authLoading) return;

    // If we are forcing a password reset, never auto-route away from /auth.
    if (isForcedPasswordReset) return;

    if (user && !isPasswordResetMode) {
      if (profile?.factory_id) {
        // User has factory access - redirect to appropriate page
        // Check for cutting role first
        if (hasRole("cutting")) {
          navigate("/cutting/submissions", { replace: true });
          return;
        }
        // Check for storage role
        if (hasRole("storage")) {
          navigate("/storage", { replace: true });
          return;
        }

        // Admins and owners always go to dashboard
        if (isAdminOrHigher()) {
          navigate("/dashboard", { replace: true });
          return;
        }

        // Standalone sewing role
        if (hasRole("sewing")) {
          navigate("/sewing/morning-targets", { replace: true });
          return;
        }

        // Standalone finishing role
        if (hasRole("finishing")) {
          navigate("/finishing/daily-target", { replace: true });
          return;
        }

        // Legacy: finishing department workers
        if (profile.department === "finishing") {
          navigate("/finishing/daily-target", { replace: true });
          return;
        }

        // Legacy: sewing department workers
        if (hasRole("worker")) {
          navigate("/sewing/morning-targets", { replace: true });
          return;
        }

        // No recognized role — go to index which shows an informative message
        navigate("/", { replace: true });
      } else if (profile && !profile.is_active) {
        // User account is deactivated
        toast.error("Account Deactivated", { description: "Your account has been deactivated. Please contact your administrator." });
        signOut().catch(console.error);
      } else if (!profile || profile.factory_id === null) {
        // User without profile or without factory - redirect to subscription
        navigate("/subscription", { replace: true });
      }
    }
  }, [authLoading, user, profile, navigate, isPasswordResetMode, hasRole, isAdminOrHigher, isForcedPasswordReset, signOut]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(getRememberMe);

  // Signup form state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  // Forgot password state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // Deep-links:
  // - /auth?forgot=1 => open reset dialog
  // - /auth?reset=success => show success toast after password update + sign out
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldOpenForgot = params.get("forgot") === "1";
    const resetSuccess = params.get("reset") === "success";

    if (resetSuccess) {
      toast.success("Password updated", { description: "Please sign in with your new password." });
    }

    if (shouldOpenForgot) {
      setActiveTab("login");
      setForgotPasswordOpen(true);
    }

    if (resetSuccess || shouldOpenForgot) {
      navigate("/auth", { replace: true });
    }
  }, [location.search, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail || !z.string().email().safeParse(forgotPasswordEmail).success) {
      toast.error("Invalid email", { description: "Please enter a valid email address." });
      return;
    }

    setForgotPasswordLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    setForgotPasswordLoading(false);

    if (error) {
      toast.error("Error", { description: error.message });
    } else {
      toast.success("Check your email", { description: "We've sent you a password reset link." });
      setForgotPasswordOpen(false);
      setForgotPasswordEmail("");
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordErrors({});

    try {
      passwordSchema.parse({ password: newPassword, confirmPassword: confirmNewPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) errors[e.path[0] as string] = e.message;
        });
        setResetPasswordErrors(errors);
        return;
      }
    }

    setResetPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setResetPasswordLoading(false);

    if (error) {
      toast.error("Error updating password", { description: error.message });
    } else {
      toast.success("Password updated!", { description: "Your password has been successfully updated." });
      setIsPasswordResetMode(false);
      setNewPassword("");
      setConfirmNewPassword("");
      window.history.replaceState(null, '', window.location.pathname);
      // Let the redirect useEffect choose the correct landing page
      navigate("/", { replace: true });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});

    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) errors[e.path[0] as string] = e.message;
        });
        setLoginErrors(errors);
        return;
      }
    }

    setIsLoading(true);

    const { error } = await signIn(loginEmail, loginPassword, rememberMe);
    setIsLoading(false);

    if (error) {
      toast.error("Login failed", {
        description: error.message === "Invalid login credentials"
          ? "Invalid email or password. Please try again."
          : error.message,
      });
    } else {
      toast.success("Welcome back!", { description: "You have successfully logged in." });
      // Navigation will happen via the redirect useEffect once profile/roles are loaded
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});

    try {
      signupSchema.parse({
        fullName: signupName,
        email: signupEmail,
        password: signupPassword,
        confirmPassword: signupConfirmPassword,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) errors[e.path[0] as string] = e.message;
        });
        setSignupErrors(errors);
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("Account exists", { description: "An account with this email already exists. Please log in instead." });
        setActiveTab("login");
        setLoginEmail(signupEmail);
      } else {
        toast.error("Signup failed", { description: error.message });
      }
    } else {
      toast.success("Account created!", { description: "Welcome to ProductionPortal." });
      // New users go to subscription page (native shows AccountNotActive)
      navigate("/subscription");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      {/* Hero section */}
      <div className="gradient-industrial text-sidebar-foreground py-12 px-4">
        <div className="container mx-auto max-w-6xl flex flex-col items-center text-center">
          <div className="flex items-center gap-4 mb-4">
            <img 
              src={logoSvg} 
              alt="ProductionPortal" 
              className="h-16 w-16 rounded-xl"
            />
            <div className="text-left">
              <h1 className="text-2xl font-bold">ProductionPortal</h1>
              <p className="text-sm text-sidebar-foreground/60">Powered by WovenTex</p>
            </div>
          </div>
          <p className="text-lg text-sidebar-foreground/80 max-w-xl">
            Streamline your garment factory operations with real-time production tracking,
            intelligent insights, and seamless team collaboration.
          </p>
        </div>
      </div>

      {/* Auth card */}
      <div className="flex-1 flex items-start justify-center -mt-6 px-4 pb-12">
        <Card className="w-full max-w-md shadow-xl animate-fade-in">
          {isPasswordResetMode ? (
            <>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <KeyRound className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Set New Password</CardTitle>
                <CardDescription>
                  Enter your new password below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      name="new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Enter your password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11"
                      disabled={resetPasswordLoading}
                    />
                    {resetPasswordErrors.password && (
                      <p className="text-sm text-destructive">{resetPasswordErrors.password}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                    <Input
                      id="confirm-new-password"
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Confirm your password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="h-11"
                      disabled={resetPasswordLoading}
                    />
                    {resetPasswordErrors.confirmPassword && (
                      <p className="text-sm text-destructive">{resetPasswordErrors.confirmPassword}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={resetPasswordLoading}>
                    {resetPasswordLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setIsPasswordResetMode(false);
                      window.history.replaceState(null, '', window.location.pathname);
                    }}
                  >
                    Back to Login
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Get Started</CardTitle>
                <CardDescription>
                  Sign in to your account or create a new one
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input
                          id="login-email"
                          name="email"
                          type="email"
                          autoComplete="username"
                          placeholder="you@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="h-11"
                          disabled={isLoading}
                        />
                        {loginErrors.email && (
                          <p className="text-sm text-destructive">{loginErrors.email}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Password</Label>
                        <Input
                          id="login-password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="h-11"
                          disabled={isLoading}
                        />
                        {loginErrors.password && (
                          <p className="text-sm text-destructive">{loginErrors.password}</p>
                        )}
                      </div>

                      {/* Remember me + Forgot password row */}
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="remember-me"
                              checked={rememberMe}
                              onCheckedChange={(checked) => setRememberMe(checked === true)}
                              disabled={isLoading}
                            />
                            <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                              Remember me
                            </Label>
                          </div>
                        </div>

                        <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                          <DialogTrigger asChild>
                            <Button variant="link" type="button" className="px-0 h-auto text-sm text-muted-foreground hover:text-primary">
                              Forgot password?
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reset Password</DialogTitle>
                              <DialogDescription>
                                Enter your email address and we'll send you a link to reset your password.
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <Label htmlFor="forgot-email">Email</Label>
                                <Input
                                  id="forgot-email"
                                  name="email"
                                  type="email"
                                  autoComplete="username"
                                  placeholder="you@example.com"
                                  value={forgotPasswordEmail}
                                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                  className="h-11"
                                  disabled={forgotPasswordLoading}
                                />
                              </div>
                              <Button type="submit" className="w-full h-11" disabled={forgotPasswordLoading}>
                                {forgotPasswordLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Send Reset Link"
                                )}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <Button type="submit" className="w-full h-11" disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <Input
                          id="signup-name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          placeholder="John Doe"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          className="h-11"
                          disabled={isLoading}
                        />
                        {signupErrors.fullName && (
                          <p className="text-sm text-destructive">{signupErrors.fullName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          name="email"
                          type="email"
                          autoComplete="username"
                          placeholder="you@example.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="h-11"
                          disabled={isLoading}
                        />
                        {signupErrors.email && (
                          <p className="text-sm text-destructive">{signupErrors.email}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          name="new-password"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Enter your password"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="h-11"
                          disabled={isLoading}
                        />
                        {signupErrors.password && (
                          <p className="text-sm text-destructive">{signupErrors.password}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm">Confirm Password</Label>
                        <Input
                          id="signup-confirm"
                          name="confirm-password"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Confirm your password"
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className="h-11"
                          disabled={isLoading}
                        />
                        {signupErrors.confirmPassword && (
                          <p className="text-sm text-destructive">{signupErrors.confirmPassword}</p>
                        )}
                      </div>
                      <Button type="submit" className="w-full h-11" disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Create Account
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="mt-6 pt-6 border-t">
                  <p className="text-center text-sm text-muted-foreground">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Features section */}
      <div className="bg-muted/50 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-xl font-semibold text-center mb-8">
            Trusted by Garment Factories Worldwide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center p-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <SewingMachine className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Real-time Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Monitor production output, blockers, and quality metrics in real-time.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Smart Insights</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered analytics to identify bottlenecks and optimize performance.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Mobile First</h3>
              <p className="text-sm text-muted-foreground">
                Optimized for factory floor use on any device, even low-end phones.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
