import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  ListOrdered,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  AlertTriangle,
  Users,
  TrendingUp,
  Target,
  ArrowUp
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DropdownOption {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  code?: string;
}

type OptionType = 'stages' | 'stage_progress' | 'next_milestone' | 'blocker_type' | 'blocker_owner' | 'blocker_impact';

const OPTION_CONFIGS = {
  stages: {
    title: 'Current Stage',
    description: 'Production stages for sewing/finishing forms',
    icon: ListOrdered,
    table: 'stages',
    labelField: 'name',
    hasCode: true,
  },
  stage_progress: {
    title: 'Stage Progress',
    description: 'Progress options (e.g., 0-25%, 25-50%, etc.)',
    icon: Target,
    table: 'stage_progress_options',
    labelField: 'label',
    hasCode: false,
  },
  next_milestone: {
    title: 'Next Milestone',
    description: 'What will be achieved tomorrow',
    icon: TrendingUp,
    table: 'next_milestone_options',
    labelField: 'label',
    hasCode: false,
  },
  blocker_type: {
    title: 'Blocker Type',
    description: 'Types of blockers (Material, Machine, etc.)',
    icon: AlertTriangle,
    table: 'blocker_types',
    labelField: 'name',
    hasCode: true,
  },
  blocker_owner: {
    title: 'Blocker Owner',
    description: 'Departments responsible for blockers',
    icon: Users,
    table: 'blocker_owner_options',
    labelField: 'label',
    hasCode: false,
  },
  blocker_impact: {
    title: 'Blocker Impact',
    description: 'Impact levels (Low, Medium, High, Critical)',
    icon: ArrowUp,
    table: 'blocker_impact_options',
    labelField: 'label',
    hasCode: false,
  },
};

interface SortableRowProps {
  opt: DropdownOption;
  hasCode: boolean;
  canReorder: boolean;
  onEdit: (opt: DropdownOption) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentValue: boolean) => void;
}

function SortableRow({ opt, hasCode, canReorder, onEdit, onDelete, onToggleActive }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opt.id, disabled: !canReorder });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${!opt.is_active ? 'opacity-60' : ''} ${isDragging ? 'bg-muted' : ''}`}
    >
      <TableCell>
        {canReorder ? (
          <div
            className="flex items-center justify-center cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (
          <div className="flex items-center justify-center p-1">
            <span className="text-xs text-muted-foreground">—</span>
          </div>
        )}
      </TableCell>
      {hasCode && (
        <TableCell className="font-mono text-sm">{opt.code || '-'}</TableCell>
      )}
      <TableCell>{opt.label}</TableCell>
      <TableCell>
        <Switch
          checked={opt.is_active}
          onCheckedChange={() => onToggleActive(opt.id, opt.is_active)}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={() => onEdit(opt)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(opt.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function DropdownSettings() {
  const { profile, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OptionType>('stages');
  const [options, setOptions] = useState<Record<OptionType, DropdownOption[]>>({
    stages: [],
    stage_progress: [],
    next_milestone: [],
    blocker_type: [],
    blocker_owner: [],
    blocker_impact: [],
  });
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formLabel, setFormLabel] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formActive, setFormActive] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filtered options based on status filter
  const getFilteredOptions = (optionsList: DropdownOption[]) => {
    if (statusFilter === 'all') return optionsList;
    if (statusFilter === 'active') return optionsList.filter(o => o.is_active);
    return optionsList.filter(o => !o.is_active);
  };

  useEffect(() => {
    if (profile?.factory_id) {
      fetchAllOptions();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.factory_id, profile]);

  async function fetchAllOptions() {
    if (!profile?.factory_id) return;
    
    try {
      const [
        stagesRes,
        stageProgressRes,
        nextMilestoneRes,
        blockerTypeRes,
        blockerOwnerRes,
        blockerImpactRes,
      ] = await Promise.all([
        supabase.from('stages').select('id, name, code, sequence, is_active').eq('factory_id', profile.factory_id).order('sequence'),
        supabase.from('stage_progress_options').select('id, label, sort_order, is_active').eq('factory_id', profile.factory_id).order('sort_order'),
        supabase.from('next_milestone_options').select('id, label, sort_order, is_active').eq('factory_id', profile.factory_id).order('sort_order'),
        supabase.from('blocker_types').select('id, name, code, is_active').eq('factory_id', profile.factory_id).order('name'),
        supabase.from('blocker_owner_options').select('id, label, sort_order, is_active').eq('factory_id', profile.factory_id).order('sort_order'),
        supabase.from('blocker_impact_options').select('id, label, sort_order, is_active').eq('factory_id', profile.factory_id).order('sort_order'),
      ]);
      
      setOptions({
        stages: (stagesRes.data || []).map(s => ({ id: s.id, label: s.name, sort_order: s.sequence || 0, is_active: s.is_active, code: s.code })),
        stage_progress: (stageProgressRes.data || []).map(s => ({ id: s.id, label: s.label, sort_order: s.sort_order || 0, is_active: s.is_active })),
        next_milestone: (nextMilestoneRes.data || []).map(s => ({ id: s.id, label: s.label, sort_order: s.sort_order || 0, is_active: s.is_active })),
        blocker_type: (blockerTypeRes.data || []).map(s => ({ id: s.id, label: s.name, sort_order: 0, is_active: s.is_active, code: s.code })),
        blocker_owner: (blockerOwnerRes.data || []).map(s => ({ id: s.id, label: s.label, sort_order: s.sort_order || 0, is_active: s.is_active })),
        blocker_impact: (blockerImpactRes.data || []).map(s => ({ id: s.id, label: s.label, sort_order: s.sort_order || 0, is_active: s.is_active })),
      });
    } catch (error) {
      console.error('Error fetching options:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setDialogMode('create');
    setEditingItem(null);
    setFormLabel('');
    setFormCode('');
    setFormSortOrder(((options[activeTab]?.length || 0) + 1).toString());
    setFormActive(true);
    setIsDialogOpen(true);
  }

  function openEditDialog(item: any) {
    setDialogMode('edit');
    setEditingItem(item);
    setFormLabel(item.label);
    setFormCode(item.code || '');
    setFormSortOrder(item.sort_order?.toString() || '0');
    setFormActive(item.is_active);
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!profile?.factory_id || !formLabel.trim()) {
      toast({ variant: "destructive", title: "Label is required" });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const data: any = { factory_id: profile.factory_id, is_active: formActive };
      
      if (activeTab === 'stages') {
        data.name = formLabel.trim();
        data.code = formCode.trim() || formLabel.trim().toUpperCase().substring(0, 10);
        data.sequence = parseInt(formSortOrder) || 0;
        if (dialogMode === 'create') {
          const { error } = await supabase.from('stages').insert(data);
          if (error) throw error;
        } else if (editingItem) {
          const { error } = await supabase.from('stages').update(data).eq('id', editingItem.id);
          if (error) throw error;
        }
      } else if (activeTab === 'blocker_type') {
        data.name = formLabel.trim();
        data.code = formCode.trim() || formLabel.trim().toUpperCase().substring(0, 10);
        if (dialogMode === 'create') {
          const { error } = await supabase.from('blocker_types').insert(data);
          if (error) throw error;
        } else if (editingItem) {
          const { error } = await supabase.from('blocker_types').update(data).eq('id', editingItem.id);
          if (error) throw error;
        }
      } else if (activeTab === 'stage_progress') {
        data.label = formLabel.trim();
        data.sort_order = parseInt(formSortOrder) || 0;
        if (dialogMode === 'create') {
          const { error } = await supabase.from('stage_progress_options').insert(data);
          if (error) throw error;
        } else if (editingItem) {
          const { error } = await supabase.from('stage_progress_options').update(data).eq('id', editingItem.id);
          if (error) throw error;
        }
      } else if (activeTab === 'next_milestone') {
        data.label = formLabel.trim();
        data.sort_order = parseInt(formSortOrder) || 0;
        if (dialogMode === 'create') {
          const { error } = await supabase.from('next_milestone_options').insert(data);
          if (error) throw error;
        } else if (editingItem) {
          const { error } = await supabase.from('next_milestone_options').update(data).eq('id', editingItem.id);
          if (error) throw error;
        }
      } else if (activeTab === 'blocker_owner') {
        data.label = formLabel.trim();
        data.sort_order = parseInt(formSortOrder) || 0;
        if (dialogMode === 'create') {
          const { error } = await supabase.from('blocker_owner_options').insert(data);
          if (error) throw error;
        } else if (editingItem) {
          const { error } = await supabase.from('blocker_owner_options').update(data).eq('id', editingItem.id);
          if (error) throw error;
        }
      } else if (activeTab === 'blocker_impact') {
        data.label = formLabel.trim();
        data.sort_order = parseInt(formSortOrder) || 0;
        if (dialogMode === 'create') {
          const { error } = await supabase.from('blocker_impact_options').insert(data);
          if (error) throw error;
        } else if (editingItem) {
          const { error } = await supabase.from('blocker_impact_options').update(data).eq('id', editingItem.id);
          if (error) throw error;
        }
      }
      
      toast({ title: dialogMode === 'create' ? "Option created" : "Option updated" });
      setIsDialogOpen(false);
      fetchAllOptions();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this option?')) return;
    
    try {
      if (activeTab === 'stages') {
        const { error } = await supabase.from('stages').delete().eq('id', id);
        if (error) throw error;
      } else if (activeTab === 'blocker_type') {
        const { error } = await supabase.from('blocker_types').delete().eq('id', id);
        if (error) throw error;
      } else if (activeTab === 'stage_progress') {
        const { error } = await supabase.from('stage_progress_options').delete().eq('id', id);
        if (error) throw error;
      } else if (activeTab === 'next_milestone') {
        const { error } = await supabase.from('next_milestone_options').delete().eq('id', id);
        if (error) throw error;
      } else if (activeTab === 'blocker_owner') {
        const { error } = await supabase.from('blocker_owner_options').delete().eq('id', id);
        if (error) throw error;
      } else if (activeTab === 'blocker_impact') {
        const { error } = await supabase.from('blocker_impact_options').delete().eq('id', id);
        if (error) throw error;
      }
      toast({ title: "Option deleted" });
      fetchAllOptions();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  async function toggleActive(id: string, currentValue: boolean) {
    try {
      if (activeTab === 'stages') {
        await supabase.from('stages').update({ is_active: !currentValue }).eq('id', id);
      } else if (activeTab === 'blocker_type') {
        await supabase.from('blocker_types').update({ is_active: !currentValue }).eq('id', id);
      } else if (activeTab === 'stage_progress') {
        await supabase.from('stage_progress_options').update({ is_active: !currentValue }).eq('id', id);
      } else if (activeTab === 'next_milestone') {
        await supabase.from('next_milestone_options').update({ is_active: !currentValue }).eq('id', id);
      } else if (activeTab === 'blocker_owner') {
        await supabase.from('blocker_owner_options').update({ is_active: !currentValue }).eq('id', id);
      } else if (activeTab === 'blocker_impact') {
        await supabase.from('blocker_impact_options').update({ is_active: !currentValue }).eq('id', id);
      }
      fetchAllOptions();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    // blocker_type doesn't have sort_order column - it's ordered alphabetically
    if (activeTab === 'blocker_type') return;
    
    const currentOptions = [...options[activeTab]];
    const oldIndex = currentOptions.findIndex(o => o.id === active.id);
    const newIndex = currentOptions.findIndex(o => o.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedOptions = arrayMove(currentOptions, oldIndex, newIndex);
    
    // Update local state immediately for responsive UI
    setOptions(prev => ({
      ...prev,
      [activeTab]: reorderedOptions
    }));
    
    try {
      // Get table name and sort field
      const tableName = activeTab === 'stages' ? 'stages' : OPTION_CONFIGS[activeTab].table;
      const sortField = activeTab === 'stages' ? 'sequence' : 'sort_order';
      
      // Update all items with new sequential sort order
      for (let i = 0; i < reorderedOptions.length; i++) {
        const { error } = await supabase
          .from(tableName as any)
          .update({ [sortField]: i + 1 })
          .eq('id', reorderedOptions[i].id);
        if (error) throw error;
      }
      
      toast({ title: "Order updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      await fetchAllOptions(); // Revert on error
    }
  }

  const config = OPTION_CONFIGS[activeTab];

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
            <ListOrdered className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
              You need admin permissions to manage dropdown settings.
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
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ListOrdered className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Dropdown Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage dropdown options used in worker forms
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OptionType)}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-6">
          <TabsTrigger value="stages" className="text-xs">Stages</TabsTrigger>
          <TabsTrigger value="stage_progress" className="text-xs">Progress</TabsTrigger>
          <TabsTrigger value="next_milestone" className="text-xs">Milestones</TabsTrigger>
          <TabsTrigger value="blocker_type" className="text-xs">Blocker Types</TabsTrigger>
          <TabsTrigger value="blocker_owner" className="text-xs">Owners</TabsTrigger>
          <TabsTrigger value="blocker_impact" className="text-xs">Impact</TabsTrigger>
        </TabsList>

        {Object.entries(OPTION_CONFIGS).map(([key, cfg]) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <cfg.icon className="h-5 w-5" />
                    {cfg.title}
                  </CardTitle>
                  <CardDescription>{cfg.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <Button
                      variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setStatusFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={statusFilter === 'active' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setStatusFilter('active')}
                    >
                      Active
                    </Button>
                    <Button
                      variant={statusFilter === 'inactive' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setStatusFilter('inactive')}
                    >
                      Inactive
                    </Button>
                  </div>
                  <Button size="sm" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        {cfg.hasCode && <TableHead>Code</TableHead>}
                        <TableHead>Label</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filteredOpts = getFilteredOptions(options[key as OptionType]);
                        const allOpts = options[key as OptionType];
                        
                        if (allOpts.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={cfg.hasCode ? 5 : 4} className="text-center text-muted-foreground">
                                No options found. Add your first option.
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        if (filteredOpts.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={cfg.hasCode ? 5 : 4} className="text-center text-muted-foreground">
                                No {statusFilter} options found.
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        return (
                          <SortableContext
                            items={filteredOpts.map(o => o.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {filteredOpts.map((opt) => (
                              <SortableRow
                                key={opt.id}
                                opt={opt}
                                hasCode={cfg.hasCode}
                                canReorder={key !== 'blocker_type'}
                                onEdit={openEditDialog}
                                onDelete={handleDelete}
                                onToggleActive={toggleActive}
                              />
                            ))}
                          </SortableContext>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </DndContext>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Add New Option' : 'Edit Option'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Option label"
              />
            </div>
            
            {config.hasCode && (
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="SHORT_CODE"
                  className="font-mono"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                placeholder="0"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={formActive}
                onCheckedChange={setFormActive}
              />
              <Label>Active</Label>
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
