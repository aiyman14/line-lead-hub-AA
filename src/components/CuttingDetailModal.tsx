import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Scissors, Package, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface CuttingDetailModalProps {
  cutting: {
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
    leftover_recorded?: boolean | null;
    leftover_type?: string | null;
    leftover_unit?: string | null;
    leftover_quantity?: number | null;
    leftover_notes?: string | null;
    leftover_location?: string | null;
    leftover_photo_urls?: string[] | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CuttingDetailModal({ cutting, open, onOpenChange }: CuttingDetailModalProps) {
  if (!cutting) return null;

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
            <Scissors className="h-5 w-5 text-warning" />
            Submission Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
              <p className="font-semibold">{formatDate(cutting.production_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Line</p>
              <p className="font-semibold">{cutting.line_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Buyer</p>
              <p className="font-semibold">{cutting.buyer || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Style</p>
              <p className="font-semibold">{cutting.style || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">PO Number</p>
              <p className="font-semibold">{cutting.po_number || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Colour</p>
              <p className="font-semibold">{cutting.colour || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Order Qty</p>
              <p className="font-semibold">{cutting.order_qty?.toLocaleString() || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Man Power</p>
              <p className="font-semibold">{cutting.man_power || "-"}</p>
            </div>
          </div>

          {/* Capacity Planning Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Capacity Planning</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Marker Capacity</p>
                <p className="font-semibold">{cutting.marker_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Lay Capacity</p>
                <p className="font-semibold">{cutting.lay_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Cutting Capacity</p>
                <p className="font-semibold text-primary">{cutting.cutting_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Under Qty</p>
                <p className="font-semibold">{cutting.under_qty?.toLocaleString() || "-"}</p>
              </div>
            </div>
          </div>

          {/* Actuals Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Actuals</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Day Cutting</p>
                <p className="font-semibold">{cutting.day_cutting.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Cutting</p>
                <p className="font-semibold">{cutting.total_cutting?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Day Input</p>
                <p className="font-semibold text-success">{cutting.day_input.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Input</p>
                <p className="font-semibold text-success">{cutting.total_input?.toLocaleString() || "-"}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance</p>
              <p className="text-xl font-bold">{cutting.balance?.toLocaleString() || "-"}</p>
            </div>
          </div>

          {/* Left Over / Fabric Saved Section */}
          {cutting.leftover_recorded && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Left Over / Fabric Saved
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Type</p>
                  <p className="font-semibold">{cutting.leftover_type || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Quantity</p>
                  <p className="font-semibold">
                    {cutting.leftover_quantity?.toLocaleString() || "-"} {cutting.leftover_unit || ""}
                  </p>
                </div>
                {cutting.leftover_location && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Stored Location</p>
                    <p className="font-semibold">{cutting.leftover_location}</p>
                  </div>
                )}
                {cutting.leftover_notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Notes</p>
                    <p className="font-semibold text-sm">{cutting.leftover_notes}</p>
                  </div>
                )}
              </div>
              {cutting.leftover_photo_urls && cutting.leftover_photo_urls.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {cutting.leftover_photo_urls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 h-16 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img src={url} alt={`Leftover ${index + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submitted Info */}
          <p className="text-xs text-muted-foreground">
            Submitted: {formatDateTime(cutting.submitted_at)}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
