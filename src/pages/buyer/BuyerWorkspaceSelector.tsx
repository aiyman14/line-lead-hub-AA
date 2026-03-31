import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBuyerMemberships } from "@/hooks/useBuyerMemberships";
import { useSwitchWorkspace } from "@/hooks/useSwitchWorkspace";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, FileText, LogOut } from "lucide-react";

export default function BuyerWorkspaceSelector() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { memberships, loading, membershipCount } = useBuyerMemberships();
  const { switchWorkspace, switching } = useSwitchWorkspace();

  // Auto-redirect if only 1 membership
  useEffect(() => {
    if (!loading && membershipCount === 1) {
      const only = memberships[0];
      if (profile?.factory_id === only.factory_id) {
        navigate("/buyer/dashboard", { replace: true });
      } else {
        switchWorkspace(only.factory_id);
      }
    }
  }, [loading, membershipCount]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (membershipCount === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No Workspaces Available</CardTitle>
            <CardDescription>
              You don't have any active factory memberships. Please contact a factory administrator to invite you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await signOut();
                navigate("/auth");
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <Building2 className="h-10 w-10 mx-auto text-primary mb-3" />
          <h1 className="text-2xl font-bold">Select a Workspace</h1>
          <p className="text-muted-foreground mt-1">
            Choose a factory to view your PO updates
          </p>
        </div>

        <div className="space-y-3">
          {memberships.map((m) => (
            <Card
              key={m.id}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${
                profile?.factory_id === m.factory_id ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => {
                if (!switching) switchWorkspace(m.factory_id);
              }}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{m.factory_name}</p>
                    {m.company_name && (
                      <p className="text-sm text-muted-foreground">{m.company_name}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{m.po_count} PO{m.po_count !== 1 ? "s" : ""}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {switching && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Switching workspace...
          </div>
        )}
      </div>
    </div>
  );
}
