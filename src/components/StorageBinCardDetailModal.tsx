import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Calendar, ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  transaction_date: string;
  receive_qty: number;
  issue_qty: number;
  ttl_receive: number;
  balance_qty: number;
  remarks: string | null;
  created_at: string | null;
}

interface StorageBinCardDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binCard: {
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
  } | null;
  transactions: Transaction[];
}

export function StorageBinCardDetailModal({
  open,
  onOpenChange,
  binCard,
  transactions,
}: StorageBinCardDetailModalProps) {
  if (!binCard) return null;

  const latestBalance = transactions.length > 0 
    ? transactions[transactions.length - 1].balance_qty 
    : 0;
  
  const totalReceived = transactions.reduce((sum, t) => sum + t.receive_qty, 0);
  const totalIssued = transactions.reduce((sum, t) => sum + t.issue_qty, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Bin Card Details
          </DialogTitle>
        </DialogHeader>

        {/* Header Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">PO Number</p>
            <p className="font-medium">{binCard.po_number || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Buyer</p>
            <p className="font-medium">{binCard.buyer || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Style</p>
            <p className="font-medium">{binCard.style || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Color</p>
            <p className="font-medium">{binCard.color || '-'}</p>
          </div>
        </div>

        <Separator />

        {/* Additional Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Supplier</p>
            <p className="font-medium text-sm">{binCard.supplier_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="font-medium text-sm">{binCard.description || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Construction</p>
            <p className="font-medium text-sm">{binCard.construction || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Width</p>
            <p className="font-medium text-sm">{binCard.width || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Package Qty</p>
            <p className="font-medium text-sm">{binCard.package_qty || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Prepared By</p>
            <p className="font-medium text-sm">{binCard.prepared_by || '-'}</p>
          </div>
        </div>

        <Separator />

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
            <ArrowDownToLine className="h-5 w-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Total Received</p>
              <p className="text-lg font-bold text-success">{totalReceived.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <ArrowUpFromLine className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Total Issued</p>
              <p className="text-lg font-bold text-destructive">{totalIssued.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Scale className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-lg font-bold text-primary">{latestBalance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Transaction History ({transactions.length})
          </h4>
          
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions recorded yet</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Receive</TableHead>
                    <TableHead className="text-right">Issue</TableHead>
                    <TableHead className="text-right">Total Receive</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-medium">
                        {format(new Date(txn.transaction_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.receive_qty > 0 ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            +{txn.receive_qty}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.issue_qty > 0 ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                            -{txn.issue_qty}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{txn.ttl_receive}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{txn.balance_qty}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {txn.remarks || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
