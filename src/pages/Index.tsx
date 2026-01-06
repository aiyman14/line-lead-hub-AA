import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Factory, 
  BarChart3, 
  AlertTriangle, 
  Users, 
  Smartphone,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function Index() {
  const { user, loading, profile, hasRole, isAdminOrHigher } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect authenticated users based on role
  if (user) {
    if (!profile) return null;

    if (!profile.factory_id) {
      return <Navigate to="/subscription" replace />;
    }

    // Check for cutting role first
    if (hasRole('cutting')) {
      return <Navigate to="/cutting/submissions" replace />;
    }

    // Check for storage role
    if (hasRole('storage')) {
      return <Navigate to="/storage" replace />;
    }

    // Check for finishing department workers
    if (profile.department === 'finishing') {
      return <Navigate to="/finishing/my-submissions" replace />;
    }

    const isWorker = (profile.department != null) || (hasRole('worker') && !hasRole('supervisor') && !isAdminOrHigher());
    return <Navigate to={isWorker ? "/sewing/morning-targets" : "/dashboard"} replace />;
  }

  // Redirect unauthenticated users to auth page
  return <Navigate to="/auth" replace />;
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="gradient-industrial text-sidebar-foreground">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
              PP
            </div>
            <span className="text-xl font-bold">Production Portal</span>
          </div>
          <Link to="/auth">
            <Button variant="secondary" size="sm">
              Sign In
            </Button>
          </Link>
        </nav>

        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 max-w-3xl mx-auto leading-tight">
            Real-Time Production Tracking for
            <span className="text-gradient"> Garment Factories</span>
          </h1>
          <p className="text-lg md:text-xl text-sidebar-foreground/80 max-w-2xl mx-auto mb-8">
            Monitor production lines, track blockers, and get actionable insights.
            Built for factory floors, optimized for mobile.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8 text-base">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-transparent border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-foreground/10">
              Watch Demo
            </Button>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Everything You Need to Optimize Production
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            From daily updates to strategic insights, manage your entire production workflow in one place.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Factory,
                title: "Line Tracking",
                description: "Track sewing, finishing, QC, and packing output per line in real-time.",
                color: "primary"
              },
              {
                icon: AlertTriangle,
                title: "Blocker Management",
                description: "Log and resolve production blockers with impact tracking and ownership.",
                color: "warning"
              },
              {
                icon: BarChart3,
                title: "Smart Insights",
                description: "Daily insights on efficiency, bottlenecks, and delivery risk predictions.",
                color: "success"
              },
              {
                icon: Users,
                title: "Role-Based Access",
                description: "Workers, supervisors, and admins get exactly what they need.",
                color: "info"
              },
              {
                icon: Smartphone,
                title: "Mobile First",
                description: "Designed for factory floor use on any device, even low-end phones.",
                color: "accent"
              },
              {
                icon: CheckCircle,
                title: "Multi-Tenant",
                description: "Each factory is isolated with their own setup, users, and data.",
                color: "success"
              },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow">
                <div className={`h-12 w-12 rounded-lg bg-${feature.color}/10 flex items-center justify-center mb-4`}>
                  <feature.icon className={`h-6 w-6 text-${feature.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Optimize Your Factory?</h2>
          <p className="text-muted-foreground mb-8">
            Start tracking production in minutes. No credit card required.
          </p>
          <Link to="/auth">
            <Button size="lg" className="h-12 px-8">
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              PP
            </div>
            <span className="font-semibold">Production Portal</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Production Portal. Built for garment factories.
          </p>
        </div>
      </footer>
    </div>
  );
}
