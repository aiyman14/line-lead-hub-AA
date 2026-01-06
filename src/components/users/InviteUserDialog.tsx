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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserPlus, Mail, User, Shield, GitBranch, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

const ASSIGNABLE_ROLES: AppRole[] = ['worker', 'supervisor', 'admin', 'storage', 'cutting'];
const DEPARTMENTS = ['sewing', 'finishing', 'both'] as const;
type Department = typeof DEPARTMENTS[number];

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const { profile, hasRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    role: "worker" as AppRole,
    department: "both" as Department,
  });

  // Owners can assign admin roles, admins can only assign worker/supervisor
  const availableRoles = hasRole('owner') || hasRole('superadmin') 
    ? ASSIGNABLE_ROLES 
    : ASSIGNABLE_ROLES.filter(r => r !== 'admin');

  useEffect(() => {
    if (open && profile?.factory_id) {
      fetchLines();
    }
  }, [open, profile?.factory_id]);

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

  function toggleLine(lineId: string) {
    setSelectedLineIds(prev => 
      prev.includes(lineId) 
        ? prev.filter(id => id !== lineId)
        : [...prev, lineId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.factory_id) return;

    setLoading(true);

    try {
      // Generate a secure random password for initial account creation
      // User will set their own password via the reset link
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();

      // Preserve current session (inviter). supabase.auth.signUp will otherwise switch session to the new user.
      const {
        data: { session: inviterSession },
      } = await supabase.auth.getSession();

      // Create user via Auth using admin invite pattern - don't auto sign in
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: randomPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            full_name: formData.fullName,
            invited_by_admin: "true",
            factory_id: profile.factory_id,
          },
        },
      });

      // Immediately restore inviter session to prevent any redirect
      if (inviterSession) {
        await supabase.auth.setSession({
          access_token: inviterSession.access_token,
          refresh_token: inviterSession.refresh_token,
        });
      }

      let userId: string | null = null;

      if (authError) {
        if (authError.message.includes('already registered')) {
          // User exists - we'll send them a password reset link
          console.log("User already exists, will send password reset link...");
          
          // Look up the existing user to get their ID
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', formData.email)
            .single();
          
          if (!existingProfile) {
            toast.error("User exists but profile not found");
            return;
          }
          
          userId = existingProfile.id;
          
          // Update the profile with factory_id, name, and department
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              factory_id: profile.factory_id,
              full_name: formData.fullName,
              department: formData.role === 'worker' ? formData.department : null
            })
            .eq('id', userId);

          if (profileError) {
            console.error("Profile update error:", profileError);
          }
        } else {
          toast.error(authError.message);
          return;
        }
      } else {
        if (!authData.user) {
          toast.error("Failed to create user");
          return;
        }
        userId = authData.user.id;

        // Update the profile with factory_id and department
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            factory_id: profile.factory_id,
            department: formData.role === 'worker' ? formData.department : null
          })
          .eq('id', userId);

        if (profileError) {
          console.error("Profile update error:", profileError);
        }
      }

      // Assign role to the new user
      // IMPORTANT: do not delete all roles globally; keep scopes safe.
      // 1) Remove any existing role for this factory
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('factory_id', profile.factory_id);

      // 2) Remove accidental global admin role (from older trigger behavior)
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .is('factory_id', null)
        .eq('role', 'admin');

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: formData.role,
          factory_id: profile.factory_id,
        });

      if (roleError) {
        console.error("Role assignment error:", roleError);
        toast.error("User created but role assignment failed");
        return;
      }

      // Assign lines to the user - first delete existing, then insert new
      if (userId) {
        // Delete existing line assignments for this user
        await supabase
          .from('user_line_assignments')
          .delete()
          .eq('user_id', userId);

        if (selectedLineIds.length > 0) {
          const lineAssignments = selectedLineIds.map(lineId => ({
            user_id: userId,
            line_id: lineId,
            factory_id: profile.factory_id,
          }));

          const { error: lineError } = await supabase
            .from('user_line_assignments')
            .insert(lineAssignments);

          if (lineError) {
            console.error("Line assignment error:", lineError);
          }
        }
      }

      // Send welcome email with password reset link (no plain text password)
      try {
        // Get factory name for the email
        const { data: factoryData } = await supabase
          .from('factory_accounts')
          .select('name')
          .eq('id', profile.factory_id)
          .single();

        // Generate a password reset link for the user to set their own password
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          formData.email,
          { redirectTo: `${window.location.origin}/reset-password` }
        );

        if (resetError) {
          console.error("Failed to generate reset link:", resetError);
          toast.warning("User created but password setup email failed to send");
        } else {
          // Send a custom welcome email with the reset link context
          // The reset email is sent by Supabase, but we can send a supplementary welcome
          const { error: emailError } = await supabase.functions.invoke('send-welcome-email', {
            body: {
              email: formData.email,
              fullName: formData.fullName,
              resetLink: `${window.location.origin}/reset-password`,
              factoryName: factoryData?.name,
            },
          });

          if (emailError) {
            console.error("Welcome email error:", emailError);
            // Reset link email was sent by Supabase, so user can still set password
          }
        }
      } catch (emailErr) {
        console.error("Email sending error:", emailErr);
        // Don't block the success flow if email fails
      }

      toast.success(`User ${formData.fullName} invited successfully`);
      onSuccess();
      onOpenChange(false);
      setFormData({ email: "", fullName: "", role: "worker", department: "both" });
      setSelectedLineIds([]);
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
            Add a new user to your factory. They will receive an email to set their password.
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

          {/* Department selector - only for workers */}
          {formData.role === 'worker' && (
            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Department
              </Label>
              <Select
                value={formData.department}
                onValueChange={(value: Department) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sewing">Sewing Only</SelectItem>
                  <SelectItem value="finishing">Finishing Only</SelectItem>
                  <SelectItem value="both">Both Sewing & Finishing</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This determines which update form the worker can access.
              </p>
            </div>
          )}

          {/* Line assignments - only for workers */}
          {formData.role === 'worker' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Assigned Lines
                {selectedLineIds.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {selectedLineIds.length} selected
                  </span>
                )}
              </Label>
              <ScrollArea className="h-32 border rounded-md p-2">
                {lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No lines available
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lines.map((line) => (
                      <div key={line.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`line-${line.id}`}
                          checked={selectedLineIds.includes(line.id)}
                          onCheckedChange={() => toggleLine(line.id)}
                        />
                        <label
                          htmlFor={`line-${line.id}`}
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
                Select which lines this worker can submit updates for.
              </p>
            </div>
          )}

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
