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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus, Mail, User, Shield, Building2, Layers } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const { profile, hasRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    role: "worker" as AppRole,
    password: "",
    unitId: "__none__",
    floorId: "__none__",
  });

  // Owners can assign admin roles, admins can only assign worker/supervisor
  const availableRoles = hasRole('owner') || hasRole('superadmin') 
    ? ASSIGNABLE_ROLES 
    : ASSIGNABLE_ROLES.filter(r => r !== 'admin');

  // Filter floors based on selected unit
  const filteredFloors = formData.unitId && formData.unitId !== "__none__"
    ? floors.filter(f => f.unit_id === formData.unitId)
    : floors;

  useEffect(() => {
    if (open && profile?.factory_id) {
      fetchUnitsAndFloors();
    }
  }, [open, profile?.factory_id]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.factory_id) return;

    setLoading(true);

    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: formData.fullName,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast.error("This email is already registered");
        } else {
          toast.error(authError.message);
        }
        return;
      }

      if (!authData.user) {
        toast.error("Failed to create user");
        return;
      }

      // Update the profile with factory_id and unit/floor assignments
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          factory_id: profile.factory_id,
          assigned_unit_id: formData.unitId && formData.unitId !== "__none__" ? formData.unitId : null,
          assigned_floor_id: formData.floorId && formData.floorId !== "__none__" ? formData.floorId : null,
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // Assign role to the new user
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: formData.role,
          factory_id: profile.factory_id,
        });

      if (roleError) {
        console.error("Role assignment error:", roleError);
        toast.error("User created but role assignment failed");
        return;
      }

      toast.success(`User ${formData.fullName} invited successfully`);
      onSuccess();
      onOpenChange(false);
      setFormData({ email: "", fullName: "", role: "worker", password: "", unitId: "__none__", floorId: "__none__" });
    } catch (error) {
      console.error("Error inviting user:", error);
      toast.error("Failed to invite user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Add a new user to your factory. They will receive login credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Temporary Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min 6 characters"
              minLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              Share this password with the user. They can change it after logging in.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Role
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
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
          </div>

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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Invite User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
