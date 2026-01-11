import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Settings, 
  Building2, 
  Layers, 
  Rows3, 
  ListOrdered, 
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Factory,
  Package,
  ArrowLeft
} from "lucide-react";
import { Mail } from "lucide-react";
import { BLOCKER_IMPACTS, BLOCKER_IMPACT_LABELS, DEFAULT_STAGES, DEFAULT_BLOCKER_TYPES } from "@/lib/constants";
import { ActiveLinesMeter } from "@/components/ActiveLinesMeter";
import { useActiveLines } from "@/hooks/useActiveLines";
import { EmailScheduleSettings } from "@/components/insights/EmailScheduleSettings";

// Types
interface Unit {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface Floor {
  id: string;
  code: string;
  name: string;
  unit_id: string;
  is_active: boolean;
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
  unit_id: string | null;
  floor_id: string | null;
  target_per_hour: number | null;
  target_per_day: number | null;
  is_active: boolean;
}

interface Stage {
  id: string;
  code: string;
  name: string;
  sequence: number | null;
  is_active: boolean;
}

interface BlockerType {
  id: string;
  code: string;
  name: string;
  default_owner: string | null;
  default_impact: string | null;
  is_active: boolean;
}


export default function FactorySetup() {
  const { profile, isAdminOrHigher, user, factory } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("units");

  // Active lines hook for plan limits
  const { 
    status: lineStatus, 
    canActivateMore, 
    isAtLimit, 
    refresh: refreshLineStatus 
  } = useActiveLines();

  // Data
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [blockerTypes, setBlockerTypes] = useState<BlockerType[]>([]);
  

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk add lines state
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [bulkLineCount, setBulkLineCount] = useState(10);
  const [bulkStartNumber, setBulkStartNumber] = useState(1);
  const [bulkUnitId, setBulkUnitId] = useState('');
  const [bulkFloorId, setBulkFloorId] = useState('');
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Factory creation state
  const [isCreatingFactory, setIsCreatingFactory] = useState(false);
  const [newFactoryName, setNewFactoryName] = useState("");
  const [newFactorySlug, setNewFactorySlug] = useState("");

  // Storage settings state
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(factory?.low_stock_threshold ?? 10);
  const [isSavingStorage, setIsSavingStorage] = useState(false);

  // Factory name edit state
  const [isEditingFactoryName, setIsEditingFactoryName] = useState(false);
  const [editedFactoryName, setEditedFactoryName] = useState(factory?.name || "");
  const [isSavingFactoryName, setIsSavingFactoryName] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Update lowStockThreshold when factory changes
  useEffect(() => {
    if (factory?.low_stock_threshold !== undefined) {
      setLowStockThreshold(factory.low_stock_threshold);
    }
    if (factory?.name) {
      setEditedFactoryName(factory.name);
    }
  }, [factory?.low_stock_threshold, factory?.name]);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchAllData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.factory_id, profile]);

  async function fetchAllData() {
    if (!profile?.factory_id) return;

    try {
      const [unitsRes, floorsRes, linesRes, stagesRes, blockerTypesRes] = await Promise.all([
        supabase.from('units').select('*').eq('factory_id', profile.factory_id).order('code'),
        supabase.from('floors').select('*').eq('factory_id', profile.factory_id).order('code'),
        supabase.from('lines').select('*').eq('factory_id', profile.factory_id).order('line_id'),
        supabase.from('stages').select('*').eq('factory_id', profile.factory_id).order('sequence'),
        supabase.from('blocker_types').select('*').eq('factory_id', profile.factory_id).order('sort_order'),
      ]);

      setUnits(unitsRes.data || []);
      setFloors(floorsRes.data || []);
      // Sort lines numerically by extracting the number from line_id
      const sortedLines = (linesRes.data || []).sort((a, b) => {
        const numA = parseInt(a.line_id.replace(/\D/g, '') || '0', 10);
        const numB = parseInt(b.line_id.replace(/\D/g, '') || '0', 10);
        return numA - numB;
      });
      setLines(sortedLines);
      setStages(stagesRes.data || []);
      setBlockerTypes(blockerTypesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setDialogMode('create');
    setEditingItem(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(item: any) {
    setDialogMode('edit');
    setEditingItem(item);
    setIsDialogOpen(true);
  }

  async function handleSave(formData: any) {
    if (!profile?.factory_id) return;
    setIsSaving(true);

    try {
      const data = { ...formData, factory_id: profile.factory_id };

      if (dialogMode === 'create') {
        let error: any = null;
        if (activeTab === 'units') {
          const res = await supabase.from('units').insert(data);
          error = res.error;
        } else if (activeTab === 'floors') {
          const res = await supabase.from('floors').insert(data);
          error = res.error;
        } else if (activeTab === 'lines') {
          const res = await supabase.from('lines').insert(data);
          error = res.error;
        } else if (activeTab === 'stages') {
          const res = await supabase.from('stages').insert(data);
          error = res.error;
        } else if (activeTab === 'blockerTypes') {
          const res = await supabase.from('blocker_types').insert(data);
          error = res.error;
        }
        if (error) throw error;
        toast({ title: "Created successfully" });
      } else {
        let error: any = null;
        if (activeTab === 'units') {
          const res = await supabase.from('units').update(data).eq('id', editingItem.id);
          error = res.error;
        } else if (activeTab === 'floors') {
          const res = await supabase.from('floors').update(data).eq('id', editingItem.id);
          error = res.error;
        } else if (activeTab === 'lines') {
          const res = await supabase.from('lines').update(data).eq('id', editingItem.id);
          error = res.error;
        } else if (activeTab === 'stages') {
          const res = await supabase.from('stages').update(data).eq('id', editingItem.id);
          error = res.error;
        } else if (activeTab === 'blockerTypes') {
          const res = await supabase.from('blocker_types').update(data).eq('id', editingItem.id);
          error = res.error;
        }
        if (error) throw error;
        toast({ title: "Updated successfully" });
      }

      setIsDialogOpen(false);
      fetchAllData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  function openDeleteDialog(id: string) {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!itemToDelete) return;
    const id = itemToDelete;
    setDeleteDialogOpen(false);
    setItemToDelete(null);

    try {
      let error: any = null;
      if (activeTab === 'units') {
        const res = await supabase.from('units').delete().eq('id', id);
        error = res.error;
      } else if (activeTab === 'floors') {
        const res = await supabase.from('floors').delete().eq('id', id);
        error = res.error;
      } else if (activeTab === 'lines') {
        const res = await supabase.from('lines').delete().eq('id', id);
        error = res.error;
      } else if (activeTab === 'stages') {
        const res = await supabase.from('stages').delete().eq('id', id);
        error = res.error;
      } else if (activeTab === 'blockerTypes') {
        const res = await supabase.from('blocker_types').delete().eq('id', id);
        error = res.error;
      }
      if (error) throw error;
      toast({ title: "Deleted successfully" });
      fetchAllData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  async function toggleActive(id: string, currentValue: boolean) {
    try {
      // For lines: check plan limits before activating
      if (activeTab === 'lines' && !currentValue && !canActivateMore) {
        toast({ 
          variant: "destructive", 
          title: "Plan limit reached", 
          description: "Upgrade your plan to activate more production lines." 
        });
        return;
      }

      let error: any = null;
      if (activeTab === 'units') {
        const res = await supabase.from('units').update({ is_active: !currentValue }).eq('id', id);
        error = res.error;
      } else if (activeTab === 'floors') {
        const res = await supabase.from('floors').update({ is_active: !currentValue }).eq('id', id);
        error = res.error;
      } else if (activeTab === 'lines') {
        const res = await supabase.from('lines').update({ is_active: !currentValue }).eq('id', id);
        error = res.error;
      } else if (activeTab === 'stages') {
        const res = await supabase.from('stages').update({ is_active: !currentValue }).eq('id', id);
        error = res.error;
      } else if (activeTab === 'blockerTypes') {
        const res = await supabase.from('blocker_types').update({ is_active: !currentValue }).eq('id', id);
        error = res.error;
      }
      if (error) throw error;
      fetchAllData();
      if (activeTab === 'lines') {
        refreshLineStatus();
      }
    } catch (error: any) {
      // Check for plan limit error from trigger
      if (error.message?.includes('Plan limit reached') || error.message?.includes('limit')) {
        toast({ 
          variant: "destructive", 
          title: "Plan limit reached",
          description: "Upgrade your plan to activate more production lines." 
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  }

  async function handleCreateFactory() {
    if (!user || !newFactoryName.trim() || !newFactorySlug.trim()) return;
    
    setIsCreatingFactory(true);
    try {
      // Calculate 14-day trial period
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // IMPORTANT: avoid `.select()` on the insert.
      // The SELECT RLS policy depends on `profiles.factory_id`, which isn't set yet,
      // and Postgres enforces SELECT policies on `INSERT ... RETURNING`.
      // Instead, we generate the id client-side so we can reference it immediately.
      const factoryId = crypto.randomUUID();

      // Create the factory with a 14-day free trial
      const { error: factoryError } = await supabase
        .from('factory_accounts')
        .insert({
          id: factoryId,
          name: newFactoryName.trim(),
          slug: newFactorySlug.trim().toLowerCase().replace(/\s+/g, '-'),
          subscription_status: 'trial',
          subscription_tier: 'starter',
          max_lines: 30,
          trial_start_date: trialStartDate.toISOString(),
          trial_end_date: trialEndDate.toISOString(),
        });

      if (factoryError) throw factoryError;

      // Update user's profile to assign them to the factory
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ factory_id: factoryId })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Assign owner role to the user who created the factory
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'owner',
          factory_id: factoryId,
        });

      if (roleError) {
        console.error('Error assigning owner role:', roleError);
      }

      // Seed default stages
      const stagesData = DEFAULT_STAGES.map((stage) => ({
        ...stage,
        factory_id: factoryId,
      }));
      await supabase.from('stages').insert(stagesData);

      // Seed default blocker types
      const blockerTypesData = DEFAULT_BLOCKER_TYPES.map((bt) => ({
        code: bt.code,
        name: bt.name,
        default_owner: bt.default_owner,
        default_impact: bt.default_impact,
        factory_id: factoryId,
      }));
      await supabase.from('blocker_types').insert(blockerTypesData);

      // Seed default stage progress options
      const { DEFAULT_STAGE_PROGRESS_OPTIONS, DEFAULT_NEXT_MILESTONE_OPTIONS, DEFAULT_BLOCKER_OWNER_OPTIONS, DEFAULT_BLOCKER_IMPACT_OPTIONS } = await import('@/lib/constants');
      
      const stageProgressData = DEFAULT_STAGE_PROGRESS_OPTIONS.map((opt) => ({
        ...opt,
        factory_id: factoryId,
      }));
      await supabase.from('stage_progress_options').insert(stageProgressData);

      // Seed default next milestone options
      const nextMilestoneData = DEFAULT_NEXT_MILESTONE_OPTIONS.map((opt) => ({
        ...opt,
        factory_id: factoryId,
      }));
      await supabase.from('next_milestone_options').insert(nextMilestoneData);

      // Seed default blocker owner options
      const blockerOwnerData = DEFAULT_BLOCKER_OWNER_OPTIONS.map((opt) => ({
        ...opt,
        factory_id: factoryId,
      }));
      await supabase.from('blocker_owner_options').insert(blockerOwnerData);

      // Seed default blocker impact options
      const blockerImpactData = DEFAULT_BLOCKER_IMPACT_OPTIONS.map((opt) => ({
        ...opt,
        factory_id: factoryId,
      }));
      await supabase.from('blocker_impact_options').insert(blockerImpactData);

      toast({ 
        title: "Factory created!", 
        description: "Your 14-day free trial has started. Default settings have been added." 
      });
      
      // Reload the page to refresh auth context
      window.location.reload();
    } catch (error: any) {
      console.error('Error creating factory:', error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsCreatingFactory(false);
    }
  }

  async function handleBulkAddLines() {
    if (!profile?.factory_id) return;
    setIsBulkAdding(true);

    try {
      // Calculate how many lines can be added based on plan limits
      const maxAllowed = lineStatus?.maxLines ?? 9999;
      const currentActive = lineStatus?.activeCount ?? 0;
      const availableSlots = maxAllowed - currentActive;
      const linesToCreate = Math.min(bulkLineCount, availableSlots);

      if (linesToCreate <= 0) {
        toast({
          variant: "destructive",
          title: "Plan limit reached",
          description: "Upgrade your plan to add more production lines."
        });
        return;
      }

      // Generate line data
      const newLines = [];
      for (let i = 0; i < linesToCreate; i++) {
        const lineNum = bulkStartNumber + i;
        newLines.push({
          factory_id: profile.factory_id,
          line_id: `L${lineNum}`,
          name: `Line ${lineNum}`,
          unit_id: bulkUnitId || null,
          floor_id: bulkFloorId || null,
          is_active: true,
        });
      }

      const { error } = await supabase.from('lines').insert(newLines);
      if (error) throw error;

      toast({
        title: `${linesToCreate} lines created`,
        description: linesToCreate < bulkLineCount 
          ? `Only ${linesToCreate} lines added due to plan limits.`
          : `Lines L${bulkStartNumber} to L${bulkStartNumber + linesToCreate - 1} created.`
      });

      setIsBulkAddOpen(false);
      fetchAllData();
      refreshLineStatus();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsBulkAdding(false);
    }
  }

  async function handleSaveStorageSettings() {
    if (!profile?.factory_id) return;
    setIsSavingStorage(true);
    try {
      const { error } = await supabase
        .from('factory_accounts')
        .update({ low_stock_threshold: lowStockThreshold })
        .eq('id', profile.factory_id);
      
      if (error) throw error;
      toast({ title: "Storage settings saved" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSavingStorage(false);
    }
  }

  async function handleSaveFactoryName() {
    if (!profile?.factory_id || !editedFactoryName.trim()) return;
    setIsSavingFactoryName(true);
    try {
      const { error } = await supabase
        .from('factory_accounts')
        .update({ name: editedFactoryName.trim() })
        .eq('id', profile.factory_id);
      
      if (error) throw error;
      toast({ title: "Factory name updated" });
      setIsEditingFactoryName(false);
      // Reload to update auth context
      window.location.reload();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSavingFactoryName(false);
    }
  }

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
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Factory className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Create Your Factory</CardTitle>
            <CardDescription>
              Set up your factory to start tracking production
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="factoryName">Factory Name</Label>
              <Input
                id="factoryName"
                placeholder="e.g., Woventex Industries"
                value={newFactoryName}
                onChange={(e) => {
                  setNewFactoryName(e.target.value);
                  // Auto-generate slug from name
                  setNewFactorySlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="factorySlug">Factory Slug (URL identifier)</Label>
              <Input
                id="factorySlug"
                placeholder="e.g., woventex-industries"
                value={newFactorySlug}
                onChange={(e) => setNewFactorySlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs. Only lowercase letters, numbers, and hyphens.
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={handleCreateFactory}
              disabled={isCreatingFactory || !newFactoryName.trim() || !newFactorySlug.trim()}
            >
              {isCreatingFactory ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Factory
                </>
              )}
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
              You need admin permissions to access factory setup.
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
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/setup')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Lines, Units, Floors & Storage</h1>
          <p className="text-sm text-muted-foreground">
            Manage production lines and factory structure
          </p>
        </div>
      </div>

      {/* Factory Name Card */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Factory className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Factory Name</CardTitle>
              <CardDescription className="text-xs">
                Your organization's display name • ID: <span className="font-mono text-foreground/70">{factory?.id?.slice(0, 8)}</span>
              </CardDescription>
            </div>
          </div>
          {!isEditingFactoryName ? (
            <div className="flex items-center gap-3">
              <span className="font-medium">{factory?.name}</span>
              <Button variant="outline" size="sm" onClick={() => setIsEditingFactoryName(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={editedFactoryName}
                onChange={(e) => setEditedFactoryName(e.target.value)}
                className="w-64"
                placeholder="Factory name"
              />
              <Button 
                size="sm" 
                onClick={handleSaveFactoryName}
                disabled={isSavingFactoryName || !editedFactoryName.trim()}
              >
                {isSavingFactoryName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsEditingFactoryName(false);
                  setEditedFactoryName(factory?.name || "");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 mb-6">
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Units</span>
          </TabsTrigger>
          <TabsTrigger value="floors" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Floors</span>
          </TabsTrigger>
          <TabsTrigger value="lines" className="flex items-center gap-2">
            <Rows3 className="h-4 w-4" />
            <span className="hidden sm:inline">Lines</span>
          </TabsTrigger>
          <TabsTrigger value="stages" className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            <span className="hidden sm:inline">Stages</span>
          </TabsTrigger>
          <TabsTrigger value="blockerTypes" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Blockers</span>
          </TabsTrigger>
          <TabsTrigger value="emailReports" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* Units Tab */}
        <TabsContent value="units">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Units</CardTitle>
                <CardDescription>Manage factory units (e.g., Unit A, Unit B)</CardDescription>
              </div>
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Unit
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No units found. Add your first unit.
                      </TableCell>
                    </TableRow>
                  ) : (
                    units.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-mono">{unit.code}</TableCell>
                        <TableCell>{unit.name}</TableCell>
                        <TableCell>
                          <Switch
                            checked={unit.is_active}
                            onCheckedChange={() => toggleActive(unit.id, unit.is_active)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(unit)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(unit.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Floors Tab */}
        <TabsContent value="floors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Floors</CardTitle>
                <CardDescription>Manage floors within each unit</CardDescription>
              </div>
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Floor
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {floors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No floors found. Add your first floor.
                      </TableCell>
                    </TableRow>
                  ) : (
                    floors.map((floor) => (
                      <TableRow key={floor.id}>
                        <TableCell className="font-mono">{floor.code}</TableCell>
                        <TableCell>{floor.name}</TableCell>
                        <TableCell>{units.find(u => u.id === floor.unit_id)?.name || '-'}</TableCell>
                        <TableCell>
                          <Switch
                            checked={floor.is_active}
                            onCheckedChange={() => toggleActive(floor.id, floor.is_active)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(floor)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(floor.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lines Tab */}
        <TabsContent value="lines">
          {/* Active Lines Meter */}
          <div className="mb-4">
            <ActiveLinesMeter />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Production Lines</CardTitle>
                <CardDescription>Manage production lines (e.g., L1, L2, L3)</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    // Set default start number based on existing lines
                    const highestNum = lines.reduce((max, l) => {
                      const num = parseInt(l.line_id.replace(/\D/g, '') || '0', 10);
                      return num > max ? num : max;
                    }, 0);
                    setBulkStartNumber(highestNum + 1);
                    setIsBulkAddOpen(true);
                  }}
                  size="sm"
                  variant="outline"
                  disabled={isAtLimit}
                  title={isAtLimit ? "Plan limit reached" : "Add multiple lines at once"}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Bulk Add
                </Button>
                <Button 
                  onClick={openCreateDialog} 
                  size="sm"
                  disabled={isAtLimit}
                  title={isAtLimit ? "Plan limit reached. Upgrade to add more lines." : "Add a new line"}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Target/Day</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No lines found. Add your first production line.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => (
                      <TableRow key={line.id} className={!line.is_active ? 'opacity-60' : ''}>
                        <TableCell className="font-mono font-medium">{line.line_id}</TableCell>
                        <TableCell>{line.name || '-'}</TableCell>
                        <TableCell>{units.find(u => u.id === line.unit_id)?.name || '-'}</TableCell>
                        <TableCell>{floors.find(f => f.id === line.floor_id)?.name || '-'}</TableCell>
                        <TableCell>{line.target_per_day?.toLocaleString() || '-'}</TableCell>
                        <TableCell>
                          <Switch
                            checked={line.is_active}
                            onCheckedChange={() => toggleActive(line.id, line.is_active)}
                            disabled={!line.is_active && !canActivateMore}
                            title={!line.is_active && !canActivateMore ? "Plan limit reached" : ""}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(line)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(line.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stages Tab */}
        <TabsContent value="stages">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Production Stages</CardTitle>
                <CardDescription>Define workflow stages (e.g., Cutting, Sewing, QC)</CardDescription>
              </div>
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Stage
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sequence</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No stages found. Add your first production stage.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stages.map((stage) => (
                      <TableRow key={stage.id}>
                        <TableCell className="font-mono">{stage.sequence}</TableCell>
                        <TableCell className="font-mono">{stage.code}</TableCell>
                        <TableCell>{stage.name}</TableCell>
                        <TableCell>
                          <Switch
                            checked={stage.is_active}
                            onCheckedChange={() => toggleActive(stage.id, stage.is_active)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(stage)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(stage.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blocker Types Tab */}
        <TabsContent value="blockerTypes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Blocker Types</CardTitle>
                <CardDescription>Define types of blockers (e.g., Material, Machine)</CardDescription>
              </div>
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Blocker Type
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Default Owner</TableHead>
                    <TableHead>Default Impact</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockerTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No blocker types found. Add your first blocker type.
                      </TableCell>
                    </TableRow>
                  ) : (
                    blockerTypes.map((bt) => (
                      <TableRow key={bt.id}>
                        <TableCell className="font-mono">{bt.code}</TableCell>
                        <TableCell>{bt.name}</TableCell>
                        <TableCell>{bt.default_owner || '-'}</TableCell>
                        <TableCell>
                          {bt.default_impact ? BLOCKER_IMPACT_LABELS[bt.default_impact as keyof typeof BLOCKER_IMPACT_LABELS] : '-'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={bt.is_active}
                            onCheckedChange={() => toggleActive(bt.id, bt.is_active)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(bt)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(bt.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Reports Tab */}
        <TabsContent value="emailReports">
          <EmailScheduleSettings />
        </TabsContent>

      </Tabs>

      {/* Storage Settings Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Storage</CardTitle>
          </div>
          <CardDescription>Configure storage and inventory settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                placeholder="e.g., 10"
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Items with balance at or below this value will be flagged as low stock
              </p>
            </div>
            <Button 
              onClick={handleSaveStorageSettings} 
              disabled={isSavingStorage}
            >
              {isSavingStorage && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Item"
        description="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Add New' : 'Edit'} {
                activeTab === 'units' ? 'Unit' :
                activeTab === 'floors' ? 'Floor' :
                activeTab === 'lines' ? 'Line' :
                activeTab === 'stages' ? 'Stage' :
                'Blocker Type'
              }
            </DialogTitle>
          </DialogHeader>
          
          {activeTab === 'units' && (
            <UnitForm
              initialData={editingItem}
              onSave={handleSave}
              onCancel={() => setIsDialogOpen(false)}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'floors' && (
            <FloorForm
              initialData={editingItem}
              units={units}
              onSave={handleSave}
              onCancel={() => setIsDialogOpen(false)}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'lines' && (
            <LineForm
              initialData={editingItem}
              units={units}
              floors={floors}
              onSave={handleSave}
              onCancel={() => setIsDialogOpen(false)}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'stages' && (
            <StageForm
              initialData={editingItem}
              onSave={handleSave}
              onCancel={() => setIsDialogOpen(false)}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'blockerTypes' && (
            <BlockerTypeForm
              initialData={editingItem}
              onSave={handleSave}
              onCancel={() => setIsDialogOpen(false)}
              isSaving={isSaving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Add Lines Dialog */}
      <Dialog open={isBulkAddOpen} onOpenChange={setIsBulkAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Add Lines</DialogTitle>
            <DialogDescription>
              Quickly create multiple production lines at once. Lines will be named numerically (e.g., Line 1, Line 2, etc.)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start From</Label>
                <Input
                  type="number"
                  min={1}
                  value={bulkStartNumber}
                  onChange={(e) => setBulkStartNumber(parseInt(e.target.value) || 1)}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">First line number (e.g., L1)</p>
              </div>
              <div className="space-y-2">
                <Label>Number of Lines</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={bulkLineCount}
                  onChange={(e) => setBulkLineCount(Math.min(100, parseInt(e.target.value) || 1))}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">How many to create</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unit (optional)</Label>
              <Select value={bulkUnitId || "none"} onValueChange={(v) => { setBulkUnitId(v === "none" ? "" : v); setBulkFloorId(''); }}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No unit</SelectItem>
                  {units.filter(u => u.is_active).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bulkUnitId && (
              <div className="space-y-2">
                <Label>Floor (optional)</Label>
                <Select value={bulkFloorId || "none"} onValueChange={(v) => setBulkFloorId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select floor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No floor</SelectItem>
                    {floors.filter(f => f.is_active && f.unit_id === bulkUnitId).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {lineStatus && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">Preview</p>
                <p className="text-muted-foreground">
                  Will create lines: L{bulkStartNumber} to L{bulkStartNumber + bulkLineCount - 1}
                </p>
                <p className="text-muted-foreground">
                  Available slots: {lineStatus.maxLines !== null 
                    ? Math.max(0, lineStatus.maxLines - lineStatus.activeCount)
                    : 'Unlimited'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkAddOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleBulkAddLines} 
              disabled={isBulkAdding || bulkLineCount < 1}
            >
              {isBulkAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create {bulkLineCount} Lines
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form Components
function UnitForm({ initialData, onSave, onCancel, isSaving }: { initialData?: Unit, onSave: (data: any) => void, onCancel: () => void, isSaving: boolean }) {
  const [code, setCode] = useState(initialData?.code || '');
  const [name, setName] = useState(initialData?.name || '');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Code *</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., UNIT-A" />
      </div>
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Unit Alpha" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ code, name })} disabled={!code || !name || isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

function FloorForm({ initialData, units, onSave, onCancel, isSaving }: { initialData?: Floor, units: Unit[], onSave: (data: any) => void, onCancel: () => void, isSaving: boolean }) {
  const [code, setCode] = useState(initialData?.code || '');
  const [name, setName] = useState(initialData?.name || '');
  const [unitId, setUnitId] = useState(initialData?.unit_id || '');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Code *</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., 1F" />
      </div>
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., First Floor" />
      </div>
      <div className="space-y-2">
        <Label>Unit *</Label>
        <Select value={unitId} onValueChange={setUnitId}>
          <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
          <SelectContent>
            {units.filter(u => u.is_active).map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ code, name, unit_id: unitId })} disabled={!code || !name || !unitId || isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

function LineForm({ initialData, units, floors, onSave, onCancel, isSaving }: { initialData?: Line, units: Unit[], floors: Floor[], onSave: (data: any) => void, onCancel: () => void, isSaving: boolean }) {
  const [lineId, setLineId] = useState(initialData?.line_id || '');
  const [name, setName] = useState(initialData?.name || '');
  const [unitId, setUnitId] = useState(initialData?.unit_id || '');
  const [floorId, setFloorId] = useState(initialData?.floor_id || '');
  const [targetPerHour, setTargetPerHour] = useState(initialData?.target_per_hour?.toString() || '');
  const [targetPerDay, setTargetPerDay] = useState(initialData?.target_per_day?.toString() || '');

  const filteredFloors = floors.filter(f => !unitId || f.unit_id === unitId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Line ID *</Label>
        <Input value={lineId} onChange={(e) => setLineId(e.target.value.toUpperCase())} placeholder="e.g., L1" />
      </div>
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Line 1 - Jackets" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Unit</Label>
          <Select value={unitId} onValueChange={(v) => { setUnitId(v); setFloorId(''); }}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {units.filter(u => u.is_active).map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Floor</Label>
          <Select value={floorId} onValueChange={setFloorId} disabled={!unitId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {filteredFloors.filter(f => f.is_active).map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Target/Hour</Label>
          <Input type="number" value={targetPerHour} onChange={(e) => setTargetPerHour(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>Target/Day</Label>
          <Input type="number" value={targetPerDay} onChange={(e) => setTargetPerDay(e.target.value)} placeholder="0" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ 
          line_id: lineId, 
          name: name || null, 
          unit_id: unitId || null, 
          floor_id: floorId || null,
          target_per_hour: parseInt(targetPerHour) || null,
          target_per_day: parseInt(targetPerDay) || null
        })} disabled={!lineId || isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

function StageForm({ initialData, onSave, onCancel, isSaving }: { initialData?: Stage, onSave: (data: any) => void, onCancel: () => void, isSaving: boolean }) {
  const [code, setCode] = useState(initialData?.code || '');
  const [name, setName] = useState(initialData?.name || '');
  const [sequence, setSequence] = useState(initialData?.sequence?.toString() || '');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Code *</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., SEW" />
      </div>
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sewing" />
      </div>
      <div className="space-y-2">
        <Label>Sequence</Label>
        <Input type="number" value={sequence} onChange={(e) => setSequence(e.target.value)} placeholder="1" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ code, name, sequence: parseInt(sequence) || 0 })} disabled={!code || !name || isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

function BlockerTypeForm({ initialData, onSave, onCancel, isSaving }: { initialData?: BlockerType, onSave: (data: any) => void, onCancel: () => void, isSaving: boolean }) {
  const [code, setCode] = useState(initialData?.code || '');
  const [name, setName] = useState(initialData?.name || '');
  const [defaultOwner, setDefaultOwner] = useState(initialData?.default_owner || '');
  const [defaultImpact, setDefaultImpact] = useState(initialData?.default_impact || 'medium');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Code *</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., MATERIAL" />
      </div>
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Material Shortage" />
      </div>
      <div className="space-y-2">
        <Label>Default Owner</Label>
        <Input value={defaultOwner} onChange={(e) => setDefaultOwner(e.target.value)} placeholder="e.g., Procurement" />
      </div>
      <div className="space-y-2">
        <Label>Default Impact</Label>
        <Select value={defaultImpact} onValueChange={setDefaultImpact}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(BLOCKER_IMPACT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ code, name, default_owner: defaultOwner || null, default_impact: defaultImpact })} disabled={!code || !name || isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

