import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package, Search, Plus, Save, AlertTriangle, Unlock } from "lucide-react";
import { format } from "date-fns";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  color: string | null;
  supplier_name: string | null;
  description: string | null;
  construction: string | null;
  width: string | null;
  package_qty: number | null;
}

interface BinCard {
  id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  supplier_name: string | null;
  description: string | null;
  construction: string | null;
  color: string | null;
  width: string | null;
  package_qty: string | null;
  prepared_by: string | null;
  is_header_locked: boolean;
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

interface NewTransaction {
  receive_qty: string;
  issue_qty: string;
  remarks: string;
}

export default function StorageBinCard() {
  const navigate = useNavigate();
  const { user, profile, isStorageUser, isAdminOrHigher } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [binCard, setBinCard] = useState<BinCard | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  
  // Header fields (editable if not locked)
  const [headerFields, setHeaderFields] = useState({
    supplier_name: "",
    description: "",
    construction: "",
    color: "",
    width: "",
    package_qty: "",
    prepared_by: "",
  });
  
  // New transaction entry
  const [newTxn, setNewTxn] = useState<NewTransaction>({
    receive_qty: "",
    issue_qty: "",
    remarks: "",
  });

  const canAccess = isStorageUser() || isAdminOrHigher();

  // Fetch work orders on mount
  useEffect(() => {
    if (profile?.factory_id && canAccess) {
      fetchWorkOrders();
    }
  }, [profile?.factory_id, canAccess]);

  async function fetchWorkOrders() {
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, po_number, buyer, style, item, color, supplier_name, description, construction, width, package_qty")
        .eq("factory_id", profile!.factory_id)
        .eq("is_active", true)
        .order("po_number", { ascending: true });
      
      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error("Error fetching work orders:", error);
    }
  }

  // Create searchable value for each work order
  const getSearchableValue = (wo: WorkOrder) => {
    return [
      wo.po_number,
      wo.buyer,
      wo.style,
      wo.item,
      wo.description,
    ].filter(Boolean).join(" ").toLowerCase();
  };

  // When a work order is selected, load or create bin card
  async function handleSelectWorkOrder(wo: WorkOrder) {
    setSelectedWorkOrder(wo);
    setSearchOpen(false);
    setLoading(true);
    
    try {
      // Try to find existing bin card
      const { data: existingCard, error: fetchError } = await supabase
        .from("storage_bin_cards")
        .select("*")
        .eq("factory_id", profile!.factory_id)
        .eq("work_order_id", wo.id)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      if (existingCard) {
        setBinCard(existingCard as BinCard);
        setHeaderFields({
          supplier_name: existingCard.supplier_name || wo.supplier_name || "",
          description: existingCard.description || wo.description || wo.item || "",
          construction: existingCard.construction || wo.construction || "",
          color: existingCard.color || wo.color || "",
          width: existingCard.width || wo.width || "",
          package_qty: existingCard.package_qty || (wo.package_qty?.toString() || ""),
          prepared_by: existingCard.prepared_by || profile?.full_name || "",
        });
        
        // Load transactions
        await loadTransactions(existingCard.id);
      } else {
        // Create new bin card
        const newCard = {
          factory_id: profile!.factory_id,
          work_order_id: wo.id,
          buyer: wo.buyer,
          style: wo.style,
          supplier_name: wo.supplier_name || null,
          description: wo.description || wo.item || null,
          construction: wo.construction || null,
          color: wo.color || null,
          width: wo.width || null,
          package_qty: wo.package_qty?.toString() || null,
          prepared_by: profile?.full_name || null,
          prepared_by_user_id: user?.id,
          is_header_locked: false,
        };
        
        const { data: createdCard, error: createError } = await supabase
          .from("storage_bin_cards")
          .insert(newCard)
          .select()
          .single();
        
        if (createError) throw createError;
        
        setBinCard(createdCard as BinCard);
        setHeaderFields({
          supplier_name: wo.supplier_name || "",
          description: wo.description || wo.item || "",
          construction: wo.construction || "",
          color: wo.color || "",
          width: wo.width || "",
          package_qty: wo.package_qty?.toString() || "",
          prepared_by: profile?.full_name || "",
        });
        setTransactions([]);
      }
    } catch (error) {
      console.error("Error loading bin card:", error);
      toast({
        title: "Error",
        description: "Failed to load bin card",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(binCardId: string) {
    const { data, error } = await supabase
      .from("storage_bin_card_transactions")
      .select("*")
      .eq("bin_card_id", binCardId)
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true });
    
    if (error) {
      console.error("Error loading transactions:", error);
      return;
    }
    
    setTransactions(data || []);
  }

  // Calculate running totals for new transaction preview
  const lastBalance = transactions.length > 0 
    ? transactions[transactions.length - 1].balance_qty 
    : 0;
  
  const lastTtlReceive = transactions.length > 0 
    ? transactions[transactions.length - 1].ttl_receive 
    : 0;

  const previewReceive = parseInt(newTxn.receive_qty) || 0;
  const previewIssue = parseInt(newTxn.issue_qty) || 0;
  const previewTtlReceive = lastTtlReceive + previewReceive;
  const previewBalance = lastBalance + previewReceive - previewIssue;
  const wouldGoNegative = previewBalance < 0;

  async function saveHeaderFields() {
    if (!binCard) return;

    setHeaderSaving(true);
    try {
      const { error } = await supabase
        .from("storage_bin_cards")
        .update({
          supplier_name: headerFields.supplier_name || null,
          description: headerFields.description || null,
          construction: headerFields.construction || null,
          color: headerFields.color || null,
          width: headerFields.width || null,
          package_qty: headerFields.package_qty || null,
          prepared_by: headerFields.prepared_by || null,
          is_header_locked: true, // Lock after first save
        })
        .eq("id", binCard.id);

      if (error) throw error;

      setBinCard({ ...binCard, is_header_locked: true });
      toast({
        title: "Header saved",
        description: "Bin card header has been saved and locked.",
      });
    } catch (error) {
      console.error("Error saving header:", error);
      toast({
        title: "Error",
        description: "Failed to save header",
        variant: "destructive",
      });
    } finally {
      setHeaderSaving(false);
    }
  }

  async function unlockHeader() {
    if (!binCard) return;

    setHeaderSaving(true);
    try {
      const { error } = await supabase
        .from("storage_bin_cards")
        .update({ is_header_locked: false })
        .eq("id", binCard.id);

      if (error) throw error;

      setBinCard({ ...binCard, is_header_locked: false });
      toast({ title: "Header unlocked", description: "Header is now editable." });
    } catch (error) {
      console.error("Error unlocking header:", error);
      toast({
        title: "Error",
        description: "Failed to unlock header",
        variant: "destructive",
      });
    } finally {
      setHeaderSaving(false);
    }
  }

  async function submitTransaction() {
    if (!binCard || !profile?.factory_id) return;
    
    if (wouldGoNegative && !isAdminOrHigher()) {
      toast({
        title: "Invalid transaction",
        description: "Balance cannot go negative. Reduce issue quantity.",
        variant: "destructive",
      });
      return;
    }
    
    if (previewReceive === 0 && previewIssue === 0) {
      toast({
        title: "Invalid transaction",
        description: "Enter a receive or issue quantity.",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    
    try {
      const newTransaction = {
        bin_card_id: binCard.id,
        factory_id: profile.factory_id,
        transaction_date: format(new Date(), "yyyy-MM-dd"),
        receive_qty: previewReceive,
        issue_qty: previewIssue,
        ttl_receive: previewTtlReceive,
        balance_qty: previewBalance,
        remarks: newTxn.remarks || null,
        submitted_by: user?.id,
      };
      
      const { error } = await supabase
        .from("storage_bin_card_transactions")
        .insert(newTransaction);
      
      if (error) throw error;
      
      // Reload transactions
      await loadTransactions(binCard.id);

      // Reset form
      setNewTxn({ receive_qty: "", issue_qty: "", remarks: "" });

      toast({ title: "Transaction saved", description: "Entry has been recorded." });
      navigate("/storage/history");
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast({ title: "Error", description: "Failed to save transaction", variant: "destructive" });
    } finally {
      setSaving(false);
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
        <Package className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">BIN CARD RECORD</h1>
          <p className="text-sm text-muted-foreground">Daily storage entry form</p>
        </div>
      </div>

      {/* Step 1: PO Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Step 1: Select PO / Work Order</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Search className="mr-2 h-4 w-4" />
                {selectedWorkOrder 
                  ? `${selectedWorkOrder.po_number} - ${selectedWorkOrder.buyer} / ${selectedWorkOrder.style}`
                  : "Search by PO, Buyer, Style, Item..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command shouldFilter={true}>
                <CommandInput 
                  placeholder="Search PO, buyer, style, item..." 
                />
                <CommandList>
                  <CommandEmpty>No work orders found.</CommandEmpty>
                  <CommandGroup>
                    {workOrders.map(wo => (
                      <CommandItem 
                        key={wo.id} 
                        value={getSearchableValue(wo)}
                        onSelect={() => handleSelectWorkOrder(wo)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{wo.po_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {wo.buyer} / {wo.style} {wo.item ? `/ ${wo.item}` : ""}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Step 2: Header Fields - shown when bin card is loaded */}
      {binCard && !loading && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Step 2: Bin Card Header</span>
              <div className="flex items-center gap-2">
                {binCard.is_header_locked && (
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                    Locked
                  </span>
                )}
                {binCard.is_header_locked && isAdminOrHigher() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={unlockHeader}
                    disabled={headerSaving}
                  >
                    {headerSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlock className="mr-2 h-4 w-4" />
                    )}
                    Unlock
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>BUYER</Label>
                <Input value={selectedWorkOrder?.buyer || ""} disabled className="bg-muted" />
              </div>
              <div>
                <Label>STYLE</Label>
                <Input value={selectedWorkOrder?.style || ""} disabled className="bg-muted" />
              </div>
              <div>
                <Label>SUPPLIER NAME</Label>
                <Input 
                  value={headerFields.supplier_name}
                  onChange={e => setHeaderFields({...headerFields, supplier_name: e.target.value})}
                  disabled={binCard.is_header_locked && !isAdminOrHigher()}
                  placeholder="Enter supplier name"
                />
              </div>
              <div>
                <Label>DESCRIPTION</Label>
                <Input 
                  value={headerFields.description}
                  onChange={e => setHeaderFields({...headerFields, description: e.target.value})}
                  disabled={binCard.is_header_locked && !isAdminOrHigher()}
                  placeholder="Item description"
                />
              </div>
              <div>
                <Label>CONSTRUCTION</Label>
                <Input 
                  value={headerFields.construction}
                  onChange={e => setHeaderFields({...headerFields, construction: e.target.value})}
                  disabled={binCard.is_header_locked && !isAdminOrHigher()}
                  placeholder="Construction details"
                />
              </div>
              <div>
                <Label>PREPARED BY</Label>
                <Input 
                  value={headerFields.prepared_by}
                  onChange={e => setHeaderFields({...headerFields, prepared_by: e.target.value})}
                  disabled={binCard.is_header_locked && !isAdminOrHigher()}
                />
              </div>
              <div>
                <Label>COLOR</Label>
                <Input 
                  value={headerFields.color}
                  onChange={e => setHeaderFields({...headerFields, color: e.target.value})}
                  disabled={binCard.is_header_locked && !isAdminOrHigher()}
                  placeholder="Color"
                />
              </div>
              <div>
                <Label>WIDTH</Label>
                <Input 
                  value={headerFields.width}
                  onChange={e => setHeaderFields({...headerFields, width: e.target.value})}
                  disabled={binCard.is_header_locked && !isAdminOrHigher()}
                  placeholder="Width"
                />
              </div>
              <div>
                <Label>PACKAGE QTY</Label>
                <Input 
                  value={headerFields.package_qty}
                  onChange={e => setHeaderFields({...headerFields, package_qty: e.target.value})}
                  disabled={binCard.is_header_locked && !isAdminOrHigher()}
                  placeholder="Package quantity"
                />
              </div>
            </div>
            {!binCard.is_header_locked && (
              <Button onClick={saveHeaderFields} className="mt-4" disabled={headerSaving}>
                {headerSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save & Lock Header
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Transaction Grid */}
      {binCard && !loading && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Step 3: Daily Transaction Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing transactions table */}
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
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No transactions yet. Add your first entry below.
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

            {/* New entry row */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Today's Entry ({format(new Date(), "dd/MM/yyyy")})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <Label>Receive Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newTxn.receive_qty}
                    onChange={e => setNewTxn({...newTxn, receive_qty: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Issue Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newTxn.issue_qty}
                    onChange={e => setNewTxn({...newTxn, issue_qty: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>TTL Receive (calc)</Label>
                  <Input value={previewTtlReceive} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>Balance (calc)</Label>
                  <Input 
                    value={previewBalance} 
                    disabled 
                    className={`bg-muted ${wouldGoNegative ? 'text-destructive border-destructive' : ''}`}
                  />
                </div>
                <div className="md:col-span-1 col-span-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={newTxn.remarks}
                    onChange={e => setNewTxn({...newTxn, remarks: e.target.value})}
                    placeholder="Optional notes"
                    className="h-10 min-h-0"
                  />
                </div>
              </div>
              
              {wouldGoNegative && (
                <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Balance would go negative. Reduce issue quantity.
                </p>
              )}
              
              <Button 
                onClick={submitTransaction} 
                disabled={saving || (wouldGoNegative && !isAdminOrHigher())}
                className="mt-4"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
