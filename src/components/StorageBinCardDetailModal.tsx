import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Warehouse, Calendar, ArrowDownToLine, ArrowUpFromLine, Scale, Layers, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface Transaction {
  id: string;
  transaction_date: string;
  receive_qty: number;
  issue_qty: number;
  ttl_receive: number;
  balance_qty: number;
  remarks: string | null;
  created_at: string | null;
  batch_id?: string | null;
}

interface BinCardInfo {
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
}

interface StorageBinCardDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binCard: BinCardInfo | null;
  transactions: Transaction[];
  /** For grouped bin cards — multiple cards with their own transactions */
  groupedCards?: {
    groupName: string;
    cards: {
      binCard: BinCardInfo;
      transactions: Transaction[];
    }[];
  } | null;
  onDelete?: () => void;
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  const { t } = useTranslation();

  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">{t('modals.noTransactions')}</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('modals.date')}</TableHead>
            <TableHead className="text-right">{t('modals.receiveQty')}</TableHead>
            <TableHead className="text-right">{t('modals.ttlReceive')}</TableHead>
            <TableHead className="text-right">{t('modals.issueQty')}</TableHead>
            <TableHead className="text-right">{t('modals.balanceQty')}</TableHead>
            <TableHead>{t('modals.remarks')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn) => (
            <TableRow key={txn.id}>
              <TableCell className="font-medium">
                {format(new Date(txn.transaction_date), 'dd/MM/yyyy')}
                {txn.batch_id && (
                  <Badge variant="outline" className="ml-2 text-xs py-0">
                    <Layers className="h-3 w-3 mr-1" />{t('modals.bulk')}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {txn.receive_qty > 0 ? (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    +{txn.receive_qty}
                  </Badge>
                ) : '-'}
              </TableCell>
              <TableCell className="text-right font-mono">{txn.ttl_receive}</TableCell>
              <TableCell className="text-right">
                {txn.issue_qty > 0 ? (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    -{txn.issue_qty}
                  </Badge>
                ) : '-'}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">{txn.balance_qty}</TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                {txn.remarks || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryCards({ transactions }: { transactions: Transaction[] }) {
  const { t } = useTranslation();
  const latestBalance = transactions.length > 0
    ? transactions[transactions.length - 1].balance_qty
    : 0;
  const totalReceived = transactions.reduce((sum, t) => sum + t.receive_qty, 0);
  const totalIssued = transactions.reduce((sum, t) => sum + t.issue_qty, 0);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
        <ArrowDownToLine className="h-5 w-5 text-success" />
        <div>
          <p className="text-xs text-muted-foreground">{t('modals.totalReceived')}</p>
          <p className="text-lg font-bold text-success">{totalReceived.toLocaleString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <ArrowUpFromLine className="h-5 w-5 text-destructive" />
        <div>
          <p className="text-xs text-muted-foreground">{t('modals.totalIssued')}</p>
          <p className="text-lg font-bold text-destructive">{totalIssued.toLocaleString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
        <Scale className="h-5 w-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">{t('modals.currentBalance')}</p>
          <p className="text-lg font-bold text-primary">{latestBalance.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

export function StorageBinCardDetailModal({
  open,
  onOpenChange,
  binCard,
  transactions,
  groupedCards,
  onDelete,
}: StorageBinCardDetailModalProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteBinCard = async (cardId: string) => {
    setDeleting(true);
    try {
      // Delete transactions first, then the bin card
      const { error: txnError } = await supabase
        .from("storage_bin_card_transactions")
        .delete()
        .eq("bin_card_id", cardId);
      if (txnError) throw txnError;

      const { error } = await supabase
        .from("storage_bin_cards")
        .delete()
        .eq("id", cardId);
      if (error) throw error;

      toast.success("Bin card deleted successfully");
      setConfirmDelete(false);
      onOpenChange(false);
      onDelete?.();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete bin card");
    } finally {
      setDeleting(false);
    }
  };

  // Grouped view
  if (groupedCards) {
    const allTxns = groupedCards.cards.flatMap(c => c.transactions);
    const uniqueBuyers = [...new Set(groupedCards.cards.map(c => c.binCard.buyer).filter(Boolean))];
    const uniqueSuppliers = [...new Set(groupedCards.cards.map(c => c.binCard.supplier_name).filter(Boolean))];
    const poNumbers = groupedCards.cards.map(c => c.binCard.po_number).filter(Boolean);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-orange-600" />
              {groupedCards.groupName}
            </DialogTitle>
          </DialogHeader>

          {/* Group Header Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('modals.pos')}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {poNumbers.map((po, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{po}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('modals.buyer')}</p>
              <p className="font-medium">{uniqueBuyers.join(", ") || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('modals.supplier')}</p>
              <p className="font-medium">{uniqueSuppliers.join(", ") || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('modals.preparedBy')}</p>
              <p className="font-medium">{groupedCards.cards[0]?.binCard.prepared_by || '-'}</p>
            </div>
          </div>

          <Separator />

          <SummaryCards transactions={allTxns} />

          <Separator />

          {/* Individual PO sections */}
          <div className="space-y-6">
            {groupedCards.cards.map(({ binCard: card, transactions: txns }) => (
              <div key={card.id}>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-orange-600" />
                  {card.po_number}
                  {card.buyer && <span className="text-muted-foreground font-normal">— {card.buyer}</span>}
                  {card.style && <Badge variant="outline" className="text-xs">{card.style}</Badge>}
                </h4>
                <TransactionTable transactions={txns} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Single bin card view
  if (!binCard) return null;

  const latestBalance = transactions.length > 0 
    ? transactions[transactions.length - 1].balance_qty 
    : 0;
  
  const totalReceived = transactions.reduce((sum, t) => sum + t.receive_qty, 0);
  const totalIssued = transactions.reduce((sum, t) => sum + t.issue_qty, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-orange-600" />
            {t('modals.binCardDetails')}
          </DialogTitle>
        </DialogHeader>

        {/* Header Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.poNumber')}</p>
            <p className="font-medium">{binCard.po_number || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.buyer')}</p>
            <p className="font-medium">{binCard.buyer || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.style')}</p>
            <p className="font-medium">{binCard.style || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.color')}</p>
            <p className="font-medium">{binCard.color || '-'}</p>
          </div>
        </div>

        <Separator />

        {/* Additional Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.supplier')}</p>
            <p className="font-medium text-sm">{binCard.supplier_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.description')}</p>
            <p className="font-medium text-sm">{binCard.description || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.construction')}</p>
            <p className="font-medium text-sm">{binCard.construction || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.width')}</p>
            <p className="font-medium text-sm">{binCard.width || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.packageQty')}</p>
            <p className="font-medium text-sm">{binCard.package_qty || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('modals.preparedBy')}</p>
            <p className="font-medium text-sm">{binCard.prepared_by || '-'}</p>
          </div>
        </div>

        <Separator />

        <SummaryCards transactions={transactions} />

        {/* Transactions Table */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('modals.transactionHistoryCount', { count: transactions.length })}
          </h4>
          <TransactionTable transactions={transactions} />
        </div>

        {/* Admin Delete */}
        {onDelete && (
          <div className="flex justify-end pt-2 border-t">
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              {t('modals.delete')}
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Delete Confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bin card?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the bin card and all its transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('modals.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => binCard && handleDeleteBinCard(binCard.id)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : t('modals.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
