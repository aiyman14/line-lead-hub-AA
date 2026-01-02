import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Factory,
  Package,
  AlertTriangle,
  TrendingUp,
  Rows3,
  ClipboardList,
  Clock,
  ChevronRight,
  Plus,
} from "lucide-react";

interface DashboardStats {
  updatesToday: number;
  blockersToday: number;
  missingToday: number;
  totalLines: number;
  activeWorkOrders: number;
  avgEfficiency: number;
}

interface RecentUpdate {
  id: string;
  type: 'sewing' | 'finishing';
  line_id: string;
  line_name: string;
  output: number;
  submitted_at: string;
  has_blocker: boolean;
}

interface ActiveBlocker {
  id: string;
  description: string;
  impact: string;
  line_name: string;
  created_at: string;
}

export default function Dashboard() {
  const { profile, factory, isAdminOrHigher, hasRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    updatesToday: 0,
    blockersToday: 0,
    missingToday: 0,
    totalLines: 0,
    activeWorkOrders: 0,
    avgEfficiency: 0,
  });
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [activeBlockers, setActiveBlockers] = useState<ActiveBlocker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchDashboardData();
    }
  }, [profile?.factory_id]);

  async function fetchDashboardData() {
    if (!profile?.factory_id) return;
    
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Fetch today's sewing updates
      const { data: sewingUpdates, count: sewingCount } = await supabase
        .from('production_updates_sewing')
        .select('*, lines(line_id, name)', { count: 'exact' })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false })
        .limit(5);

      // Fetch today's finishing updates
      const { data: finishingUpdates, count: finishingCount } = await supabase
        .from('production_updates_finishing')
        .select('*, lines(line_id, name)', { count: 'exact' })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false })
        .limit(5);

      // Fetch active lines
      const { count: linesCount } = await supabase
        .from('lines')
        .select('*', { count: 'exact', head: true })
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true);

      // Fetch active work orders
      const { count: workOrdersCount } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true);

      // Count blockers today
      const sewingBlockers = sewingUpdates?.filter(u => u.has_blocker).length || 0;
      const finishingBlockers = finishingUpdates?.filter(u => u.has_blocker).length || 0;

      // Format recent updates
      const formattedSewing: RecentUpdate[] = (sewingUpdates || []).map(u => ({
        id: u.id,
        type: 'sewing' as const,
        line_id: u.lines?.line_id || 'Unknown',
        line_name: u.lines?.name || u.lines?.line_id || 'Unknown',
        output: u.output_qty,
        submitted_at: u.submitted_at,
        has_blocker: u.has_blocker,
      }));

      const formattedFinishing: RecentUpdate[] = (finishingUpdates || []).map(u => ({
        id: u.id,
        type: 'finishing' as const,
        line_id: u.lines?.line_id || 'Unknown',
        line_name: u.lines?.name || u.lines?.line_id || 'Unknown',
        output: u.qc_pass_qty,
        submitted_at: u.submitted_at,
        has_blocker: u.has_blocker,
      }));

      // Combine and sort by time
      const allUpdates = [...formattedSewing, ...formattedFinishing]
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
        .slice(0, 5);

      // Extract blockers
      const blockers: ActiveBlocker[] = [];
      sewingUpdates?.filter(u => u.has_blocker).forEach(u => {
        blockers.push({
          id: u.id,
          description: u.blocker_description || 'No description',
          impact: u.blocker_impact || 'medium',
          line_name: u.lines?.name || u.lines?.line_id || 'Unknown',
          created_at: u.submitted_at,
        });
      });
      finishingUpdates?.filter(u => u.has_blocker).forEach(u => {
        blockers.push({
          id: u.id,
          description: u.blocker_description || 'No description',
          impact: u.blocker_impact || 'medium',
          line_name: u.lines?.name || u.lines?.line_id || 'Unknown',
          created_at: u.submitted_at,
        });
      });

      // Calculate missing (lines that haven't submitted today)
      const linesWithUpdates = new Set([
        ...(sewingUpdates || []).map(u => u.line_id),
        ...(finishingUpdates || []).map(u => u.line_id),
      ]);
      const missingCount = (linesCount || 0) - linesWithUpdates.size;

      setStats({
        updatesToday: (sewingCount || 0) + (finishingCount || 0),
        blockersToday: sewingBlockers + finishingBlockers,
        missingToday: Math.max(0, missingCount),
        totalLines: linesCount || 0,
        activeWorkOrders: workOrdersCount || 0,
        avgEfficiency: 0, // Would need calculation based on target vs actual
      });

      setRecentUpdates(allUpdates);
      setActiveBlockers(blockers.slice(0, 3));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isWorker = hasRole('worker') && !isAdminOrHigher();

  // Worker view - simplified
  if (isWorker) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Hello, {profile?.full_name.split(' ')[0]}!</h1>
          <p className="text-muted-foreground">Submit your production updates below</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/update/sewing">
            <Card className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 border-2 border-primary/20 hover:border-primary/40">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Factory className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Sewing Update</h3>
                  <p className="text-sm text-muted-foreground">Submit line production data</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/update/finishing">
            <Card className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 border-2 border-info/20 hover:border-info/40">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-info/10 flex items-center justify-center">
                  <Package className="h-7 w-7 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Finishing Update</h3>
                  <p className="text-sm text-muted-foreground">QC, packing & shipping data</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Your submissions will appear here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin/Supervisor view - full dashboard
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Control Dashboard</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/update/sewing">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Sewing
            </Button>
          </Link>
          <Link to="/update/finishing">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Finishing
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Updates Today"
          value={stats.updatesToday}
          icon={TrendingUp}
          variant="neutral"
          subtitle={`${stats.totalLines} lines tracked`}
        />
        <KPICard
          title="Blockers Today"
          value={stats.blockersToday}
          icon={AlertTriangle}
          variant={stats.blockersToday > 0 ? "warning" : "positive"}
          subtitle={stats.blockersToday > 0 ? "Requires attention" : "All clear"}
        />
        <KPICard
          title="Missing Today"
          value={stats.missingToday}
          icon={Rows3}
          variant={stats.missingToday > 0 ? "negative" : "positive"}
          subtitle={stats.missingToday > 0 ? "Lines pending" : "All submitted"}
        />
        <KPICard
          title="Work Orders"
          value={stats.activeWorkOrders}
          icon={ClipboardList}
          variant="neutral"
          subtitle="Active orders"
        />
      </div>

      {/* Quick Actions for Mobile */}
      <div className="lg:hidden grid grid-cols-2 gap-3">
        <Link to="/update/sewing">
          <Button className="w-full h-14 text-base" variant="default">
            <Factory className="h-5 w-5 mr-2" />
            Sewing
          </Button>
        </Link>
        <Link to="/update/finishing">
          <Button className="w-full h-14 text-base" variant="secondary">
            <Package className="h-5 w-5 mr-2" />
            Finishing
          </Button>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Updates */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Updates</CardTitle>
            <Link to="/today">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted rounded-lg shimmer" />
                ))}
              </div>
            ) : recentUpdates.length > 0 ? (
              <div className="space-y-3">
                {recentUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        update.type === 'sewing' ? 'bg-primary/10' : 'bg-info/10'
                      }`}>
                        {update.type === 'sewing' ? (
                          <Factory className={`h-5 w-5 text-primary`} />
                        ) : (
                          <Package className={`h-5 w-5 text-info`} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{update.line_name}</span>
                          <StatusBadge variant={update.type} size="sm">
                            {update.type}
                          </StatusBadge>
                          {update.has_blocker && (
                            <StatusBadge variant="danger" size="sm" dot>
                              Blocker
                            </StatusBadge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatTime(update.submitted_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-lg">{update.output.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {update.type === 'sewing' ? 'output' : 'QC pass'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No updates submitted today</p>
                <p className="text-sm">Start by adding a production update</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Blockers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Active Blockers
            </CardTitle>
            <Link to="/blockers">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-20 bg-muted rounded-lg shimmer" />
                ))}
              </div>
            ) : activeBlockers.length > 0 ? (
              <div className="space-y-3">
                {activeBlockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className={`p-3 rounded-lg border ${
                      blocker.impact === 'critical' ? 'border-destructive/30 bg-destructive/5' :
                      blocker.impact === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                      blocker.impact === 'medium' ? 'border-warning/30 bg-warning/5' :
                      'border-success/30 bg-success/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-sm">{blocker.line_name}</span>
                      <StatusBadge variant={blocker.impact as any} size="sm">
                        {blocker.impact}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {blocker.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-success/10 flex items-center justify-center">
                  <svg className="h-6 w-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p>No active blockers</p>
                <p className="text-sm">Production running smoothly</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
