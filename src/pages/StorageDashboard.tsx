import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Search, FileText, AlertTriangle, Download, Calendar } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

interface BinCardWithWorkOrder {
  id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  supplier_name: string | null;
  description: string | null;
  color: string | null;
  width: string | null;
  package_qty: string | null;
  construction: string | null;
  prepared_by: string | null;
  created_at: string;
  updated_at: string;
  work_orders: {
    po_number: string;
    buyer: string;
    style: string;
    item: string | null;
  };
}

interface Transaction {
  id: string;
  transaction_date: string;
  receive_qty: number;
  issue_qty: number;
  ttl_receive: number;
  balance_qty: number;
  remarks: string | null;
  created_at: string;
}

interface DashboardStats {
  todayTransactions: number;
  todayBinCardsUpdated: number;
  totalBinCards: number;
  lowBalanceCards: number;
}

export default function StorageDashboard() {
  const { profile, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todayTransactions: 0,
    todayBinCardsUpdated: 0,
    totalBinCards: 0,
    lowBalanceCards: 0,
  });
  const [binCards, setBinCards] = useState<BinCardWithWorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState<BinCardWithWorkOrder | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxn, setLoadingTxn] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const canAccess = isAdminOrHigher();

  useEffect(() => {
    if (profile?.factory_id && canAccess) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [profile?.factory_id, canAccess]);

  async function fetchData() {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Fetch all bin cards
      const { data: cardsData, error: cardsError } = await supabase
        .from("storage_bin_cards")
        .select(`
          id,
          work_order_id,
          buyer,
          style,
          supplier_name,
          description,
          color,
          width,
          package_qty,
          construction,
          prepared_by,
          created_at,
          updated_at,
          work_orders!inner (
            po_number,
            buyer,
            style,
            item
          )
        `)
        .eq("factory_id", profile!.factory_id)
        .order("updated_at", { ascending: false });
      
      if (cardsError) throw cardsError;
      setBinCards((cardsData || []) as BinCardWithWorkOrder[]);
      
      // Fetch today's transactions count
      const { count: todayTxnCount } = await supabase
        .from("storage_bin_card_transactions")
        .select("id", { count: "exact", head: true })
        .eq("factory_id", profile!.factory_id)
        .eq("transaction_date", today);
      
      // Count cards updated today
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const cardsUpdatedToday = (cardsData || []).filter(card => 
        new Date(card.updated_at) >= new Date(todayStart) && 
        new Date(card.updated_at) <= new Date(todayEnd)
      ).length;
      
      // Get latest balance for each card to find low balance
      const cardIds = (cardsData || []).map(c => c.id);
      let lowBalanceCount = 0;
      
      if (cardIds.length > 0) {
        // Get latest transaction for each bin card
        const { data: latestTxns } = await supabase
          .from("storage_bin_card_transactions")
          .select("bin_card_id, balance_qty")
          .in("bin_card_id", cardIds)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false });
        
        // Group by bin_card_id and take first (latest)
        const latestByCard = new Map<string, number>();
        (latestTxns || []).forEach(txn => {
          if (!latestByCard.has(txn.bin_card_id)) {
            latestByCard.set(txn.bin_card_id, txn.balance_qty);
          }
        });
        
        lowBalanceCount = Array.from(latestByCard.values()).filter(bal => bal <= 10).length;
      }
      
      setStats({
        todayTransactions: todayTxnCount || 0,
        todayBinCardsUpdated: cardsUpdatedToday,
        totalBinCards: (cardsData || []).length,
        lowBalanceCards: lowBalanceCount,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCards = binCards.filter(card => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      card.work_orders.po_number.toLowerCase().includes(term) ||
      card.work_orders.buyer.toLowerCase().includes(term) ||
      card.work_orders.style.toLowerCase().includes(term) ||
      (card.work_orders.item?.toLowerCase().includes(term)) ||
      (card.description?.toLowerCase().includes(term))
    );
  });

  async function openCardDetail(card: BinCardWithWorkOrder) {
    setSelectedCard(card);
    setLoadingTxn(true);
    
    try {
      let query = supabase
        .from("storage_bin_card_transactions")
        .select("*")
        .eq("bin_card_id", card.id)
        .order("transaction_date", { ascending: true })
        .order("created_at", { ascending: true });
      
      if (dateRange?.from) {
        query = query.gte("transaction_date", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        query = query.lte("transaction_date", format(dateRange.to, "yyyy-MM-dd"));
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoadingTxn(false);
    }
  }

  function exportToCSV() {
    if (!selectedCard || transactions.length === 0) return;
    
    const headers = ["Date", "Receive Qty", "TTL Receive", "Issue Qty", "Balance Qty", "Remarks"];
    const rows = transactions.map(txn => [
      format(new Date(txn.transaction_date), "yyyy-MM-dd"),
      txn.receive_qty,
      txn.ttl_receive,
      txn.issue_qty,
      txn.balance_qty,
      txn.remarks || "",
    ]);
    
    const csvContent = [
      `BIN CARD - ${selectedCard.work_orders.po_number}`,
      `Buyer: ${selectedCard.buyer || selectedCard.work_orders.buyer}`,
      `Style: ${selectedCard.style || selectedCard.work_orders.style}`,
      "",
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bin-card-${selectedCard.work_orders.po_number}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canAccess) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">Access Denied</h3>
            <p className="text-sm text-muted-foreground">
              Only admins can access the Storage Dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Storage Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of bin card records</p>
          </div>
        </div>
        <Button onClick={() => navigate("/storage")}>
          <Package className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.todayTransactions}</div>
                <p className="text-sm text-muted-foreground">Today's Entries</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.todayBinCardsUpdated}</div>
                <p className="text-sm text-muted-foreground">Cards Updated Today</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.totalBinCards}</div>
                <p className="text-sm text-muted-foreground">Total Bin Cards</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className={`text-2xl font-bold ${stats.lowBalanceCards > 0 ? 'text-amber-500' : ''}`}>
                  {stats.lowBalanceCards}
                </div>
                <p className="text-sm text-muted-foreground">Low Balance (≤10)</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by PO, buyer, style..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Cards list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Bin Cards ({filteredCards.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-2" />
                  <p>No bin cards found</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Prepared By</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCards.map(card => (
                        <TableRow key={card.id}>
                          <TableCell className="font-medium">{card.work_orders.po_number}</TableCell>
                          <TableCell>{card.work_orders.buyer}</TableCell>
                          <TableCell>{card.work_orders.style}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {card.description || card.work_orders.item || "-"}
                          </TableCell>
                          <TableCell>{card.prepared_by || "-"}</TableCell>
                          <TableCell>{format(new Date(card.updated_at), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => openCardDetail(card)}>
                              View Ledger
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Bin Card Ledger - {selectedCard?.work_orders.po_number}</span>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedCard && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-b pb-4">
                <div>
                  <span className="text-muted-foreground">Buyer:</span>
                  <p className="font-medium">{selectedCard.buyer || selectedCard.work_orders.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Style:</span>
                  <p className="font-medium">{selectedCard.style || selectedCard.work_orders.style}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Supplier:</span>
                  <p className="font-medium">{selectedCard.supplier_name || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Description:</span>
                  <p className="font-medium">{selectedCard.description || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Construction:</span>
                  <p className="font-medium">{selectedCard.construction || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Color:</span>
                  <p className="font-medium">{selectedCard.color || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Width:</span>
                  <p className="font-medium">{selectedCard.width || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Package Qty:</span>
                  <p className="font-medium">{selectedCard.package_qty || "-"}</p>
                </div>
              </div>
              
              {/* Date filter */}
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
                        ) : (
                          format(dateRange.from, "MMM d, yyyy")
                        )
                      ) : (
                        "Filter by date"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        if (selectedCard) {
                          // Re-fetch with new date range
                          openCardDetail(selectedCard);
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Transactions */}
              {loadingTxn ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DATE</TableHead>
                        <TableHead className="text-right">RECEIVE QTY</TableHead>
                        <TableHead className="text-right">TTL RECEIVE</TableHead>
                        <TableHead className="text-right">ISSUE QTY</TableHead>
                        <TableHead className="text-right">BALANCE QTY</TableHead>
                        <TableHead>REMARKS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No transactions recorded
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map(txn => (
                          <TableRow key={txn.id}>
                            <TableCell>{format(new Date(txn.transaction_date), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-right">{txn.receive_qty}</TableCell>
                            <TableCell className="text-right font-medium">{txn.ttl_receive}</TableCell>
                            <TableCell className="text-right">{txn.issue_qty}</TableCell>
                            <TableCell className={`text-right font-medium ${txn.balance_qty < 0 ? 'text-destructive' : txn.balance_qty <= 10 ? 'text-amber-500' : ''}`}>
                              {txn.balance_qty}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{txn.remarks || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}