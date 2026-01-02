import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Settings,
  Rows3,
  ClipboardList,
  ListOrdered,
  Building2,
  Clock,
  ChevronRight,
  AlertTriangle,
  Factory
} from "lucide-react";

interface FactoryStats {
  linesCount: number;
  activeLinesCount: number;
  workOrdersCount: number;
  activeWorkOrdersCount: number;
  unitsCount: number;
  floorsCount: number;
}

export default function SetupHome() {
  const { profile, factory, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FactoryStats>({
    linesCount: 0,
    activeLinesCount: 0,
    workOrdersCount: 0,
    activeWorkOrdersCount: 0,
    unitsCount: 0,
    floorsCount: 0,
  });
  const [cutoffTime, setCutoffTime] = useState("16:00");
  const [isSavingCutoff, setIsSavingCutoff] = useState(false);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchStats();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.factory_id, profile]);

  useEffect(() => {
    if (factory?.cutoff_time) {
      setCutoffTime(factory.cutoff_time.slice(0, 5)); // HH:MM format
    }
  }, [factory]);

  async function fetchStats() {
    if (!profile?.factory_id) return;
    
    try {
      const [linesRes, workOrdersRes, unitsRes, floorsRes] = await Promise.all([
        supabase.from('lines').select('id, is_active').eq('factory_id', profile.factory_id),
        supabase.from('work_orders').select('id, is_active').eq('factory_id', profile.factory_id),
        supabase.from('units').select('id').eq('factory_id', profile.factory_id),
        supabase.from('floors').select('id').eq('factory_id', profile.factory_id),
      ]);
      
      const lines = linesRes.data || [];
      const workOrders = workOrdersRes.data || [];
      
      setStats({
        linesCount: lines.length,
        activeLinesCount: lines.filter(l => l.is_active).length,
        workOrdersCount: workOrders.length,
        activeWorkOrdersCount: workOrders.filter(w => w.is_active).length,
        unitsCount: unitsRes.data?.length || 0,
        floorsCount: floorsRes.data?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCutoff() {
    if (!profile?.factory_id) return;
    
    setIsSavingCutoff(true);
    try {
      const { error } = await supabase
        .from('factory_accounts')
        .update({ cutoff_time: cutoffTime + ':00' })
        .eq('id', profile.factory_id);
      
      if (error) throw error;
      toast({ title: "Cutoff time updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSavingCutoff(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Factory Assigned</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Create your factory to get started.
            </p>
            <Button onClick={() => navigate('/setup/factory')}>
              Create Factory
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdminOrHigher()) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-sm">
              You need admin permissions to access factory setup.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const setupLinks = [
    {
      title: 'Lines, Units & Floors',
      description: 'Manage production lines and factory structure',
      icon: Rows3,
      href: '/setup/factory',
      stats: `${stats.activeLinesCount} active lines, ${stats.unitsCount} units, ${stats.floorsCount} floors`,
    },
    {
      title: 'Work Orders / PO Master',
      description: 'Manage purchase orders and work orders',
      icon: ClipboardList,
      href: '/setup/work-orders',
      stats: `${stats.activeWorkOrdersCount} active of ${stats.workOrdersCount} total`,
    },
    {
      title: 'Dropdown Settings',
      description: 'Stages, progress options, blockers, milestones',
      icon: ListOrdered,
      href: '/setup/dropdowns',
      stats: 'Configure form dropdowns',
    },
  ];

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Factory Setup</h1>
          <p className="text-sm text-muted-foreground">
            {factory?.name || 'Configure your factory settings'}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Rows3 className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeLinesCount}</p>
                <p className="text-xs text-muted-foreground">Active Lines</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeWorkOrdersCount}</p>
                <p className="text-xs text-muted-foreground">Active POs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.unitsCount}</p>
                <p className="text-xs text-muted-foreground">Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cutoffTime}</p>
                <p className="text-xs text-muted-foreground">Cutoff Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cutoff Time Setting */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Daily Cutoff Time
          </CardTitle>
          <CardDescription>
            Submissions after this time are considered "missing" for the day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Cutoff Time</Label>
              <Input
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={handleSaveCutoff} disabled={isSavingCutoff}>
              {isSavingCutoff && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup Links */}
      <div className="space-y-3">
        {setupLinks.map((link) => (
          <Link key={link.href} to={link.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <link.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{link.title}</h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{link.stats}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
