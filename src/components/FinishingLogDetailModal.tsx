import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Scissors, CheckCircle, Shirt, CircleDot, Flame, Package, Box, Archive, FileText, Calendar, User } from "lucide-react";

interface FinishingDailyLog {
  id: string;
  production_date: string;
  line_id: string;
  work_order_id: string | null;
  log_type: "TARGET" | "OUTPUT";
  shift: string | null;
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
  remarks: string | null;
  submitted_at: string;
  is_locked: boolean;
  line: {
    line_id: string;
    name: string | null;
  } | null;
  work_order: {
    po_number: string;
    style: string;
    buyer: string;
  } | null;
}

interface FinishingLogDetailModalProps {
  log: FinishingDailyLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROCESS_ITEMS = [
  { key: "thread_cutting", label: "Thread Cutting", icon: Scissors },
  { key: "inside_check", label: "Inside Check", icon: CheckCircle },
  { key: "top_side_check", label: "Top Side Check", icon: Shirt },
  { key: "buttoning", label: "Buttoning", icon: CircleDot },
  { key: "iron", label: "Iron", icon: Flame },
  { key: "get_up", label: "Get-up", icon: Package },
  { key: "poly", label: "Poly", icon: Box },
  { key: "carton", label: "Carton", icon: Archive },
] as const;

export function FinishingLogDetailModal({ log, open, onOpenChange }: FinishingLogDetailModalProps) {
  if (!log) return null;

  const calculateTotal = () => {
    return (log.poly || 0) + (log.carton || 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {log.log_type === "TARGET" ? "Daily Target Details" : "Daily Output Details"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(parseISO(log.production_date), "MMM dd, yyyy")}</span>
            </div>
            <div>
              <Badge variant={log.log_type === "TARGET" ? "secondary" : "default"}>
                {log.log_type}
              </Badge>
            </div>
          </div>

          {/* Line & PO */}
          <div className="border rounded-lg p-3 space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Line:</span>
              <p className="font-medium">{log.line?.name || log.line?.line_id || "—"}</p>
            </div>
            {log.work_order && (
              <>
                <div>
                  <span className="text-sm text-muted-foreground">PO Number:</span>
                  <p className="font-medium">{log.work_order.po_number}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Style:</span>
                    <p className="font-medium">{log.work_order.style}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Buyer:</span>
                    <p className="font-medium">{log.work_order.buyer}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Process Values */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">Process Values</span>
              <span className="text-sm text-muted-foreground">
                Total: {calculateTotal().toLocaleString()} pcs
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PROCESS_ITEMS.map((item) => {
                const Icon = item.icon;
                const value = log[item.key as keyof typeof log] as number;
                return (
                  <div key={item.key} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="font-medium">{value || 0}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remarks */}
          {log.remarks && (
            <div className="border rounded-lg p-3">
              <span className="text-sm text-muted-foreground">Remarks:</span>
              <p className="mt-1">{log.remarks}</p>
            </div>
          )}

          {/* Submitted At */}
          <div className="text-xs text-muted-foreground text-center">
            Submitted: {format(parseISO(log.submitted_at), "MMM dd, yyyy 'at' h:mm a")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
