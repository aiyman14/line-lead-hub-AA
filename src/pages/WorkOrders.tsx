import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  ClipboardList, 
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  Search,
  AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  color: string | null;
  order_qty: number;
  smv: number | null;
  planned_ex_factory: string | null;
  target_per_hour: number | null;
  target_per_day: number | null;
  status: string;
  is_active: boolean;
}

const WORK_ORDER_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'not_started': return 'bg-muted text-muted-foreground';
    case 'in_progress': return 'bg-info/10 text-info';
    case 'completed': return 'bg-success/10 text-success';
    case 'on_hold': return 'bg-warning/10 text-warning';
    default: return 'bg-muted text-muted-foreground';
  }
};

export default function WorkOrders() {
  const { profile, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<WorkOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    po_number: '',
    buyer: '',
    style: '',
    item: '',
    color: '',
    order_qty: '',
    smv: '',
    planned_ex_factory: '',
    target_per_hour: '',
    target_per_day: '',
    status: 'not_started',
    is_active: true,
  });

  useEffect(() => {
    if (profile?.factory_id) {
      fetchWorkOrders();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.factory_id, profile]);

  async function fetchWorkOrders() {
    if (!profile?.factory_id) return;
    
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('factory_id', profile.factory_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setDialogMode('create');
    setEditingItem(null);
    setFormData({
      po_number: '',
      buyer: '',
      style: '',
      item: '',
      color: '',
      order_qty: '',
      smv: '',
      planned_ex_factory: '',
      target_per_hour: '',
      target_per_day: '',
      status: 'not_started',
      is_active: true,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(wo: WorkOrder) {
    setDialogMode('edit');
    setEditingItem(wo);
    setFormData({
      po_number: wo.po_number,
      buyer: wo.buyer,
      style: wo.style,
      item: wo.item || '',
      color: wo.color || '',
      order_qty: wo.order_qty.toString(),
      smv: wo.smv?.toString() || '',
      planned_ex_factory: wo.planned_ex_factory || '',
      target_per_hour: wo.target_per_hour?.toString() || '',
      target_per_day: wo.target_per_day?.toString() || '',
      status: wo.status || 'not_started',
      is_active: wo.is_active,
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!profile?.factory_id) return;
    if (!formData.po_number.trim() || !formData.buyer.trim() || !formData.style.trim()) {
      toast({ variant: "destructive", title: "PO Number, Buyer, and Style are required" });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const data = {
        factory_id: profile.factory_id,
        po_number: formData.po_number.trim(),
        buyer: formData.buyer.trim(),
        style: formData.style.trim(),
        item: formData.item.trim() || null,
        color: formData.color.trim() || null,
        order_qty: parseInt(formData.order_qty) || 0,
        smv: formData.smv ? parseFloat(formData.smv) : null,
        planned_ex_factory: formData.planned_ex_factory || null,
        target_per_hour: formData.target_per_hour ? parseInt(formData.target_per_hour) : null,
        target_per_day: formData.target_per_day ? parseInt(formData.target_per_day) : null,
        status: formData.status,
        is_active: formData.is_active,
      };
      
      if (dialogMode === 'create') {
        const { error } = await supabase.from('work_orders').insert(data);
        if (error) throw error;
        toast({ title: "Work order created" });
      } else if (editingItem) {
        const { error } = await supabase.from('work_orders').update(data).eq('id', editingItem.id);
        if (error) throw error;
        toast({ title: "Work order updated" });
      }
      
      setIsDialogOpen(false);
      fetchWorkOrders();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this work order?')) return;
    
    try {
      const { error } = await supabase.from('work_orders').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Work order deleted" });
      fetchWorkOrders();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  async function toggleActive(id: string, currentValue: boolean) {
    try {
      const { error } = await supabase.from('work_orders').update({ is_active: !currentValue }).eq('id', id);
      if (error) throw error;
      fetchWorkOrders();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  function downloadTemplate() {
    const headers = ['po_number', 'buyer', 'style', 'item', 'color', 'order_qty', 'smv', 'planned_ex_factory', 'target_per_hour', 'target_per_day', 'status'];
    const sampleRow = ['PO-001', 'ABC Buyer', 'STYLE-001', 'T-Shirt', 'Blue', '5000', '12.5', '2026-03-15', '100', '800', 'not_started'];
    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'work_orders_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.factory_id) return;
    
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const workOrdersToInsert = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = { factory_id: profile.factory_id };
      
      headers.forEach((header, idx) => {
        const value = values[idx];
        if (header === 'order_qty' || header === 'target_per_hour' || header === 'target_per_day') {
          row[header] = parseInt(value) || 0;
        } else if (header === 'smv') {
          row[header] = parseFloat(value) || null;
        } else if (header === 'status') {
          row[header] = value || 'not_started';
        } else {
          row[header] = value || null;
        }
      });
      
      if (row.po_number && row.buyer && row.style) {
        workOrdersToInsert.push(row);
      }
    }
    
    if (workOrdersToInsert.length === 0) {
      toast({ variant: "destructive", title: "No valid rows found in CSV" });
      return;
    }
    
    try {
      const { error } = await supabase.from('work_orders').insert(workOrdersToInsert);
      if (error) throw error;
      toast({ title: `Imported ${workOrdersToInsert.length} work orders` });
      fetchWorkOrders();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import failed", description: error.message });
    }
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const filteredWorkOrders = workOrders.filter(wo => 
    wo.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wo.buyer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wo.style.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (wo.item && wo.item.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Factory Assigned</h2>
            <p className="text-muted-foreground text-sm">
              You need to be assigned to a factory first.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/setup')}>
              Go to Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdminOrHigher()) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-sm">
              You need admin permissions to manage work orders.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Work Orders / PO Master</h1>
            <p className="text-sm text-muted-foreground">
              {workOrders.length} work orders • {workOrders.filter(w => w.is_active).length} active
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVUpload}
          />
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Work Order
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by PO, buyer, style, or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Order Qty</TableHead>
                  <TableHead>Ex-Factory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No work orders found. Add your first work order.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkOrders.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono font-medium">{wo.po_number}</TableCell>
                      <TableCell>{wo.buyer}</TableCell>
                      <TableCell>{wo.style}</TableCell>
                      <TableCell>{wo.item || '-'}</TableCell>
                      <TableCell>{wo.color || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{wo.order_qty.toLocaleString()}</TableCell>
                      <TableCell>{wo.planned_ex_factory || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(wo.status || 'not_started')}>
                          {WORK_ORDER_STATUSES.find(s => s.value === wo.status)?.label || 'Not Started'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={wo.is_active}
                          onCheckedChange={() => toggleActive(wo.id, wo.is_active)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(wo)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(wo.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Add New Work Order' : 'Edit Work Order'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PO Number *</Label>
                <Input
                  value={formData.po_number}
                  onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                  placeholder="PO-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Buyer *</Label>
                <Input
                  value={formData.buyer}
                  onChange={(e) => setFormData({ ...formData, buyer: e.target.value })}
                  placeholder="ABC Fashions"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Style *</Label>
                <Input
                  value={formData.style}
                  onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                  placeholder="STYLE-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Item</Label>
                <Input
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  placeholder="T-Shirt"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Blue"
                />
              </div>
              <div className="space-y-2">
                <Label>Order Quantity</Label>
                <Input
                  type="number"
                  value={formData.order_qty}
                  onChange={(e) => setFormData({ ...formData, order_qty: e.target.value })}
                  placeholder="5000"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMV</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.smv}
                  onChange={(e) => setFormData({ ...formData, smv: e.target.value })}
                  placeholder="12.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Planned Ex-Factory</Label>
                <Input
                  type="date"
                  value={formData.planned_ex_factory}
                  onChange={(e) => setFormData({ ...formData, planned_ex_factory: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target/Hour</Label>
                <Input
                  type="number"
                  value={formData.target_per_hour}
                  onChange={(e) => setFormData({ ...formData, target_per_hour: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Target/Day</Label>
                <Input
                  type="number"
                  value={formData.target_per_day}
                  onChange={(e) => setFormData({ ...formData, target_per_day: e.target.value })}
                  placeholder="800"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_ORDER_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <div className="pt-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogMode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
