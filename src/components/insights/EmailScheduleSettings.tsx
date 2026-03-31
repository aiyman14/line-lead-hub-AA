import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Loader2, Calendar, Clock, Send, Globe, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface EmailSchedule {
  id?: string;
  schedule_type: "daily" | "weekly" | "monthly";
  is_active: boolean;
  send_time: string;
  day_of_week: number;
  day_of_month?: number;
  last_sent_at: string | null;
}

export function EmailScheduleSettings() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState("");
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
  const [monthlySchedule, setMonthlySchedule] = useState<EmailSchedule>({
    schedule_type: "monthly",
    is_active: false,
    send_time: "18:00",
    day_of_week: 0,
    day_of_month: 1,
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

      // Set email from profile
      setEmail(profile?.email || user.email || "");

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
        } else if (schedule.schedule_type === "monthly") {
          setMonthlySchedule({
            id: schedule.id,
            schedule_type: "monthly",
            is_active: schedule.is_active ?? false,
            send_time: schedule.send_time?.slice(0, 5) || "18:00",
            day_of_week: schedule.day_of_week ?? 0,
            day_of_month: 1, // Default since not in DB
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
      const scheduleData = {
        factory_id: profile.factory_id,
        user_id: user.id,
        email: email,
        schedule_type: schedule.schedule_type,
        is_active: schedule.is_active,
        send_time: schedule.send_time + ":00",
        day_of_week: schedule.day_of_week,
        day_of_month: schedule.day_of_month || null,
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
        } else if (schedule.schedule_type === "weekly") {
          setWeeklySchedule((prev) => ({ ...prev, id: data.id }));
        } else {
          setMonthlySchedule((prev) => ({ ...prev, id: data.id }));
        }
      }

      const scheduleTypeLabel = schedule.schedule_type === "daily" ? "Daily" : schedule.schedule_type === "weekly" ? "Weekly" : "Monthly";
      toast.success(`${scheduleTypeLabel} schedule saved`);
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail(scheduleType: "daily" | "weekly" | "monthly") {
    if (!profile?.factory_id) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-insights-report", {
        body: {
          email: email,
          factoryId: profile.factory_id,
          scheduleType: scheduleType,
          userId: user?.id,
        },
      });

      if (error) throw error;

      toast.success("Test email sent! Check your inbox.");
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(error?.message || "Failed to send test email");
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
        {/* Setup Instructions Notice */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-warning">Setup Required for Automated Emails</p>
            <p className="text-sm text-muted-foreground">
              Email scheduling requires an external cron service to trigger scheduled emails.
              The "Test" button works immediately, but automated schedules need additional setup.
            </p>
            <a
              href="https://github.com/anthropics/claude-code/blob/main/docs/EMAIL_SCHEDULING_SETUP.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View Setup Guide <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

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

        {/* Email Address */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="daily-time" className="text-sm whitespace-nowrap">Send at:</Label>
                <Input
                  id="daily-time"
                  type="time"
                  value={dailySchedule.send_time}
                  onChange={(e) => setDailySchedule({ ...dailySchedule, send_time: e.target.value })}
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-2">
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

        {/* Monthly Report */}
        <div className="p-4 rounded-lg border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Monthly Report</span>
              <Badge variant="secondary" className="text-xs">CSV Export</Badge>
            </div>
            <Switch
              checked={monthlySchedule.is_active}
              onCheckedChange={(checked) => {
                const updated = { ...monthlySchedule, is_active: checked };
                setMonthlySchedule(updated);
                saveSchedule(updated);
              }}
            />
          </div>

          {monthlySchedule.is_active && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Includes 30-day insights report and CSV export of all submissions
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="monthly-day" className="text-sm">Day of month:</Label>
                  <Select
                    value={monthlySchedule.day_of_month?.toString() || "1"}
                    onValueChange={(v) => setMonthlySchedule({ ...monthlySchedule, day_of_month: parseInt(v) })}
                  >
                    <SelectTrigger id="monthly-day" className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="monthly-time" className="text-sm">at:</Label>
                  <Input
                    id="monthly-time"
                    type="time"
                    value={monthlySchedule.send_time}
                    onChange={(e) => setMonthlySchedule({ ...monthlySchedule, send_time: e.target.value })}
                    className="w-28"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveSchedule(monthlySchedule)}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => sendTestEmail("monthly")}
                  disabled={sending}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Test
                </Button>
              </div>
            </div>
          )}

          {monthlySchedule.last_sent_at && (
            <p className="text-xs text-muted-foreground">
              Last sent: {new Date(monthlySchedule.last_sent_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>How it works:</strong> Emails are automatically sent at the scheduled times based on your factory timezone ({factoryTimezone}).
          </p>
          <p>
            Monthly reports include a CSV file with all submissions from the last 30 days and comprehensive insights.
          </p>
          <p>
            You can change your factory timezone in <a href="/setup/factory" className="text-primary underline">Factory Settings</a>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
