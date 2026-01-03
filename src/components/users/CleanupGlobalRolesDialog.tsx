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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";

interface GlobalRole {
  id: string;
  user_id: string;
  role: AppRole;
  user_email: string;
  user_name: string;
}

export function CleanupGlobalRolesDialog({ onSuccess }: { onSuccess?: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [globalRoles, setGlobalRoles] = useState<GlobalRole[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchGlobalRoles();
    }
  }, [open]);

  async function fetchGlobalRoles() {
    setLoading(true);
    try {
      // Find all roles without a factory_id (global roles)
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .is("factory_id", null);

      if (error) throw error;

      if (!roles || roles.length === 0) {
        setGlobalRoles([]);
        setLoading(false);
        return;
      }

      // Fetch user details for these roles
      const userIds = [...new Set(roles.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const enriched: GlobalRole[] = roles.map((r) => {
        const userProfile = profileMap.get(r.user_id);
        return {
          id: r.id,
          user_id: r.user_id,
          role: r.role as AppRole,
          user_email: userProfile?.email || "Unknown",
          user_name: userProfile?.full_name || "Unknown User",
        };
      });

      setGlobalRoles(enriched);
      setSelectedIds(enriched.map((r) => r.id)); // Select all by default
    } catch (error) {
      console.error("Error fetching global roles:", error);
      toast.error("Failed to fetch global roles");
    } finally {
      setLoading(false);
    }
  }

  function toggleRole(roleId: string) {
    setSelectedIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  }

  function toggleAll() {
    if (selectedIds.length === globalRoles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(globalRoles.map((r) => r.id));
    }
  }

  async function handleCleanup() {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one role to remove");
      return;
    }

    setCleaning(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Removed ${selectedIds.length} global role(s)`);
      setOpen(false);
      setSelectedIds([]);
      onSuccess?.();
    } catch (error) {
      console.error("Error cleaning up roles:", error);
      toast.error("Failed to remove global roles");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Shield className="h-4 w-4" />
          Cleanup Global Roles
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Cleanup Global Admin Roles
          </DialogTitle>
          <DialogDescription>
            These roles were assigned without a factory scope. Remove them to fix
            permission issues.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : globalRoles.length === 0 ? (
          <div className="py-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-success mb-3" />
            <p className="text-sm text-muted-foreground">
              No global roles found. All roles are properly scoped!
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-muted-foreground">
                Found {globalRoles.length} global role(s)
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="text-xs"
              >
                {selectedIds.length === globalRoles.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <ScrollArea className="h-64 border rounded-md p-3">
              <div className="space-y-3">
                {globalRoles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={selectedIds.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                      className="mt-1"
                    />
                    <label
                      htmlFor={`role-${role.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <p className="font-medium text-sm">{role.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {role.user_email}
                      </p>
                      <span className="inline-flex items-center gap-1 mt-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                        <Shield className="h-3 w-3" />
                        Global {ROLE_LABELS[role.role] || role.role}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchGlobalRoles}
            disabled={loading || cleaning}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {globalRoles.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleCleanup}
              disabled={cleaning || selectedIds.length === 0}
            >
              {cleaning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove {selectedIds.length} Role(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
