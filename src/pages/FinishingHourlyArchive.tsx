import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Archive, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HourlyLogGrid } from "@/components/finishing/HourlyLogGrid";

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

interface DailySheet {
  id: string;
  production_date: string;
  line_id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  finishing_hourly_logs: any[];
  line: {
    line_id: string;
    name: string | null;
  } | null;
  work_order: {
    po_number: string;
    style: string;
    buyer: string;
  } | null;
}

// Standard hour slots
const HOUR_SLOTS = [
  "08-09", "09-10", "10-11", "11-12", "12-01", "01-02", "02-03", "03-04", "04-05",
  "OT-1", "OT-2", "OT-3"
];

export default function FinishingHourlyArchive() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [sheets, setSheets] = useState<DailySheet[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (profile?.factory_id) {
      fetchData();
    }
  }, [profile?.factory_id]);

  useEffect(() => {
    if (selectedLineId && selectedDate && profile?.factory_id) {
      fetchSheets();
    }
  }, [selectedLineId, selectedDate, profile?.factory_id]);

  async function fetchData() {
    try {
      const { data: linesData } = await supabase
        .from("lines")
        .select("id, line_id, name")
        .eq("factory_id", profile!.factory_id!)
        .eq("is_active", true)
        .order("line_id");

      setLines(linesData || []);
      if (linesData && linesData.length > 0) {
        setSelectedLineId(linesData[0].id);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSheets() {
    try {
      const { data, error } = await supabase
        .from("finishing_daily_sheets")
        .select(`
          *,
          line:lines(line_id, name),
          work_order:work_orders(po_number, style, buyer),
          finishing_hourly_logs(*)
        `)
        .eq("factory_id", profile!.factory_id!)
        .eq("line_id", selectedLineId)
        .eq("production_date", selectedDate)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSheets(data as DailySheet[]);
    } catch (error) {
      console.error("Error fetching sheets:", error);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Archive className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Hourly Log Archive</h1>
            <p className="text-sm text-muted-foreground">
              Read-only view of historical hourly production logs
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <Lock className="h-5 w-5 text-amber-600" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          This is an archive of historical hourly logs. New submissions should use the Daily Target and Daily Output forms.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Line</label>
              <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select line" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name || line.line_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sheets */}
      {sheets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hourly logs found for this date and line</p>
            <p className="text-sm mt-2">
              Try selecting a different date or line
            </p>
          </CardContent>
        </Card>
      ) : (
        sheets.map((sheet) => (
          <Card key={sheet.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{sheet.work_order?.po_number || sheet.po_no}</span>
                  <span className="text-muted-foreground ml-2">
                    - {sheet.work_order?.style || sheet.style}
                  </span>
                </div>
                <Badge variant="outline">
                  {sheet.finishing_hourly_logs?.length || 0} hours logged
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <HourlyLogGrid
                  hourSlots={HOUR_SLOTS}
                  hourlyLogs={sheet.finishing_hourly_logs || []}
                  currentHourSlot={null}
                  isAdmin={false}
                  userId={user?.id || ""}
                  onAddHour={() => {}} // No-op - archive is read-only
                  onToggleLock={() => {}} // No-op - archive is read-only
                />
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
