import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Loader2, Calendar, Clock, Send, Globe, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface EmailSchedule {
  id?: string;
  schedule_type: "daily" | "weekly";
  is_active: boolean;
  send_time: string;
  day_of_week: number;
  last_sent_at: string | null;
}

export function EmailScheduleSettings() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [factoryTimezone, setFactoryTimezone] = useState<string>("UTC");
  const [dailySchedule, setDailySchedule] = useState<EmailSchedule>({
    schedule_type: "daily",
    is_active: false,
    send_time: "18:00",
    day_of_week: 5,
    last_sent_at: null,
  });
  const [weeklySchedule, setWeeklySchedule] = useState<EmailSchedule>({
    schedule_type: "weekly",
    is_active: false,
    send_time: "18:00",
    day_of_week: 5,
    last_sent_at: null,
  });

  useEffect(() => {
    if (user && profile?.factory_id) {
      fetchSchedules();
      fetchFactoryTimezone();
    }
  }, [user, profile?.factory_id]);

  async function fetchFactoryTimezone() {
    if (!profile?.factory_id) return;
    
    try {
      const { data, error } = await supabase
        .from("factory_accounts")
        .select("timezone")
        .eq("id", profile.factory_id)
        .single();
      
      if (error) throw error;
      setFactoryTimezone(data?.timezone || "UTC");
    } catch (error) {
      console.error("Error fetching factory timezone:", error);
    }
  }

  async function fetchSchedules() {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("email_schedules")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;

      // Set emails from first schedule found, or use profile email as default
      const firstSchedule = data?.[0];
      if (firstSchedule?.email) {
        // Parse comma-separated emails
        const emailList = firstSchedule.email.split(",").map((e: string) => e.trim()).filter(Boolean);
        setEmails(emailList.length > 0 ? emailList : [profile?.email || user.email || ""]);
      } else {
        setEmails([profile?.email || user.email || ""]);
      }

      data?.forEach((schedule) => {
        if (schedule.schedule_type === "daily") {
          setDailySchedule({
            id: schedule.id,
            schedule_type: "daily",
            is_active: schedule.is_active ?? false,
            send_time: schedule.send_time?.slice(0, 5) || "18:00",
            day_of_week: schedule.day_of_week ?? 5,
            last_sent_at: schedule.last_sent_at,
          });
        } else if (schedule.schedule_type === "weekly") {
          setWeeklySchedule({
            id: schedule.id,
            schedule_type: "weekly",
            is_active: schedule.is_active ?? false,
            send_time: schedule.send_time?.slice(0, 5) || "18:00",
            day_of_week: schedule.day_of_week ?? 5,
            last_sent_at: schedule.last_sent_at,
          });
        }
      });
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule(schedule: EmailSchedule) {
    if (!user || !profile?.factory_id) return;
    setSaving(true);

    try {
      // Join emails with comma for storage
      const emailString = emails.filter(e => e.trim()).join(", ");
      
      const scheduleData = {
        factory_id: profile.factory_id,
        user_id: user.id,
        email: emailString,
        schedule_type: schedule.schedule_type,
        is_active: schedule.is_active,
        send_time: schedule.send_time + ":00",
        day_of_week: schedule.day_of_week,
      };

      if (schedule.id) {
        const { error } = await supabase
          .from("email_schedules")
          .update(scheduleData)
          .eq("id", schedule.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("email_schedules")
          .insert(scheduleData)
          .select()
          .single();
        if (error) throw error;
        
        if (schedule.schedule_type === "daily") {
          setDailySchedule((prev) => ({ ...prev, id: data.id }));
        } else {
          setWeeklySchedule((prev) => ({ ...prev, id: data.id }));
        }
      }

      toast.success(`${schedule.schedule_type === "daily" ? "Daily" : "Weekly"} schedule saved`);
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  async function saveEmailRecipients() {
    if (!user || !profile?.factory_id) return;
    setSaving(true);

    try {
      const emailString = emails.filter(e => e.trim()).join(", ");
      
      // Update both schedules with the new email list
      const updates = [];
      
      if (dailySchedule.id) {
        updates.push(
          supabase
            .from("email_schedules")
            .update({ email: emailString })
            .eq("id", dailySchedule.id)
        );
      } else {
        // Create daily schedule if it doesn't exist
        updates.push(
          supabase
            .from("email_schedules")
            .insert({
              factory_id: profile.factory_id,
              user_id: user.id,
              email: emailString,
              schedule_type: "daily",
              is_active: false,
              send_time: "18:00:00",
              day_of_week: 5,
            })
            .select()
            .single()
            .then(({ data }) => {
              if (data) setDailySchedule(prev => ({ ...prev, id: data.id }));
            })
        );
      }
      
      if (weeklySchedule.id) {
        updates.push(
          supabase
            .from("email_schedules")
            .update({ email: emailString })
            .eq("id", weeklySchedule.id)
        );
      } else {
        // Create weekly schedule if it doesn't exist
        updates.push(
          supabase
            .from("email_schedules")
            .insert({
              factory_id: profile.factory_id,
              user_id: user.id,
              email: emailString,
              schedule_type: "weekly",
              is_active: false,
              send_time: "18:00:00",
              day_of_week: 5,
            })
            .select()
            .single()
            .then(({ data }) => {
              if (data) setWeeklySchedule(prev => ({ ...prev, id: data.id }));
            })
        );
      }

      await Promise.all(updates);
      toast.success(`Email recipients saved (${emails.filter(e => e.trim()).length} recipient(s))`);
    } catch (error) {
      console.error("Error saving email recipients:", error);
      toast.error("Failed to save email recipients");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail(scheduleType: "daily" | "weekly") {
    if (!profile?.factory_id) return;
    setSending(true);

    try {
      // Send to all email addresses
      const emailString = emails.filter(e => e.trim()).join(", ");
      
      const { data, error } = await supabase.functions.invoke("send-insights-report", {
        body: {
          email: emailString,
          factoryId: profile.factory_id,
          scheduleType: scheduleType,
          userId: user?.id,
        },
      });

      if (error) throw error;

      toast.success(`Test email sent to ${emails.length} recipient(s)! Check your inbox.`);
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSending(false);
    }
  }

  const daysOfWeek = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Email Report Scheduling
        </CardTitle>
        <CardDescription>
          Automatically receive insights reports via email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timezone Notice */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Emails will be sent according to your factory timezone:
          </span>
          <Badge variant="secondary" className="font-mono">
            {factoryTimezone}
          </Badge>
        </div>

        {/* Email Recipients */}
        <div className="space-y-3">
          <Label>Email Recipients</Label>
          <div className="space-y-2">
            {emails.map((emailAddr, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="email"
                  value={emailAddr}
                  onChange={(e) => {
                    const updated = [...emails];
                    updated[index] = e.target.value;
                    setEmails(updated);
                  }}
                  placeholder="email@example.com"
                  className="flex-1"
                />
                {emails.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEmails(emails.filter((_, i) => i !== index));
                    }}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Add another email..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newEmail.trim()) {
                  e.preventDefault();
                  if (!emails.includes(newEmail.trim())) {
                    setEmails([...emails, newEmail.trim()]);
                    setNewEmail("");
                  }
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (newEmail.trim() && !emails.includes(newEmail.trim())) {
                  setEmails([...emails, newEmail.trim()]);
                  setNewEmail("");
                }
              }}
              disabled={!newEmail.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={saveEmailRecipients}
            disabled={saving || emails.filter(e => e.trim()).length === 0}
            className="w-full sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
            Save Recipients
          </Button>
          <p className="text-xs text-muted-foreground">
            Click "Save Recipients" to save your email list. All recipients will receive both daily and weekly reports when enabled.
          </p>
        </div>

        {/* Daily Report */}
        <div className="p-4 rounded-lg border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Daily Report</span>
            </div>
            <Switch
              checked={dailySchedule.is_active}
              onCheckedChange={(checked) => {
                const updated = { ...dailySchedule, is_active: checked };
                setDailySchedule(updated);
                saveSchedule(updated);
              }}
            />
          </div>
          
          {dailySchedule.is_active && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="daily-time" className="text-sm">Send at:</Label>
                <Input
                  id="daily-time"
                  type="time"
                  value={dailySchedule.send_time}
                  onChange={(e) => setDailySchedule({ ...dailySchedule, send_time: e.target.value })}
                  className="w-28"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveSchedule(dailySchedule)}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => sendTestEmail("daily")}
                disabled={sending}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Test
              </Button>
            </div>
          )}
          
          {dailySchedule.last_sent_at && (
            <p className="text-xs text-muted-foreground">
              Last sent: {new Date(dailySchedule.last_sent_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* Weekly Report */}
        <div className="p-4 rounded-lg border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Weekly Report</span>
            </div>
            <Switch
              checked={weeklySchedule.is_active}
              onCheckedChange={(checked) => {
                const updated = { ...weeklySchedule, is_active: checked };
                setWeeklySchedule(updated);
                saveSchedule(updated);
              }}
            />
          </div>
          
          {weeklySchedule.is_active && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="weekly-day" className="text-sm">Day:</Label>
                <Select
                  value={weeklySchedule.day_of_week.toString()}
                  onValueChange={(v) => setWeeklySchedule({ ...weeklySchedule, day_of_week: parseInt(v) })}
                >
                  <SelectTrigger id="weekly-day" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="weekly-time" className="text-sm">at:</Label>
                <Input
                  id="weekly-time"
                  type="time"
                  value={weeklySchedule.send_time}
                  onChange={(e) => setWeeklySchedule({ ...weeklySchedule, send_time: e.target.value })}
                  className="w-28"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveSchedule(weeklySchedule)}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => sendTestEmail("weekly")}
                disabled={sending}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Test
              </Button>
            </div>
          )}
          
          {weeklySchedule.last_sent_at && (
            <p className="text-xs text-muted-foreground">
              Last sent: {new Date(weeklySchedule.last_sent_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>How it works:</strong> Emails are automatically sent at the scheduled times based on your factory timezone ({factoryTimezone}).
          </p>
          <p>
            You can change your factory timezone in <a href="/setup/factory" className="text-primary underline">Factory Settings</a>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
