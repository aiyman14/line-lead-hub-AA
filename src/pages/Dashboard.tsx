import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubmissionDetailModal } from "@/components/SubmissionDetailModal";
import { TargetDetailModal } from "@/components/TargetDetailModal";
import {
  Factory,
  Package,
  AlertTriangle,
  TrendingUp,
  Rows3,
  ClipboardList,
  ChevronRight,
  Plus,
  Crosshair,
  ClipboardCheck,
} from "lucide-react";

interface DashboardStats {
  updatesToday: number;
  blockersToday: number;
  missingToday: number;
  totalLines: number;
  activeWorkOrders: number;
  avgEfficiency: number;
}

interface TargetSubmission {
  id: string;
  type: 'sewing' | 'finishing';
  line_id: string;
  line_name: string;
  work_order_id: string;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  per_hour_target: number;
  manpower_planned?: number | null;
  m_power_planned?: number | null;
  ot_hours_planned?: number | null;
  day_hour_planned?: number | null;
  day_over_time_planned?: number | null;
  planned_stage_progress?: number | null;
  next_milestone?: string | null;
  estimated_ex_factory?: string | null;
  order_qty?: number | null;
  remarks?: string | null;
  submitted_at: string;
  production_date: string;
}

interface EndOfDaySubmission {
  id: string;
  type: 'sewing' | 'finishing';
  line_id: string;
  line_name: string;
  output: number;
  submitted_at: string;
  production_date: string;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  blocker_status: string | null;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  // Sewing specific
  target_qty?: number | null;
  manpower?: number | null;
  reject_qty?: number | null;
  rework_qty?: number | null;
  stage_progress?: number | null;
  ot_hours?: number | null;
  ot_manpower?: number | null;
  notes?: string | null;
  // Finishing specific
  buyer_name?: string | null;
  style_no?: string | null;
  item_name?: string | null;
  order_quantity?: number | null;
  unit_name?: string | null;
  floor_name?: string | null;
  m_power?: number | null;
  per_hour_target?: number | null;
  day_qc_pass?: number | null;
  total_qc_pass?: number | null;
  day_poly?: number | null;
  total_poly?: number | null;
  average_production?: number | null;
  day_over_time?: number | null;
  total_over_time?: number | null;
  day_hour?: number | null;
  total_hour?: number | null;
  day_carton?: number | null;
  total_carton?: number | null;
  remarks?: string | null;
}

interface ActiveBlocker {
  id: string;
  type: 'sewing' | 'finishing';
  description: string;
  impact: string;
  line_name: string;
  created_at: string;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, factory, isAdminOrHigher, hasRole, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    updatesToday: 0,
    blockersToday: 0,
    missingToday: 0,
    totalLines: 0,
    activeWorkOrders: 0,
    avgEfficiency: 0,
  });
  const [departmentTab, setDepartmentTab] = useState<'sewing' | 'finishing'>('sewing');
  const [sewingTargets, setSewingTargets] = useState<TargetSubmission[]>([]);
  const [finishingTargets, setFinishingTargets] = useState<TargetSubmission[]>([]);
  const [sewingEndOfDay, setSewingEndOfDay] = useState<EndOfDaySubmission[]>([]);
  const [finishingEndOfDay, setFinishingEndOfDay] = useState<EndOfDaySubmission[]>([]);
  const [activeBlockers, setActiveBlockers] = useState<ActiveBlocker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetSubmission | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);

  const canViewDashboard = hasRole('supervisor') || isAdminOrHigher();

  useEffect(() => {
    if (!authLoading && profile?.factory_id && !canViewDashboard) {
      navigate('/my-submissions', { replace: true });
    }
  }, [authLoading, profile?.factory_id, canViewDashboard, navigate]);

  useEffect(() => {
    if (profile?.factory_id && canViewDashboard) {
      fetchDashboardData();
    }
  }, [profile?.factory_id, canViewDashboard]);

  if (authLoading || (!canViewDashboard && profile?.factory_id)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  async function fetchDashboardData() {
    if (!profile?.factory_id) return;
    
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Fetch sewing targets
      const { data: sewingTargetsData } = await supabase
        .from('sewing_targets')
        .select('*, lines(line_id, name), work_orders(po_number, buyer, style)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Fetch finishing targets
      const { data: finishingTargetsData } = await supabase
        .from('finishing_targets')
        .select('*, lines(line_id, name), work_orders(po_number, buyer, style)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Fetch sewing end of day (actuals)
      const { data: sewingActualsData, count: sewingCount } = await supabase
        .from('production_updates_sewing')
        .select('*, lines(line_id, name), work_orders(po_number, buyer, style)', { count: 'exact' })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Fetch finishing end of day (actuals)
      const { data: finishingActualsData, count: finishingCount } = await supabase
        .from('production_updates_finishing')
        .select('*, lines(line_id, name), work_orders(po_number, buyer, style)', { count: 'exact' })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Blocker counts
      const { count: sewingBlockersCount } = await supabase
        .from('production_updates_sewing')
        .select('*', { count: 'exact', head: true })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .eq('has_blocker', true)
        .neq('blocker_status', 'resolved');

      const { count: finishingBlockersCount } = await supabase
        .from('production_updates_finishing')
        .select('*', { count: 'exact', head: true })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .eq('has_blocker', true)
        .neq('blocker_status', 'resolved');

      // Fetch active lines and work orders
      const { count: linesCount } = await supabase
        .from('lines')
        .select('*', { count: 'exact', head: true })
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true);

      const { count: workOrdersCount } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true);

      // Format sewing targets
      const formattedSewingTargets: TargetSubmission[] = (sewingTargetsData || []).map(t => ({
        id: t.id,
        type: 'sewing' as const,
        line_id: t.lines?.line_id || 'Unknown',
        line_name: t.lines?.name || t.lines?.line_id || 'Unknown',
        work_order_id: t.work_order_id,
        po_number: t.work_orders?.po_number || null,
        buyer: t.work_orders?.buyer || null,
        style: t.work_orders?.style || null,
        per_hour_target: t.per_hour_target,
        manpower_planned: t.manpower_planned,
        ot_hours_planned: t.ot_hours_planned,
        planned_stage_progress: t.planned_stage_progress,
        next_milestone: t.next_milestone,
        estimated_ex_factory: t.estimated_ex_factory,
        order_qty: t.order_qty,
        remarks: t.remarks,
        submitted_at: t.submitted_at,
        production_date: t.production_date,
      }));

      // Format finishing targets
      const formattedFinishingTargets: TargetSubmission[] = (finishingTargetsData || []).map(t => ({
        id: t.id,
        type: 'finishing' as const,
        line_id: t.lines?.line_id || 'Unknown',
        line_name: t.lines?.name || t.lines?.line_id || 'Unknown',
        work_order_id: t.work_order_id,
        po_number: t.work_orders?.po_number || null,
        buyer: t.work_orders?.buyer || null,
        style: t.work_orders?.style || null,
        per_hour_target: t.per_hour_target,
        m_power_planned: t.m_power_planned,
        day_hour_planned: t.day_hour_planned,
        day_over_time_planned: t.day_over_time_planned,
        order_qty: t.order_qty,
        remarks: t.remarks,
        submitted_at: t.submitted_at,
        production_date: t.production_date,
      }));

      // Format sewing end of day
      const formattedSewingEOD: EndOfDaySubmission[] = (sewingActualsData || []).map(u => ({
        id: u.id,
        type: 'sewing' as const,
        line_id: u.lines?.line_id || 'Unknown',
        line_name: u.lines?.name || u.lines?.line_id || 'Unknown',
        output: u.output_qty,
        submitted_at: u.submitted_at,
        production_date: u.production_date,
        has_blocker: u.has_blocker || false,
        blocker_description: u.blocker_description,
        blocker_impact: u.blocker_impact,
        blocker_owner: u.blocker_owner,
        blocker_status: u.blocker_status,
        po_number: u.work_orders?.po_number || null,
        buyer: u.work_orders?.buyer || null,
        style: u.work_orders?.style || null,
        target_qty: u.target_qty,
        manpower: u.manpower,
        reject_qty: u.reject_qty,
        rework_qty: u.rework_qty,
        stage_progress: u.stage_progress,
        ot_hours: u.ot_hours,
        ot_manpower: u.ot_manpower,
        notes: u.notes,
      }));

      // Format finishing end of day
      const formattedFinishingEOD: EndOfDaySubmission[] = (finishingActualsData || []).map(u => ({
        id: u.id,
        type: 'finishing' as const,
        line_id: u.lines?.line_id || 'Unknown',
        line_name: u.lines?.name || u.lines?.line_id || 'Unknown',
        output: u.day_qc_pass || 0,
        submitted_at: u.submitted_at,
        production_date: u.production_date,
        has_blocker: u.has_blocker || false,
        blocker_description: u.blocker_description,
        blocker_impact: u.blocker_impact,
        blocker_owner: u.blocker_owner,
        blocker_status: u.blocker_status,
        po_number: u.work_orders?.po_number || null,
        buyer: u.work_orders?.buyer || null,
        style: u.work_orders?.style || null,
        buyer_name: u.buyer_name,
        style_no: u.style_no,
        item_name: u.item_name,
        order_quantity: u.order_quantity,
        unit_name: u.unit_name,
        floor_name: u.floor_name,
        m_power: u.m_power,
        per_hour_target: u.per_hour_target,
        day_qc_pass: u.day_qc_pass,
        total_qc_pass: u.total_qc_pass,
        day_poly: u.day_poly,
        total_poly: u.total_poly,
        average_production: u.average_production,
        day_over_time: u.day_over_time,
        total_over_time: u.total_over_time,
        day_hour: u.day_hour,
        total_hour: u.total_hour,
        day_carton: u.day_carton,
        total_carton: u.total_carton,
        remarks: u.remarks,
      }));

      // Fetch active blockers
      const { data: sewingBlockers } = await supabase
        .from('production_updates_sewing')
        .select('id, blocker_description, blocker_impact, submitted_at, lines(line_id, name)')
        .eq('factory_id', profile.factory_id)
        .eq('has_blocker', true)
        .neq('blocker_status', 'resolved')
        .order('submitted_at', { ascending: false })
        .limit(5);

      const { data: finishingBlockers } = await supabase
        .from('production_updates_finishing')
        .select('id, blocker_description, blocker_impact, submitted_at, lines(line_id, name)')
        .eq('factory_id', profile.factory_id)
        .eq('has_blocker', true)
        .neq('blocker_status', 'resolved')
        .order('submitted_at', { ascending: false })
        .limit(5);

      const blockers: ActiveBlocker[] = [];
      sewingBlockers?.forEach(u => {
        blockers.push({
          id: u.id,
          type: 'sewing',
          description: u.blocker_description || 'No description',
          impact: u.blocker_impact || 'medium',
          line_name: u.lines?.name || u.lines?.line_id || 'Unknown',
          created_at: u.submitted_at,
        });
      });
      finishingBlockers?.forEach(u => {
        blockers.push({
          id: u.id,
          type: 'finishing',
          description: u.blocker_description || 'No description',
          impact: u.blocker_impact || 'medium',
          line_name: u.lines?.name || u.lines?.line_id || 'Unknown',
          created_at: u.submitted_at,
        });
      });

      // Calculate missing lines
      const linesWithUpdates = new Set([
        ...(sewingActualsData || []).map(u => u.line_id),
        ...(finishingActualsData || []).map(u => u.line_id),
      ]);
      const missingCount = (linesCount || 0) - linesWithUpdates.size;

      setStats({
        updatesToday: (sewingCount || 0) + (finishingCount || 0),
        blockersToday: (sewingBlockersCount || 0) + (finishingBlockersCount || 0),
        missingToday: Math.max(0, missingCount),
        totalLines: linesCount || 0,
        activeWorkOrders: workOrdersCount || 0,
        avgEfficiency: 0,
      });

      setSewingTargets(formattedSewingTargets);
      setFinishingTargets(formattedFinishingTargets);
      setSewingEndOfDay(formattedSewingEOD);
      setFinishingEndOfDay(formattedFinishingEOD);
      setActiveBlockers(blockers.slice(0, 5));
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

  if (!canViewDashboard) {
    return null;
  }

  const currentTargets = departmentTab === 'sewing' ? sewingTargets : finishingTargets;
  const currentEndOfDay = departmentTab === 'sewing' ? sewingEndOfDay : finishingEndOfDay;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
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
              {t('dashboard.sewing')}
            </Button>
          </Link>
          <Link to="/update/finishing">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              {t('dashboard.finishing')}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('dashboard.updatesToday')}
          value={stats.updatesToday}
          icon={TrendingUp}
          variant="neutral"
          subtitle={`${stats.totalLines} ${t('dashboard.linesTracked')}`}
          href="/today"
        />
        <KPICard
          title={t('dashboard.blockersToday')}
          value={stats.blockersToday}
          icon={AlertTriangle}
          variant={stats.blockersToday > 0 ? "warning" : "positive"}
          subtitle={stats.blockersToday > 0 ? t('dashboard.requiresAttention') : t('dashboard.allClear')}
          href="/blockers"
        />
        <KPICard
          title={t('dashboard.missingToday')}
          value={stats.missingToday}
          icon={Rows3}
          variant={stats.missingToday > 0 ? "negative" : "positive"}
          subtitle={stats.missingToday > 0 ? t('dashboard.linesPending') : t('dashboard.allSubmitted')}
          href="/lines"
        />
        <KPICard
          title={t('dashboard.workOrders')}
          value={stats.activeWorkOrders}
          icon={ClipboardList}
          variant="neutral"
          subtitle={t('dashboard.activeOrders')}
          href="/work-orders"
        />
      </div>

      {/* Department Tabs */}
      <Tabs value={departmentTab} onValueChange={(v) => setDepartmentTab(v as 'sewing' | 'finishing')} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sewing" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Sewing
          </TabsTrigger>
          <TabsTrigger value="finishing" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Finishing
          </TabsTrigger>
        </TabsList>

        <TabsContent value={departmentTab} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Morning Targets Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Crosshair className="h-5 w-5 text-primary" />
                  Morning Targets
                </CardTitle>
                <Link to={departmentTab === 'sewing' ? '/sewing/morning-targets' : '/finishing/morning-targets'}>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : currentTargets.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {currentTargets.map((target) => (
                      <div
                        key={target.id}
                        onClick={() => {
                          setSelectedTarget(target);
                          setTargetModalOpen(true);
                        }}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
                            <Crosshair className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{target.line_name}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {target.po_number || 'No PO'} • {formatTime(target.submitted_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-lg">{target.per_hour_target}</p>
                          <p className="text-xs text-muted-foreground">per hour</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Crosshair className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No targets submitted today</p>
                    <Link to={departmentTab === 'sewing' ? '/sewing/morning-targets' : '/finishing/morning-targets'}>
                      <Button variant="link" size="sm" className="mt-2">
                        Add morning targets
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* End of Day Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-info" />
                  End of Day
                </CardTitle>
                <Link to={departmentTab === 'sewing' ? '/sewing/end-of-day' : '/finishing/end-of-day'}>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : currentEndOfDay.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {currentEndOfDay.map((update) => (
                      <div
                        key={update.id}
                        onClick={() => {
                          const submissionData = update.type === 'sewing' ? {
                            id: update.id,
                            type: 'sewing' as const,
                            line_name: update.line_name,
                            po_number: update.po_number,
                            buyer: update.buyer,
                            style: update.style,
                            output_qty: update.output,
                            target_qty: update.target_qty,
                            manpower: update.manpower,
                            reject_qty: update.reject_qty,
                            rework_qty: update.rework_qty,
                            stage_progress: update.stage_progress,
                            ot_hours: update.ot_hours,
                            ot_manpower: update.ot_manpower,
                            has_blocker: update.has_blocker,
                            blocker_description: update.blocker_description,
                            blocker_impact: update.blocker_impact,
                            blocker_owner: update.blocker_owner,
                            blocker_status: update.blocker_status,
                            notes: update.notes,
                            submitted_at: update.submitted_at,
                            production_date: update.production_date,
                          } : {
                            id: update.id,
                            type: 'finishing' as const,
                            line_name: update.line_name,
                            po_number: update.po_number,
                            buyer_name: update.buyer_name,
                            style_no: update.style_no,
                            item_name: update.item_name,
                            order_quantity: update.order_quantity,
                            unit_name: update.unit_name,
                            floor_name: update.floor_name,
                            m_power: update.m_power,
                            per_hour_target: update.per_hour_target,
                            day_qc_pass: update.day_qc_pass,
                            total_qc_pass: update.total_qc_pass,
                            day_poly: update.day_poly,
                            total_poly: update.total_poly,
                            average_production: update.average_production,
                            day_over_time: update.day_over_time,
                            total_over_time: update.total_over_time,
                            day_hour: update.day_hour,
                            total_hour: update.total_hour,
                            day_carton: update.day_carton,
                            total_carton: update.total_carton,
                            remarks: update.remarks,
                            has_blocker: update.has_blocker,
                            blocker_description: update.blocker_description,
                            blocker_impact: update.blocker_impact,
                            blocker_owner: update.blocker_owner,
                            blocker_status: update.blocker_status,
                            submitted_at: update.submitted_at,
                            production_date: update.production_date,
                          };
                          setSelectedSubmission(submissionData);
                          setSubmissionModalOpen(true);
                        }}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-info/10">
                            <ClipboardCheck className="h-5 w-5 text-info" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{update.line_name}</span>
                              {update.has_blocker && (
                                <StatusBadge variant="danger" size="sm" dot>
                                  Blocker
                                </StatusBadge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {update.po_number || 'No PO'} • {formatTime(update.submitted_at)}
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
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No end of day submissions</p>
                    <Link to={departmentTab === 'sewing' ? '/sewing/end-of-day' : '/finishing/end-of-day'}>
                      <Button variant="link" size="sm" className="mt-2">
                        Add end of day report
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : activeBlockers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge variant={blocker.type} size="sm">
                      {blocker.type}
                    </StatusBadge>
                  </div>
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

      <SubmissionDetailModal
        submission={selectedSubmission}
        open={submissionModalOpen}
        onOpenChange={setSubmissionModalOpen}
      />

      <TargetDetailModal
        target={selectedTarget}
        open={targetModalOpen}
        onOpenChange={setTargetModalOpen}
      />
    </div>
  );
}
