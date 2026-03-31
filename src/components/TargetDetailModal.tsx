import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Clock, CalendarDays, Crosshair, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTimeInTimezone } from "@/lib/date-utils";

interface TargetBase {
  id: string;
  type: 'sewing' | 'finishing';
  line_name: string;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  per_hour_target: number;
  order_qty?: number | null;
  remarks?: string | null;
  submitted_at: string;
  production_date: string;
}

interface SewingTargetFields {
  type: 'sewing';
  manpower_planned?: number | null;
  ot_hours_planned?: number | null;
  stage_name?: string | null;
  planned_stage_progress?: number | null;
  next_milestone?: string | null;
  estimated_ex_factory?: string | null;
}

interface FinishingTargetFields {
  type: 'finishing';
  m_power_planned?: number | null;
  day_hour_planned?: number | null;
  day_over_time_planned?: number | null;
}

type Target = TargetBase & (SewingTargetFields | FinishingTargetFields) | (TargetBase & { type: 'sewing' | 'finishing' });

interface TargetDetailModalProps {
  target: Target | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TargetDetailModal({ target, open, onOpenChange }: TargetDetailModalProps) {
  const { t } = useTranslation();
  const { factory } = useAuth();

  // Helper to format datetime in factory timezone
  const formatDateTime = (dateString: string) => {
    const timezone = factory?.timezone || "Asia/Dhaka";
    return formatDateTimeInTimezone(dateString, timezone);
  };

  if (!target) return null;

  const isSewing = target.type === 'sewing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" />
            {target.line_name}
            <StatusBadge variant={target.type} size="sm">{target.type}</StatusBadge>
            <StatusBadge variant="default" size="sm">{t('modals.target')}</StatusBadge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {formatDate(target.production_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDateTime(target.submitted_at)}
            </span>
          </div>

          {/* Order Info */}
          {target.po_number && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">{t('modals.orderDetails')}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('modals.poNumber')}: </span>
                  <span className="font-mono">{target.po_number}</span>
                </div>
                {target.buyer && (
                  <div>
                    <span className="text-muted-foreground">{t('modals.buyer')}: </span>
                    <span>{target.buyer}</span>
                  </div>
                )}
                {target.style && (
                  <div>
                    <span className="text-muted-foreground">{t('modals.style')}: </span>
                    <span>{target.style}</span>
                  </div>
                )}
                {target.order_qty && (
                  <div>
                    <span className="text-muted-foreground">{t('modals.orderQty')}: </span>
                    <span>{target.order_qty.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Target Metrics */}
          <div>
            <p className="text-sm font-medium mb-2">{t('modals.targetMetrics')}</p>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label={t('modals.perHourTarget')} value={target.per_hour_target} highlight />
              {isSewing ? (
                <>
                  <MetricCard label={t('modals.manpowerPlanned')} value={(target as any).manpower_planned} icon={<Users className="h-3 w-3" />} />
                  <MetricCard label={t('modals.otHoursPlanned')} value={(target as any).ot_hours_planned} />
                  <MetricCard label={t('modals.stageProgress')} value={(target as any).planned_stage_progress} suffix="%" />
                </>
              ) : (
                <>
                  <MetricCard label={t('modals.mPowerPlanned')} value={(target as any).m_power_planned} icon={<Users className="h-3 w-3" />} />
                  <MetricCard label={t('modals.dayHoursPlanned')} value={(target as any).day_hour_planned} />
                  <MetricCard label={t('modals.otHoursPlanned')} value={(target as any).day_over_time_planned} />
                </>
              )}
            </div>
          </div>

          {/* Sewing specific fields */}
          {isSewing && (
            <>
              {((target as any).stage_name || (target as any).next_milestone) && (
                <div className="p-3 bg-primary/10 rounded-lg flex gap-6">
                  {(target as any).stage_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t('modals.plannedStage')}</p>
                      <p className="font-semibold">{(target as any).stage_name}</p>
                    </div>
                  )}
                  {(target as any).next_milestone && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t('modals.nextMilestone')}</p>
                      <p className="font-semibold">{(target as any).next_milestone}</p>
                    </div>
                  )}
                </div>
              )}
              {(target as any).estimated_ex_factory && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">{t('modals.estimatedExFactory')}</p>
                  <p className="text-sm">{formatDate((target as any).estimated_ex_factory!)}</p>
                </div>
              )}
            </>
          )}

          {/* Remarks */}
          {target.remarks && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">{t('modals.remarks')}</p>
              <p className="text-sm text-muted-foreground">{target.remarks}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ 
  label, 
  value, 
  suffix = '', 
  highlight = false,
  icon
}: { 
  label: string; 
  value: number | null | undefined; 
  suffix?: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`font-mono font-semibold ${highlight ? 'text-primary' : ''}`}>
        {value != null ? `${value.toLocaleString()}${suffix}` : '-'}
      </p>
    </div>
  );
}
