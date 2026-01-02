import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, UserCog, Shield, Trash2, Building2, Layers } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  role: string | null;
  assigned_unit_id: string | null;
  assigned_floor_id: string | null;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess: () => void;
}

interface Unit {
  id: string;
  name: string;
  code: string;
}

interface Floor {
  id: string;
  name: string;
  code: string;
  unit_id: string;
}

const ASSIGNABLE_ROLES: AppRole[] = ['worker', 'supervisor', 'admin'];

export function EditUserDialog({ open, onOpenChange, user, onSuccess }: EditUserDialogProps) {
  const { profile, hasRole, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [formData, setFormData] = useState({
    role: "worker" as AppRole,
    isActive: true,
    unitId: "__none__",
    floorId: "__none__",
  });

  // Owners can assign admin roles, admins can only assign worker/supervisor
  const availableRoles = hasRole('owner') || hasRole('superadmin')
    ? ASSIGNABLE_ROLES
    : ASSIGNABLE_ROLES.filter(r => r !== 'admin');

  const isCurrentUser = currentUser?.id === user?.id;
  const isOwnerOrHigher = user?.role === 'owner' || user?.role === 'superadmin';

  // Filter floors based on selected unit
  const filteredFloors = formData.unitId && formData.unitId !== "__none__"
    ? floors.filter(f => f.unit_id === formData.unitId)
    : floors;

  useEffect(() => {
    if (open && profile?.factory_id) {
      fetchUnitsAndFloors();
    }
  }, [open, profile?.factory_id]);

  useEffect(() => {
    if (user) {
      setFormData({
        role: (user.role as AppRole) || 'worker',
        isActive: user.is_active,
        unitId: user.assigned_unit_id || "__none__",
        floorId: user.assigned_floor_id || "__none__",
      });
    }
  }, [user]);

  async function fetchUnitsAndFloors() {
    if (!profile?.factory_id) return;

    const [unitsRes, floorsRes] = await Promise.all([
      supabase
        .from('units')
        .select('id, name, code')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('floors')
        .select('id, name, code, unit_id')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true)
        .order('name'),
    ]);

    if (unitsRes.data) setUnits(unitsRes.data);
    if (floorsRes.data) setFloors(floorsRes.data);
  }

  async function handleSave() {
    if (!user || !profile?.factory_id) return;
    
    setLoading(true);

    try {
      // Update role - first delete existing, then insert new
      const { error: deleteRoleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id)
        .eq('factory_id', profile.factory_id);

      if (deleteRoleError) {
        console.error("Delete role error:", deleteRoleError);
      }

      const { error: insertRoleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: formData.role,
          factory_id: profile.factory_id,
        });

      if (insertRoleError) {
        toast.error("Failed to update role");
        return;
      }

      // Update profile with active status and unit/floor assignments
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          is_active: formData.isActive,
          assigned_unit_id: formData.unitId && formData.unitId !== "__none__" ? formData.unitId : null,
          assigned_floor_id: formData.floorId && formData.floorId !== "__none__" ? formData.floorId : null,
        })
        .eq('id', user.id);

      if (profileError) {
        toast.error("Failed to update profile");
        return;
      }

      toast.success("User updated successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveAccess() {
    if (!user || !profile?.factory_id) return;

    setLoading(true);

    try {
      // Remove from factory by clearing factory_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ factory_id: null, is_active: false })
        .eq('id', user.id);

      if (profileError) {
        toast.error("Failed to remove user access");
        return;
      }

      // Delete their role in this factory
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id)
        .eq('factory_id', profile.factory_id);

      if (roleError) {
        console.error("Role deletion error:", roleError);
      }

      toast.success("User access removed");
      onSuccess();
      onOpenChange(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error removing user:", error);
      toast.error("Failed to remove user");
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
              Edit User
            </DialogTitle>
            <DialogDescription>
              Update user role, assignments, and access settings.
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
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
                disabled={isCurrentUser || isOwnerOrHigher}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
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
                <p className="text-xs text-muted-foreground">You cannot change your own role</p>
              )}
              {isOwnerOrHigher && !isCurrentUser && (
                <p className="text-xs text-muted-foreground">Owner/Admin roles cannot be changed here</p>
              )}
            </div>

            {/* Unit/Floor Assignment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="unit" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Unit
                </Label>
                <Select
                  value={formData.unitId}
                  onValueChange={(value) => setFormData({ ...formData, unitId: value, floorId: "__none__" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No assignment</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="floor" className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  Floor
                </Label>
                <Select
                  value={formData.floorId}
                  onValueChange={(value) => setFormData({ ...formData, floorId: value })}
                  disabled={!formData.unitId || formData.unitId === "__none__"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select floor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No assignment</SelectItem>
                    {filteredFloors.map((floor) => (
                      <SelectItem key={floor.id} value={floor.id}>
                        {floor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="active">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive users cannot log in
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
                Remove Access
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || isOwnerOrHigher}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {user.full_name}'s access to your factory. They will no longer be able to view or submit production data. This action can be undone by re-inviting them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAccess}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
