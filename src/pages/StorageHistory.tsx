import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Search, FileText, AlertTriangle, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface BinCardWithWorkOrder {
  id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  supplier_name: string | null;
  description: string | null;
  prepared_by: string | null;
  prepared_by_user_id: string | null;
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


export default function StorageHistory() {
  const { profile, isStorageUser, isAdminOrHigher } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [binCards, setBinCards] = useState<BinCardWithWorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState<BinCardWithWorkOrder | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxn, setLoadingTxn] = useState(false);
  
  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const canAccess = isStorageUser() || isAdminOrHigher();

  useEffect(() => {
    if (profile?.factory_id && canAccess) {
      fetchBinCards();
    } else {
      setLoading(false);
    }
  }, [profile?.factory_id, canAccess]);

  async function fetchBinCards() {
    try {
      const { data, error } = await supabase
        .from("storage_bin_cards")
        .select(`
          id,
          work_order_id,
          buyer,
          style,
          supplier_name,
          description,
          prepared_by,
          prepared_by_user_id,
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
      
      if (error) throw error;
      setBinCards((data || []) as BinCardWithWorkOrder[]);
    } catch (error) {
      console.error("Error fetching bin cards:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCards = binCards.filter(card => {
    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (
        card.work_orders.po_number.toLowerCase().includes(term) ||
        card.work_orders.buyer.toLowerCase().includes(term) ||
        card.work_orders.style.toLowerCase().includes(term) ||
        (card.work_orders.item?.toLowerCase().includes(term)) ||
        (card.description?.toLowerCase().includes(term))
      );
      if (!matchesSearch) return false;
    }
    
    // Date from filter
    if (dateFrom) {
      const cardDate = new Date(card.created_at);
      cardDate.setHours(0, 0, 0, 0);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (cardDate < fromDate) return false;
    }
    
    // Date to filter
    if (dateTo) {
      const cardDate = new Date(card.created_at);
      cardDate.setHours(23, 59, 59, 999);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (cardDate > toDate) return false;
    }
    
    return true;
  });

  function clearFilters() {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchTerm("");
  }

  const hasActiveFilters = dateFrom || dateTo || searchTerm;

  async function openCardDetail(card: BinCardWithWorkOrder) {
    setSelectedCard(card);
    setLoadingTxn(true);
    
    try {
      const { data, error } = await supabase
        .from("storage_bin_card_transactions")
        .select("*")
        .eq("bin_card_id", card.id)
        .order("transaction_date", { ascending: true })
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoadingTxn(false);
    }
  }

  if (!canAccess) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">Access Denied</h3>
            <p className="text-sm text-muted-foreground">
              You need the Storage role to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">All Bin Cards</h1>
          <p className="text-sm text-muted-foreground">View all bin card records</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            {/* Search row */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by PO, buyer, style..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date From */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[150px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Date To */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[150px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Clear filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Cards list */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bin Cards ({filteredCards.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-2" />
                <p>No bin cards found</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Prepared By</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCards.map(card => (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">{card.work_orders.po_number}</TableCell>
                        <TableCell>{card.work_orders.buyer}</TableCell>
                        <TableCell>{card.work_orders.style}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {card.description || card.work_orders.item || "-"}
                        </TableCell>
                        <TableCell>{card.prepared_by || "-"}</TableCell>
                        <TableCell>{format(new Date(card.created_at), "dd/MM/yyyy")}</TableCell>
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
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 break-words">
              Bin Card Ledger - {selectedCard?.work_orders.po_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCard && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
                  <span className="text-muted-foreground">Prepared By:</span>
                  <p className="font-medium">{selectedCard.prepared_by || "-"}</p>
                </div>
              </div>
              
              {/* Transactions */}
              {loadingTxn ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-md border">
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
                            <TableCell className={`text-right font-medium ${txn.balance_qty < 0 ? 'text-destructive' : ''}`}>
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
