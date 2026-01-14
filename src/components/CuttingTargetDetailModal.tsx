import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Target } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface CuttingTargetDetailModalProps {
  target: {
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
    day_cutting: number | null;
    day_input: number | null;
    submitted_at: string | null;
    submitted_by?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CuttingTargetDetailModal({ target, open, onOpenChange }: CuttingTargetDetailModalProps) {
  if (!target) return null;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Cutting Target Details</span>
            <Badge variant="outline" className="bg-primary/10 ml-2">
              Target
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
              <p className="font-semibold">{formatDate(target.production_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Line</p>
              <p className="font-semibold">{target.line_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Buyer</p>
              <p className="font-semibold">{target.buyer || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Style</p>
              <p className="font-semibold">{target.style || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">PO Number</p>
              <p className="font-semibold">{target.po_number || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Colour</p>
              <p className="font-semibold">{target.colour || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Order Qty</p>
              <p className="font-semibold">{target.order_qty?.toLocaleString() || "-"}</p>
            </div>
          </div>

          {/* Target Capacities Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-primary">Target Capacities</h4>
            <div className="grid grid-cols-2 gap-4 p-3 bg-primary/5 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Man Power</p>
                <p className="font-semibold text-lg">{target.man_power || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Marker Capacity</p>
                <p className="font-semibold text-lg">{target.marker_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Lay Capacity</p>
                <p className="font-semibold text-lg">{target.lay_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Cutting Capacity</p>
                <p className="font-semibold text-lg text-primary">{target.cutting_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Under Qty</p>
                <p className="font-semibold">{target.under_qty?.toLocaleString() || "-"}</p>
              </div>
            </div>
          </div>

          {/* Target Daily Output Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-success">Target Daily Output</h4>
            <div className="grid grid-cols-2 gap-4 p-3 bg-success/5 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Day Cutting Target</p>
                <p className="font-semibold text-xl">{target.day_cutting?.toLocaleString() || "0"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Day Input Target</p>
                <p className="font-semibold text-xl text-success">{target.day_input?.toLocaleString() || "0"}</p>
              </div>
            </div>
          </div>

          {/* Submitted Info */}
          <p className="text-xs text-muted-foreground">
            Submitted: {formatDateTime(target.submitted_at)}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}