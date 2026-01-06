import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { Loader2, Search, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface BinCard {
  id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  supplier_name: string | null;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  work_orders: {
    po_number: string;
    buyer: string;
    style: string;
    item: string | null;
  };
  latestBalance?: number;
  totalReceived?: number;
  totalIssued?: number;
}

interface StorageSubmissionsTableProps {
  factoryId: string;
  dateRange: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  lowStockThreshold?: number;
}

export function StorageSubmissionsTable({
  factoryId,
  dateRange,
  searchTerm,
  onSearchChange,
  lowStockThreshold = 10,
}: StorageSubmissionsTableProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [binCards, setBinCards] = useState<BinCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<BinCard | null>(null);

  useEffect(() => {
    fetchData();
  }, [factoryId, dateRange]);

  async function fetchData() {
    setLoading(true);
    const endDate = new Date();
    const startDate = subDays(endDate, parseInt(dateRange));

    try {
      const { data: cardsData, error } = await supabase
        .from("storage_bin_cards")
        .select(`
          id,
          work_order_id,
          buyer,
          style,
          supplier_name,
          description,
          color,
          created_at,
          updated_at,
          work_orders!inner (
            po_number,
            buyer,
            style,
            item
          )
        `)
        .eq("factory_id", factoryId)
        .gte("created_at", format(startDate, "yyyy-MM-dd"))
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const cardIds = (cardsData || []).map(c => c.id);
      const latestByCard = new Map<string, { balance: number; received: number; issued: number }>();

      if (cardIds.length > 0) {
        const { data: allTxns } = await supabase
          .from("storage_bin_card_transactions")
          .select("bin_card_id, balance_qty, receive_qty, issue_qty, transaction_date, created_at")
          .eq("factory_id", factoryId)
          .in("bin_card_id", cardIds)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false });

        const txnTotals = new Map<string, { received: number; issued: number }>();
        
        (allTxns || []).forEach(txn => {
          if (!latestByCard.has(txn.bin_card_id)) {
            latestByCard.set(txn.bin_card_id, { balance: txn.balance_qty, received: 0, issued: 0 });
          }
          
          const current = txnTotals.get(txn.bin_card_id) || { received: 0, issued: 0 };
          current.received += txn.receive_qty || 0;
          current.issued += txn.issue_qty || 0;
          txnTotals.set(txn.bin_card_id, current);
        });

        txnTotals.forEach((totals, cardId) => {
          const entry = latestByCard.get(cardId);
          if (entry) {
            entry.received = totals.received;
            entry.issued = totals.issued;
          }
        });
      }

      const cardsWithBalance = (cardsData || []).map(card => ({
        ...card,
        latestBalance: latestByCard.get(card.id)?.balance,
        totalReceived: latestByCard.get(card.id)?.received || 0,
        totalIssued: latestByCard.get(card.id)?.issued || 0,
      })) as BinCard[];

      setBinCards(cardsWithBalance);
    } catch (error) {
      console.error("Error fetching storage data:", error);
      toast.error("Failed to load storage data");
    } finally {
      setLoading(false);
    }
  }

  const filteredCards = useMemo(() => {
    if (!searchTerm) return binCards;
    const term = searchTerm.toLowerCase();
    return binCards.filter(card =>
      card.work_orders.po_number.toLowerCase().includes(term) ||
      card.work_orders.buyer.toLowerCase().includes(term) ||
      card.work_orders.style.toLowerCase().includes(term) ||
      (card.description?.toLowerCase().includes(term))
    );
  }, [binCards, searchTerm]);

  const stats = useMemo(() => {
    const totalBalance = binCards.reduce((sum, c) => sum + (c.latestBalance || 0), 0);
    const lowStock = binCards.filter(c => c.latestBalance !== undefined && c.latestBalance <= lowStockThreshold).length;
    const totalReceived = binCards.reduce((sum, c) => sum + (c.totalReceived || 0), 0);
    const totalIssued = binCards.reduce((sum, c) => sum + (c.totalIssued || 0), 0);
    return { total: binCards.length, totalBalance, lowStock, totalReceived, totalIssued };
  }, [binCards, lowStockThreshold]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Bin Cards</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total Balance</p>
            <p className="text-xl font-bold">{stats.totalBalance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total Received</p>
            <p className="text-xl font-bold">{stats.totalReceived.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Low Stock</p>
            <p className="text-xl font-bold">{stats.lowStock}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by PO, buyer, style..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Bin Cards
            <Badge variant="secondary" className="ml-2">{filteredCards.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Created</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No bin cards found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCards.map((card) => (
                    <TableRow
                      key={card.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/storage?card=${card.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {format(new Date(card.created_at), "MMM d")}
                      </TableCell>
                      <TableCell className="font-medium">{card.work_orders.po_number}</TableCell>
                      <TableCell>{card.work_orders.buyer}</TableCell>
                      <TableCell>{card.work_orders.style}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {card.totalReceived?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">
                        {card.totalIssued?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {card.latestBalance !== undefined ? (
                          <Badge variant={card.latestBalance <= lowStockThreshold ? "destructive" : "secondary"}>
                            {card.latestBalance.toLocaleString()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
