import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { mutateWithRetry, invokeEdgeFn, networkErrorMessage } from "@/lib/network-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserCog, Shield, Trash2, GitBranch, Info, Building2 } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, DEPARTMENT_WIDE_ROLES, type AppRole } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean | null;
  role: string | null;
  assigned_line_ids: string[];
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess: () => void;
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

interface WorkOrder {
  id: string;
  po_number: string;
  style: string;
  buyer: string;
}

const ASSIGNABLE_ROLES: AppRole[] = ['sewing', 'finishing', 'admin', 'storage', 'cutting', 'buyer'];

const editUserSchema = z.object({
  role: z.enum(["sewing", "finishing", "admin", "storage", "cutting", "owner", "worker", "buyer"]),
  isActive: z.boolean(),
});

export function EditUserDialog({ open, onOpenChange, user, onSuccess }: EditUserDialogProps) {
  const { t } = useTranslation();
  const { profile, hasRole, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    role: "sewing" as AppRole,
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<string[]>([]);

  // Admins can assign all roles including other admins
  const availableRoles = hasRole('admin') || hasRole('owner')
    ? ASSIGNABLE_ROLES
    : ASSIGNABLE_ROLES.filter(r => r !== 'admin');

  const isCurrentUser = currentUser?.id === user?.id;
  const isOwnerOrHigher = user?.role === 'owner';
  const isAdminOrHigher = user?.role === 'admin' || user?.role === 'owner';

  const isDeptWide = DEPARTMENT_WIDE_ROLES.includes(formData.role);
  const isBuyerRole = formData.role === 'buyer';
  const showLinePicker = formData.role === 'sewing';

  useEffect(() => {
    if (open && profile?.factory_id) {
      fetchLines();
      fetchWorkOrders();
    }
  }, [open, profile?.factory_id]);

  useEffect(() => {
    if (user) {
      setFormData({
        role: (user.role as AppRole) || 'sewing',
        isActive: user.is_active ?? true,
      });
      setSelectedLineIds(user.assigned_line_ids || []);
    }
  }, [user]);

  // Fetch buyer PO access when editing a buyer user
  useEffect(() => {
    if (open && user && user.role === 'buyer' && profile?.factory_id) {
      fetchBuyerPOAccess(user.id);
    }
  }, [open, user, profile?.factory_id]);

  async function fetchLines() {
    if (!profile?.factory_id) return;

    const { data } = await supabase
      .from('lines')
      .select('id, line_id, name')
      .eq('factory_id', profile.factory_id)
      .eq('is_active', true);

    if (data) {
      // Sort numerically by extracting number from line_id
      const sorted = [...data].sort((a, b) => {
        const numA = parseInt(a.line_id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.line_id.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setLines(sorted);
    }
  }

  async function fetchWorkOrders() {
    if (!profile?.factory_id) return;

    const { data } = await supabase
      .from('work_orders')
      .select('id, po_number, style, buyer')
      .eq('factory_id', profile.factory_id)
      .eq('is_active', true)
      .order('po_number');

    if (data) setWorkOrders(data);
  }

  async function fetchBuyerPOAccess(userId: string) {
    if (!profile?.factory_id) return;

    const { data } = await supabase
      .from('buyer_po_access')
      .select('work_order_id')
      .eq('user_id', userId)
      .eq('factory_id', profile.factory_id);

    if (data) {
      setSelectedWorkOrderIds(data.map(d => d.work_order_id));
    }
  }

  function toggleWorkOrder(woId: string) {
    setSelectedWorkOrderIds(prev =>
      prev.includes(woId)
        ? prev.filter(id => id !== woId)
        : [...prev, woId]
    );
  }

  function toggleLine(lineId: string) {
    setSelectedLineIds(prev =>
      prev.includes(lineId)
        ? prev.filter(id => id !== lineId)
        : [...prev, lineId]
    );
  }

  async function handleSave() {
    if (!user || !profile?.factory_id) return;

    const result = editUserSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setFormErrors(fieldErrors);
      return;
    }
    setFormErrors({});

    setLoading(true);

    try {
      // Update role - first delete existing, then insert new
      const { error: deleteRoleError } = await mutateWithRetry(() =>
        supabase.from('user_roles').delete().eq('user_id', user.id).eq('factory_id', profile.factory_id!)
      );

      if (deleteRoleError) {
        console.error("Delete role error:", deleteRoleError);
      }

      const { error: insertRoleError } = await mutateWithRetry(() =>
        supabase.from('user_roles').insert([{
          user_id: user.id,
          role: formData.role as any,
        }])
      );

      if (insertRoleError) {
        toast.error(networkErrorMessage(insertRoleError));
        return;
      }

      // Update profile with active status and department
      const department = formData.role === 'sewing' ? 'sewing'
        : formData.role === 'finishing' ? 'finishing'
        : null;

      const { error: profileError } = await mutateWithRetry(() =>
        supabase.from('profiles').update({
          is_active: formData.isActive,
          department,
        }).eq('id', user.id)
      );

      if (profileError) {
        toast.error(networkErrorMessage(profileError));
        return;
      }

      // Update line assignments (skip for buyer role)
      if (!isBuyerRole) {
        const { error: deleteLineError } = await mutateWithRetry(() =>
          supabase.from('user_line_assignments').delete().eq('user_id', user.id).eq('factory_id', profile.factory_id!)
        );

        if (deleteLineError) {
          console.error("Delete line assignments error:", deleteLineError);
        }

        // Determine which line IDs to assign
        let lineIdsToAssign: string[] = [];
        if (showLinePicker) {
          lineIdsToAssign = selectedLineIds;
        } else if (isDeptWide) {
          lineIdsToAssign = lines.map(l => l.id);
        }

        if (lineIdsToAssign.length > 0) {
          const lineAssignments = lineIdsToAssign.map(lineId => ({
            user_id: user.id,
            line_id: lineId,
            factory_id: profile.factory_id!,
          }));

          const { error: insertLineError } = await mutateWithRetry(() =>
            supabase.from('user_line_assignments').insert(lineAssignments)
          );

          if (insertLineError) {
            console.error("Insert line assignments error:", insertLineError);
          }
        }
      }

      // Update buyer PO access
      if (isBuyerRole) {
        // Delete existing
        await mutateWithRetry(() =>
          supabase.from('buyer_po_access').delete().eq('user_id', user.id).eq('factory_id', profile.factory_id!)
        );

        // Insert new
        if (selectedWorkOrderIds.length > 0) {
          const poAccess = selectedWorkOrderIds.map(woId => ({
            user_id: user.id,
            work_order_id: woId,
            factory_id: profile.factory_id!,
            granted_by: currentUser!.id,
          }));

          const { error: poError } = await mutateWithRetry(() =>
            supabase.from('buyer_po_access').insert(poAccess)
          );

          if (poError) {
            console.error("Buyer PO access error:", poError);
          }
        }
      }

      toast.success(t('modals.userUpdated'));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(networkErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveAccess() {
    if (!user || !profile?.factory_id) return;

    setLoading(true);

    try {
      // For buyer users, deactivate the membership and clean up PO access for this factory
      if (user.role === 'buyer') {
        // Deactivate membership (don't delete — preserves history)
        await mutateWithRetry(() =>
          supabase.from('buyer_factory_memberships')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('factory_id', profile.factory_id!)
        );

        // Remove PO access for this factory
        await mutateWithRetry(() =>
          supabase.from('buyer_po_access')
            .delete()
            .eq('user_id', user.id)
            .eq('factory_id', profile.factory_id!)
        );

        // Remove buyer role for this factory
        await mutateWithRetry(() =>
          supabase.from('user_roles')
            .delete()
            .eq('user_id', user.id)
            .eq('role', 'buyer')
            .eq('factory_id', profile.factory_id!)
        );

        toast.success(t('modals.userAccessRemoved'));
        onSuccess();
        onOpenChange(false);
        setShowDeleteConfirm(false);
        return;
      }

      // For non-buyer users, use the existing edge function
      const { data, error } = await invokeEdgeFn("remove-user-access", { userId: user.id });

      if (error) {
        toast.error(networkErrorMessage(error));
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(t('modals.userAccessRemoved'));
      onSuccess();
      onOpenChange(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error removing user:", error);
      toast.error(networkErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              {t('modals.editUser')}
            </DialogTitle>
            <DialogDescription>
              {t('modals.editUserDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.full_name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                {t('modals.role')}
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
                disabled={isCurrentUser || isOwnerOrHigher}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('modals.selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCurrentUser && (
                <p className="text-xs text-muted-foreground">{t('modals.cannotChangeOwnRole')}</p>
              )}
              {isOwnerOrHigher && !isCurrentUser && (
                <p className="text-xs text-muted-foreground">{t('modals.ownerRoleNote')}</p>
              )}
              {formErrors.role && <p className="text-sm text-destructive">{formErrors.role}</p>}
            </div>

            {/* Line Assignment - only for sewing (line-bound) */}
            {showLinePicker && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  {t('modals.assignedLines')}
                  {selectedLineIds.length > 0 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {selectedLineIds.length} {t('modals.selected')}
                    </span>
                  )}
                </Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {lines.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('modals.noLinesAvailable')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {lines.map((line) => (
                        <div key={line.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-line-${line.id}`}
                            checked={selectedLineIds.includes(line.id)}
                            onCheckedChange={() => toggleLine(line.id)}
                          />
                          <label
                            htmlFor={`edit-line-${line.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {line.name || line.line_id}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  {t('modals.linesSewingNote')}
                </p>
              </div>
            )}

            {/* Buyer PO Access */}
            {isBuyerRole && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Assigned POs
                  {selectedWorkOrderIds.length > 0 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {selectedWorkOrderIds.length} selected
                    </span>
                  )}
                </Label>
                <ScrollArea className="h-40 border rounded-md p-2">
                  {workOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active work orders found
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {workOrders.map((wo) => (
                        <div key={wo.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-wo-${wo.id}`}
                            checked={selectedWorkOrderIds.includes(wo.id)}
                            onCheckedChange={() => toggleWorkOrder(wo.id)}
                          />
                          <label
                            htmlFor={`edit-wo-${wo.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            <span className="font-medium">{wo.po_number}</span>
                            <span className="text-muted-foreground"> — {wo.style}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  Select which POs this buyer can view.
                </p>
              </div>
            )}

            {/* Info note for department-wide roles (not shown for buyer) */}
            {isDeptWide && !isBuyerRole && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t('modals.roleAllAccess')}</span>
              </div>
            )}

            {/* Active Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="active">{t('modals.activeStatus')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('modals.inactiveCannotLogin')}
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                disabled={isCurrentUser}
              />
            </div>

            {/* Remove Access */}
            {!isCurrentUser && !isOwnerOrHigher && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('modals.removeAccess')}
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('modals.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={loading || isOwnerOrHigher}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('modals.saving')}</>
              ) : (
                t('modals.saveChanges')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modals.removeUserAccess')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modals.removeUserAccessDesc', { name: user.full_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('modals.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAccess}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('modals.removing')}</>
              ) : (
                t('modals.removeAccess')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
