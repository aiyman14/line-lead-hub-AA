import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Factory, ArrowRight, KeyRound } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import logoSvg from "@/assets/logo.svg";

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const { signIn, signUp, user, profile, hasRole, isAdminOrHigher, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Password reset mode state
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordErrors, setResetPasswordErrors] = useState<Record<string, string>>({});

  // Check for password reset token in URL hash and via auth state change
  useEffect(() => {
    // Check URL hash for recovery tokens
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'recovery') {
      setIsPasswordResetMode(true);
    }

    // Also listen for PASSWORD_RECOVERY event from Supabase auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordResetMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location]);

  // Redirect if already logged in (but not if in password reset mode)
  useEffect(() => {
    // Important: wait until roles are loaded, otherwise cutting users can be mis-routed.
    if (authLoading) return;

    if (user && !isPasswordResetMode) {
      if (profile?.factory_id) {
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

        // Finishing workers land on the Finishing Daily Sheet
        if (profile.department === "finishing") {
          navigate("/finishing/daily-sheet", { replace: true });
          return;
        }

        const isWorker =
          profile.department != null ||
          (hasRole("worker") && !hasRole("supervisor") && !isAdminOrHigher());

        navigate(isWorker ? "/sewing/morning-targets" : "/dashboard", { replace: true });
      } else if (profile) {
        navigate("/subscription", { replace: true });
      }
    }
  }, [authLoading, user, profile, navigate, isPasswordResetMode, hasRole, isAdminOrHigher]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail || !z.string().email().safeParse(forgotPasswordEmail).success) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    setForgotPasswordLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setForgotPasswordLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
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
      toast({
        variant: "destructive",
        title: "Error updating password",
        description: error.message,
      });
    } else {
      toast({
        title: "Password updated!",
        description: "Your password has been successfully updated.",
      });
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
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message === "Invalid login credentials"
          ? "Invalid email or password. Please try again."
          : error.message,
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
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
        toast({
          variant: "destructive",
          title: "Account exists",
          description: "An account with this email already exists. Please log in instead.",
        });
        setActiveTab("login");
        setLoginEmail(signupEmail);
      } else {
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: error.message,
        });
      }
    } else {
      toast({
        title: "Account created!",
        description: "Welcome to Production Portal.",
      });
      // New users need to choose subscription/trial
      navigate("/subscription");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero section */}
      <div className="gradient-industrial text-sidebar-foreground py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <img 
              src={logoSvg} 
              alt="Production Portal" 
              className="h-12 w-12 rounded-xl"
            />
            <h1 className="text-2xl font-bold">Production Portal</h1>
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
                      type="password"
                      placeholder="••••••••"
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
                      type="password"
                      placeholder="••••••••"
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
                          type="email"
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
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="h-11"
                          disabled={isLoading}
                        />
                        {loginErrors.password && (
                          <p className="text-sm text-destructive">{loginErrors.password}</p>
                        )}
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
                      
                      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                        <DialogTrigger asChild>
                          <Button variant="link" type="button" className="w-full text-sm text-muted-foreground hover:text-primary">
                            Forgot your password?
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
                                type="email"
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
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <Input
                          id="signup-name"
                          type="text"
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
                          type="email"
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
                          type="password"
                          placeholder="••••••••"
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
                          type="password"
                          placeholder="••••••••"
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
                <Factory className="h-6 w-6 text-primary" />
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
