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
import { CuttingDetailModal } from "@/components/CuttingDetailModal";
import { StorageBinCardDetailModal } from "@/components/StorageBinCardDetailModal";
import { TargetVsActualComparison } from "@/components/insights/TargetVsActualComparison";
import { FinishingDashboard } from "@/components/dashboard/FinishingDashboard";
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
  Scissors,
  Archive,
} from "lucide-react";

interface DashboardStats {
  updatesToday: number;
  blockersToday: number;
  daySewingOutput: number;
  dayFinishingOutput: number;
  totalLines: number;
  activeWorkOrders: number;
  avgEfficiency: number;
}

interface TargetSubmission {
  id: string;
  type: 'sewing' | 'finishing';
  line_uuid: string;
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
  line_uuid: string;
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
  // Finishing daily sheet specific
  hours_logged?: number;
  total_poly?: number;
  total_carton?: number;
}

interface LineInfo {
  id: string;
  line_id: string;
  name: string | null;
}

interface ActiveBlocker {
  id: string;
  type: 'sewing' | 'finishing';
  description: string;
  impact: string;
  line_name: string;
  created_at: string;
}

interface CuttingSubmission {
  id: string;
  production_date: string;
  line_name: string;
  buyer: string | null;
  style: string | null;
  po_number: string | null;
  colour: string | null;
  order_qty: number | null;
  man_power: number | null;
  marker_capacity: number | null;
  lay_capacity: number | null;
  cutting_capacity: number | null;
  under_qty: number | null;
  day_cutting: number;
  total_cutting: number | null;
  day_input: number;
  total_input: number | null;
  balance: number | null;
  submitted_at: string | null;
}

interface StorageBinCard {
  id: string;
  buyer: string | null;
  style: string | null;
  po_number: string | null;
  supplier_name: string | null;
  description: string | null;
  construction: string | null;
  color: string | null;
  width: string | null;
  package_qty: string | null;
  prepared_by: string | null;
  transactions: StorageTransaction[];
  transaction_count: number;
  latest_balance: number;
}

interface StorageTransaction {
  id: string;
  transaction_date: string;
  receive_qty: number;
  issue_qty: number;
  ttl_receive: number;
  balance_qty: number;
  remarks: string | null;
  created_at: string | null;
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile, factory, isAdminOrHigher, hasRole, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    updatesToday: 0,
    blockersToday: 0,
    daySewingOutput: 0,
    dayFinishingOutput: 0,
    totalLines: 0,
    activeWorkOrders: 0,
    avgEfficiency: 0,
  });
  const [departmentTab, setDepartmentTab] = useState<'sewing' | 'finishing' | 'cutting' | 'storage'>('storage');
  const [sewingTargets, setSewingTargets] = useState<TargetSubmission[]>([]);
  const [finishingTargets, setFinishingTargets] = useState<TargetSubmission[]>([]);
  const [sewingEndOfDay, setSewingEndOfDay] = useState<EndOfDaySubmission[]>([]);
  const [finishingEndOfDay, setFinishingEndOfDay] = useState<EndOfDaySubmission[]>([]);
  const [cuttingSubmissions, setCuttingSubmissions] = useState<CuttingSubmission[]>([]);
  const [storageBinCards, setStorageBinCards] = useState<StorageBinCard[]>([]);
  const [allLines, setAllLines] = useState<LineInfo[]>([]);
  const [activeBlockers, setActiveBlockers] = useState<ActiveBlocker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetSubmission | null>(null);
  const [selectedCutting, setSelectedCutting] = useState<CuttingSubmission | null>(null);
  const [selectedBinCard, setSelectedBinCard] = useState<StorageBinCard | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [cuttingModalOpen, setCuttingModalOpen] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);

  const canViewDashboard = hasRole("supervisor") || isAdminOrHigher();

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.factory_id || canViewDashboard) return;

    // Users without dashboard access should go to their module home.
    if (hasRole("cutting")) {
      navigate("/cutting/submissions", { replace: true });
      return;
    }

    if (hasRole("storage")) {
      navigate("/storage", { replace: true });
      return;
    }

    navigate("/sewing/morning-targets", { replace: true });
  }, [authLoading, profile?.factory_id, canViewDashboard, navigate, hasRole]);

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
      // Fetch all active lines
      const { data: linesData } = await supabase
        .from('lines')
        .select('id, line_id, name')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true)
        .order('line_id');

      // Fetch sewing targets
      const { data: sewingTargetsData } = await supabase
        .from('sewing_targets')
        .select('*, lines(id, line_id, name), work_orders(po_number, buyer, style)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Fetch finishing targets
      const { data: finishingTargetsData } = await supabase
        .from('finishing_targets')
        .select('*, lines(id, line_id, name), work_orders(po_number, buyer, style)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Fetch sewing end of day (actuals)
      const { data: sewingActualsData, count: sewingCount } = await supabase
        .from('production_updates_sewing')
        .select('*, lines(id, line_id, name), work_orders(po_number, buyer, style)', { count: 'exact' })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Fetch finishing daily sheets (new structure)
      const { data: finishingDailySheetsData, count: finishingCount } = await supabase
        .from('finishing_daily_sheets')
        .select('*, lines(id, line_id, name), work_orders(po_number, buyer, style), finishing_hourly_logs(*)', { count: 'exact' })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('created_at', { ascending: false });

      // Fetch cutting actuals for today
      const { data: cuttingActualsData } = await supabase
        .from('cutting_actuals')
        .select('*, lines!cutting_actuals_line_id_fkey(id, line_id, name), work_orders(po_number, buyer, style, color)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Fetch storage bin cards with transactions from today
      const { data: binCardsData } = await supabase
        .from('storage_bin_cards')
        .select('*, work_orders(po_number, buyer, style), storage_bin_card_transactions(*)')
        .eq('factory_id', profile.factory_id)
        .order('updated_at', { ascending: false })
        .limit(20);

      // Blocker counts
      const { count: sewingBlockersCount } = await supabase
        .from('production_updates_sewing')
        .select('*', { count: 'exact', head: true })
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .eq('has_blocker', true)
        .neq('blocker_status', 'resolved');

      // Note: Daily sheets don't have blockers - finishing blockers now only come from legacy data
      const finishingBlockersCount = 0;

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
        line_uuid: t.line_id,
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
        line_uuid: t.line_id,
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
      // Filter out blocker-only submissions (output_qty = 0 with has_blocker = true)
      // These are standalone blocker reports and should only appear in the Blockers section
      const formattedSewingEOD: EndOfDaySubmission[] = (sewingActualsData || [])
        .filter(u => {
          // Exclude blocker-only submissions (no actual production data)
          const isBlockerOnly = u.output_qty === 0 && u.has_blocker === true;
          return !isBlockerOnly;
        })
        .map(u => ({
          id: u.id,
          type: 'sewing' as const,
          line_uuid: u.line_id,
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

      // Format finishing daily sheets (new structure with hourly logs)
      const formattedFinishingEOD: EndOfDaySubmission[] = (finishingDailySheetsData || [])
        .filter((sheet: any) => (sheet.finishing_hourly_logs || []).length > 0)
        .map((sheet: any) => {
          const logs = sheet.finishing_hourly_logs || [];
          const totalPoly = logs.reduce((sum: number, l: any) => sum + (l.poly_actual || 0), 0);
          const totalCarton = logs.reduce((sum: number, l: any) => sum + (l.carton_actual || 0), 0);
          
          return {
            id: sheet.id,
            type: 'finishing' as const,
            line_uuid: sheet.line_id,
            line_id: sheet.lines?.line_id || 'Unknown',
            line_name: sheet.lines?.name || sheet.lines?.line_id || 'Unknown',
            output: totalPoly, // Use total poly as the main output metric
            submitted_at: sheet.created_at,
            production_date: sheet.production_date,
            has_blocker: false,
            blocker_description: null,
            blocker_impact: null,
            blocker_owner: null,
            blocker_status: null,
            po_number: sheet.work_orders?.po_number || sheet.po_no || null,
            buyer: sheet.work_orders?.buyer || sheet.buyer || null,
            style: sheet.work_orders?.style || sheet.style || null,
            hours_logged: logs.length,
            total_poly: totalPoly,
            total_carton: totalCarton,
          };
        });

      // Format cutting submissions
      const formattedCutting: CuttingSubmission[] = (cuttingActualsData || []).map((c: any) => ({
        id: c.id,
        production_date: c.production_date,
        line_name: c.lines?.name || c.lines?.line_id || 'Unknown',
        buyer: c.work_orders?.buyer || c.buyer || null,
        style: c.work_orders?.style || c.style || null,
        po_number: c.work_orders?.po_number || c.po_no || null,
        colour: c.work_orders?.color || c.colour || null,
        order_qty: c.order_qty,
        man_power: c.man_power || null,
        marker_capacity: c.marker_capacity || null,
        lay_capacity: c.lay_capacity || null,
        cutting_capacity: c.cutting_capacity || null,
        under_qty: c.under_qty || null,
        day_cutting: c.day_cutting,
        total_cutting: c.total_cutting,
        day_input: c.day_input,
        total_input: c.total_input,
        balance: c.balance,
        submitted_at: c.submitted_at,
      }));

      // Format storage bin cards
      const formattedBinCards: StorageBinCard[] = (binCardsData || []).map((b: any) => {
        const transactions = (b.storage_bin_card_transactions || []).sort(
          (a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        );
        const latestBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance_qty : 0;
        
        return {
          id: b.id,
          buyer: b.work_orders?.buyer || b.buyer || null,
          style: b.work_orders?.style || b.style || null,
          po_number: b.work_orders?.po_number || null,
          supplier_name: b.supplier_name,
          description: b.description,
          construction: b.construction,
          color: b.color,
          width: b.width,
          package_qty: b.package_qty,
          prepared_by: b.prepared_by,
          transactions: transactions.map((t: any) => ({
            id: t.id,
            transaction_date: t.transaction_date,
            receive_qty: t.receive_qty,
            issue_qty: t.issue_qty,
            ttl_receive: t.ttl_receive,
            balance_qty: t.balance_qty,
            remarks: t.remarks,
            created_at: t.created_at,
          })),
          transaction_count: transactions.length,
          latest_balance: latestBalance,
        };
      });

      // Fetch active blockers
      const { data: sewingBlockers } = await supabase
        .from('production_updates_sewing')
        .select('id, blocker_description, blocker_impact, submitted_at, lines(line_id, name)')
        .eq('factory_id', profile.factory_id)
        .eq('has_blocker', true)
        .neq('blocker_status', 'resolved')
        .order('submitted_at', { ascending: false })
        .limit(5);

      // Note: The new finishing daily sheets don't have blockers
      // Only sewing blockers are tracked now

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

      // Calculate daily sewing output
      const daySewingOutput = (sewingActualsData || []).reduce((sum: number, u: any) => sum + (u.output_qty || 0), 0);

      // Calculate daily finishing output (total poly from hourly logs)
      const dayFinishingOutput = (finishingDailySheetsData || []).reduce((sum: number, sheet: any) => {
        const logs = sheet.finishing_hourly_logs || [];
        return sum + logs.reduce((logSum: number, l: any) => logSum + (l.poly_actual || 0), 0);
      }, 0);

      setStats({
        updatesToday: (sewingCount || 0) + (finishingCount || 0),
        blockersToday: (sewingBlockersCount || 0) + (finishingBlockersCount || 0),
        daySewingOutput,
        dayFinishingOutput,
        totalLines: linesCount || 0,
        activeWorkOrders: workOrdersCount || 0,
        avgEfficiency: 0,
      });

      
      setSewingTargets(formattedSewingTargets);
      setFinishingTargets(formattedFinishingTargets);
      setSewingEndOfDay(formattedSewingEOD);
      setFinishingEndOfDay(formattedFinishingEOD);
      setCuttingSubmissions(formattedCutting);
      setStorageBinCards(formattedBinCards);
      setAllLines(linesData || []);
      setActiveBlockers(blockers.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString(i18n.language === 'bn' ? 'bn-BD' : 'en-US', {
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
    <div className="p-3 md:p-4 lg:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString(i18n.language === 'bn' ? 'bn-BD' : 'en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
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
          title={t('dashboard.daySewingOutput')}
          value={stats.daySewingOutput.toLocaleString()}
          icon={Factory}
          variant="neutral"
          subtitle={t('dashboard.pcsProduced')}
        />
        <KPICard
          title={t('dashboard.dayFinishingOutput')}
          value={stats.dayFinishingOutput.toLocaleString()}
          icon={Package}
          variant="neutral"
          subtitle={t('dashboard.pcsFinished')}
        />
      </div>

      {/* Department Tabs */}
      <Tabs value={departmentTab} onValueChange={(v) => setDepartmentTab(v as 'sewing' | 'finishing' | 'cutting' | 'storage')} className="space-y-4">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1">
          <TabsTrigger value="storage" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2">
            <Archive className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden xs:inline">Storage</span>
          </TabsTrigger>
          <TabsTrigger value="cutting" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2">
            <Scissors className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden xs:inline">Cutting</span>
          </TabsTrigger>
          <TabsTrigger value="sewing" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2">
            <Factory className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden xs:inline">Sewing</span>
          </TabsTrigger>
          <TabsTrigger value="finishing" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2">
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden xs:inline">Finishing</span>
          </TabsTrigger>
        </TabsList>

        {/* Sewing Tab Content */}
        <TabsContent value="sewing" className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Morning Targets Card */}
            <Card>
              <CardHeader className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Crosshair className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Morning Targets
                </CardTitle>
                <div className="flex gap-1 sm:gap-2">
                  <Link to="/submissions?department=sewing&category=targets">
                    <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
                      View All
                      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1" />
                    </Button>
                  </Link>
                  <Link to="/sewing/morning-targets">
                    <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                      Add
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : sewingTargets.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {sewingTargets.map((target) => (
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
                    <Link to="/sewing/morning-targets">
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
              <CardHeader className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
                  End of Day
                </CardTitle>
                <div className="flex gap-1 sm:gap-2">
                  <Link to="/submissions?department=sewing&category=actuals">
                    <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
                      View All
                      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1" />
                    </Button>
                  </Link>
                  <Link to="/sewing/end-of-day">
                    <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                      Add
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : sewingEndOfDay.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {sewingEndOfDay.map((update) => (
                      <div
                        key={update.id}
                        onClick={() => {
                          setSelectedSubmission({
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
                          });
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
                          <p className="text-xs text-muted-foreground">output</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No end of day submissions</p>
                    <Link to="/sewing/end-of-day">
                      <Button variant="link" size="sm" className="mt-2">
                        Add end of day report
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Target vs Actual Comparison - Sewing Only */}
          <TargetVsActualComparison
            allLines={allLines}
            targets={sewingTargets.map(t => ({
              line_uuid: t.line_uuid,
              line_name: t.line_name,
              per_hour_target: t.per_hour_target,
              manpower_planned: t.manpower_planned,
            }))}
            actuals={sewingEndOfDay.map(a => ({
              line_uuid: a.line_uuid,
              line_name: a.line_name,
              output: a.output,
              manpower: a.manpower,
              has_blocker: a.has_blocker,
            }))}
            type="sewing"
            loading={loading}
          />
        </TabsContent>

        {/* Finishing Tab Content - Completely Different View */}
        <TabsContent value="finishing" className="space-y-4 md:space-y-6">
          <FinishingDashboard />
        </TabsContent>

        {/* Cutting Tab Content */}
        <TabsContent value="cutting" className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Scissors className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                Today's Cutting
              </CardTitle>
              <Link to="/submissions?department=cutting">
                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
                  View All
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1" />
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
              ) : cuttingSubmissions.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {cuttingSubmissions.map((cutting) => (
                    <div
                      key={cutting.id}
                      onClick={() => {
                        setSelectedCutting(cutting);
                        setCuttingModalOpen(true);
                      }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-warning/10">
                          <Scissors className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cutting.line_name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {cutting.po_number || 'No PO'} • {cutting.style || 'No style'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-lg">{cutting.day_cutting.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">cut today</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Scissors className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No cutting submissions today</p>
                  <Link to="/cutting/form">
                    <Button variant="link" size="sm" className="mt-2">
                      Add cutting submission
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Archive className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Bin Cards
              </CardTitle>
              <Link to="/submissions?department=storage">
                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
                  View All
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1" />
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
              ) : storageBinCards.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <div className="space-y-3 max-h-[500px] overflow-y-auto min-w-[320px]">
                    {storageBinCards.map((binCard) => (
                      <div
                        key={binCard.id}
                        onClick={() => {
                          setSelectedBinCard(binCard);
                          setStorageModalOpen(true);
                        }}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                            <Archive className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-nowrap">
                              <span className="font-medium whitespace-nowrap">{binCard.po_number || 'No PO'}</span>
                              {binCard.transaction_count > 0 && (
                                <StatusBadge variant="info" size="sm">
                                  {binCard.transaction_count} txns
                                </StatusBadge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-nowrap">
                              {binCard.buyer || 'No buyer'} • {binCard.style || 'No style'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-mono font-bold text-lg">{binCard.latest_balance.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">balance</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No bin cards found</p>
                  <Link to="/storage/bin-card">
                    <Button variant="link" size="sm" className="mt-2">
                      Create bin card
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
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

      <CuttingDetailModal
        cutting={selectedCutting}
        open={cuttingModalOpen}
        onOpenChange={setCuttingModalOpen}
      />

      <StorageBinCardDetailModal
        binCard={selectedBinCard}
        transactions={selectedBinCard?.transactions || []}
        open={storageModalOpen}
        onOpenChange={setStorageModalOpen}
      />
    </div>
  );
}
