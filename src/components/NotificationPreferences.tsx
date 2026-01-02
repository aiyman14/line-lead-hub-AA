import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Mail, AlertTriangle, TrendingDown, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NotificationPreference {
  id: string;
  notification_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
}

const NOTIFICATION_TYPES = [
  {
    type: "low_efficiency",
    label: "Low Efficiency Alerts",
    description: "Get notified when line efficiency drops below target",
    icon: TrendingDown,
  },
  {
    type: "critical_blocker",
    label: "Critical Blockers",
    description: "Get notified when critical blockers are reported",
    icon: AlertTriangle,
  },
  {
    type: "general",
    label: "General Notifications",
    description: "System updates and general announcements",
    icon: Info,
  },
];

export function NotificationPreferences() {
  const { user, profile } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && profile?.factory_id) {
      fetchPreferences();
    }
  }, [user, profile?.factory_id]);

  async function fetchPreferences() {
    if (!user) return;

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching preferences:", error);
      // Initialize with defaults if no preferences exist
      initializeDefaults();
      return;
    }

    if (data && data.length > 0) {
      setPreferences(data);
    } else {
      initializeDefaults();
    }
    setLoading(false);
  }

  async function initializeDefaults() {
    if (!user || !profile?.factory_id) return;

    const defaultPrefs = NOTIFICATION_TYPES.map((nt) => ({
      user_id: user.id,
      factory_id: profile.factory_id,
      notification_type: nt.type,
      in_app_enabled: true,
      email_enabled: false,
    }));

    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(defaultPrefs, { onConflict: "user_id,notification_type" })
      .select();

    if (!error && data) {
      setPreferences(data);
    }
    setLoading(false);
  }

  async function updatePreference(
    notificationType: string,
    field: "in_app_enabled" | "email_enabled",
    value: boolean
  ) {
    if (!user) return;

    // Optimistic update
    setPreferences((prev) =>
      prev.map((p) =>
        p.notification_type === notificationType ? { ...p, [field]: value } : p
      )
    );

    const { error } = await supabase
      .from("notification_preferences")
      .update({ [field]: value })
      .eq("user_id", user.id)
      .eq("notification_type", notificationType);

    if (error) {
      console.error("Error updating preference:", error);
      toast.error("Failed to update preference");
      // Revert on error
      fetchPreferences();
    }
  }

  async function saveAllPreferences() {
    setSaving(true);
    toast.success("Preferences saved successfully");
    setSaving(false);
  }

  function getPreference(type: string): NotificationPreference | undefined {
    return preferences.find((p) => p.notification_type === type);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Configure how you want to receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          {/* Header row */}
          <div className="grid grid-cols-[1fr,80px,80px] gap-4 items-center pb-2 border-b">
            <div className="text-sm font-medium text-muted-foreground">
              Notification Type
            </div>
            <div className="flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground">
              <Bell className="h-4 w-4" />
              In-App
            </div>
            <div className="flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground">
              <Mail className="h-4 w-4" />
              Email
            </div>
          </div>

          {/* Preference rows */}
          {NOTIFICATION_TYPES.map((nt) => {
            const pref = getPreference(nt.type);
            const Icon = nt.icon;

            return (
              <div
                key={nt.type}
                className="grid grid-cols-[1fr,80px,80px] gap-4 items-center py-2"
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <Label className="font-medium">{nt.label}</Label>
                    <p className="text-sm text-muted-foreground">
                      {nt.description}
                    </p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={pref?.in_app_enabled ?? true}
                    onCheckedChange={(checked) =>
                      updatePreference(nt.type, "in_app_enabled", checked)
                    }
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={pref?.email_enabled ?? false}
                    onCheckedChange={(checked) =>
                      updatePreference(nt.type, "email_enabled", checked)
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={saveAllPreferences} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
