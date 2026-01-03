import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Clock, Factory, Package, AlertTriangle, User, CalendarDays, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EditSubmissionModal } from "./EditSubmissionModal";

interface SewingSubmission {
  id: string;
  type: 'sewing';
  line_name: string;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  output_qty: number;
  target_qty: number | null;
  manpower: number | null;
  reject_qty: number | null;
  rework_qty: number | null;
  stage_progress: number | null;
  ot_hours: number | null;
  ot_manpower: number | null;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  blocker_status: string | null;
  notes: string | null;
  submitted_at: string;
  production_date: string;
}

interface FinishingSubmission {
  id: string;
  type: 'finishing';
  line_name: string;
  po_number: string | null;
  buyer_name: string | null;
  style_no: string | null;
  item_name: string | null;
  order_quantity: number | null;
  unit_name: string | null;
  floor_name: string | null;
  m_power: number | null;
  per_hour_target: number | null;
  day_qc_pass: number | null;
  total_qc_pass: number | null;
  day_poly: number | null;
  total_poly: number | null;
  average_production: number | null;
  day_over_time: number | null;
  total_over_time: number | null;
  day_hour: number | null;
  total_hour: number | null;
  day_carton: number | null;
  total_carton: number | null;
  remarks: string | null;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  blocker_status: string | null;
  submitted_at: string;
  production_date: string;
}

type Submission = SewingSubmission | FinishingSubmission;

interface SubmissionDetailModalProps {
  submission: Submission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

export function SubmissionDetailModal({ submission, open, onOpenChange, onDeleted, onUpdated }: SubmissionDetailModalProps) {
  const { isAdminOrHigher } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!submission) return null;

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      dateStyle: 'medium',
    });
  };

  const isSewing = submission.type === 'sewing';
  const isAdmin = isAdminOrHigher();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const tableName = isSewing ? 'production_updates_sewing' : 'production_updates_finishing';
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', submission.id);

      if (error) throw error;

      toast.success("Submission deleted successfully");
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (error: any) {
      console.error('Error deleting submission:', error);
      toast.error(error.message || "Failed to delete submission");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSaved = () => {
    setEditModalOpen(false);
    onUpdated?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isSewing ? (
                <Factory className="h-5 w-5 text-primary" />
              ) : (
                <Package className="h-5 w-5 text-info" />
              )}
              {submission.line_name}
              <StatusBadge variant={submission.type} size="sm">{submission.type}</StatusBadge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Meta Info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                {formatDate(submission.production_date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDateTime(submission.submitted_at)}
              </span>
            </div>

            {/* Order Info */}
            {submission.po_number && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">Order Details</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">PO: </span>
                    <span className="font-mono">{submission.po_number}</span>
                  </div>
                  {isSewing && (submission as SewingSubmission).buyer && (
                    <div>
                      <span className="text-muted-foreground">Buyer: </span>
                      <span>{(submission as SewingSubmission).buyer}</span>
                    </div>
                  )}
                  {!isSewing && (submission as FinishingSubmission).buyer_name && (
                    <div>
                      <span className="text-muted-foreground">Buyer: </span>
                      <span>{(submission as FinishingSubmission).buyer_name}</span>
                    </div>
                  )}
                  {isSewing && (submission as SewingSubmission).style && (
                    <div>
                      <span className="text-muted-foreground">Style: </span>
                      <span>{(submission as SewingSubmission).style}</span>
                    </div>
                  )}
                  {!isSewing && (submission as FinishingSubmission).style_no && (
                    <div>
                      <span className="text-muted-foreground">Style: </span>
                      <span>{(submission as FinishingSubmission).style_no}</span>
                    </div>
                  )}
                  {!isSewing && (submission as FinishingSubmission).item_name && (
                    <div>
                      <span className="text-muted-foreground">Item: </span>
                      <span>{(submission as FinishingSubmission).item_name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Production Metrics */}
            <div>
              <p className="text-sm font-medium mb-2">Production Metrics</p>
              <div className="grid grid-cols-2 gap-3">
                {isSewing ? (
                  <>
                    <MetricCard label="Output" value={(submission as SewingSubmission).output_qty} />
                    <MetricCard label="Target" value={(submission as SewingSubmission).target_qty} />
                    <MetricCard label="Manpower" value={(submission as SewingSubmission).manpower} />
                    <MetricCard label="Progress" value={(submission as SewingSubmission).stage_progress} suffix="%" />
                    <MetricCard label="Reject" value={(submission as SewingSubmission).reject_qty} />
                    <MetricCard label="Rework" value={(submission as SewingSubmission).rework_qty} />
                    <MetricCard label="OT Hours" value={(submission as SewingSubmission).ot_hours} />
                    <MetricCard label="OT Manpower" value={(submission as SewingSubmission).ot_manpower} />
                  </>
                ) : (
                  <>
                    <MetricCard label="M Power" value={(submission as FinishingSubmission).m_power} />
                    <MetricCard label="Per Hour Target" value={(submission as FinishingSubmission).per_hour_target} />
                    <MetricCard label="Day QC Pass" value={(submission as FinishingSubmission).day_qc_pass} />
                    <MetricCard label="Total QC Pass" value={(submission as FinishingSubmission).total_qc_pass} />
                    <MetricCard label="Day Poly" value={(submission as FinishingSubmission).day_poly} />
                    <MetricCard label="Total Poly" value={(submission as FinishingSubmission).total_poly} />
                    <MetricCard label="Avg Production" value={(submission as FinishingSubmission).average_production} />
                    <MetricCard label="Day OT" value={(submission as FinishingSubmission).day_over_time} />
                    <MetricCard label="Total OT" value={(submission as FinishingSubmission).total_over_time} />
                    <MetricCard label="Day Hour" value={(submission as FinishingSubmission).day_hour} />
                    <MetricCard label="Total Hour" value={(submission as FinishingSubmission).total_hour} />
                    <MetricCard label="Day Carton" value={(submission as FinishingSubmission).day_carton} />
                    <MetricCard label="Total Carton" value={(submission as FinishingSubmission).total_carton} />
                    <MetricCard label="Order Qty" value={(submission as FinishingSubmission).order_quantity} />
                  </>
                )}
              </div>
            </div>

            {/* Blocker Section */}
            {submission.has_blocker && (
              <div className={`p-3 rounded-lg border ${
                submission.blocker_impact === 'critical' ? 'border-destructive/30 bg-destructive/5' :
                submission.blocker_impact === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                submission.blocker_impact === 'medium' ? 'border-warning/30 bg-warning/5' :
                'border-success/30 bg-success/5'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="font-medium text-sm">Blocker</span>
                  {submission.blocker_impact && (
                    <StatusBadge variant={submission.blocker_impact as any} size="sm">
                      {submission.blocker_impact}
                    </StatusBadge>
                  )}
                  {submission.blocker_status && (
                    <StatusBadge variant={submission.blocker_status === 'resolved' ? 'success' : 'default'} size="sm">
                      {submission.blocker_status}
                    </StatusBadge>
                  )}
                </div>
                <p className="text-sm mb-2">{submission.blocker_description || 'No description'}</p>
                {submission.blocker_owner && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Owner: {submission.blocker_owner}
                  </p>
                )}
              </div>
            )}

            {/* Notes/Remarks */}
            {(isSewing ? (submission as SewingSubmission).notes : (submission as FinishingSubmission).remarks) && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">
                  {isSewing ? (submission as SewingSubmission).notes : (submission as FinishingSubmission).remarks}
                </p>
              </div>
            )}
          </div>

          {/* Admin Actions */}
          {isAdmin && (
            <DialogFooter className="mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {isSewing ? 'sewing' : 'finishing'} submission? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <EditSubmissionModal
        submission={submission}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSaved={handleEditSaved}
      />
    </>
  );
}

function MetricCard({ label, value, suffix = '' }: { label: string; value: number | null | undefined; suffix?: string }) {
  return (
    <div className="p-2 bg-muted/50 rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold">
        {value != null ? `${value.toLocaleString()}${suffix}` : '-'}
      </p>
    </div>
  );
}
