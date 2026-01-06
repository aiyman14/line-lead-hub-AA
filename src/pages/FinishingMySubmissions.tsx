import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isToday, parseISO } from "date-fns";
import { FileText, Eye, Clock } from "lucide-react";

interface FinishingSheet {
  id: string;
  production_date: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  item: string | null;
  color: string | null;
  finishing_no: string | null;
  created_at: string | null;
  line_id: string;
  work_order_id: string;
  line: {
    line_id: string;
    name: string | null;
  } | null;
  work_order: {
    po_number: string;
    style: string;
    buyer: string;
    order_qty: number;
  } | null;
  hourly_logs_count: number;
}

export default function FinishingMySubmissions() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<FinishingSheet[]>([]);

  useEffect(() => {
    if (profile?.factory_id && user) {
      fetchMySheets();
    }
  }, [profile?.factory_id, user]);

  const fetchMySheets = async () => {
    try {
      // Fetch sheets created by current user
      const { data: sheetsData, error } = await supabase
        .from("finishing_daily_sheets")
        .select(`
          id,
          production_date,
          buyer,
          style,
          po_no,
          item,
          color,
          finishing_no,
          created_at,
          line_id,
          work_order_id,
          line:lines(line_id, name),
          work_order:work_orders(po_number, style, buyer, order_qty)
        `)
        .eq("factory_id", profile!.factory_id!)
        .eq("created_by", user!.id)
        .order("production_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each sheet, get hourly logs count
      const sheetsWithCounts = await Promise.all(
        (sheetsData || []).map(async (sheet) => {
          const { count } = await supabase
            .from("finishing_hourly_logs")
            .select("*", { count: "exact", head: true })
            .eq("sheet_id", sheet.id);

          return {
            ...sheet,
            hourly_logs_count: count || 0,
          };
        })
      );

      setSheets(sheetsWithCounts as FinishingSheet[]);
    } catch (error) {
      console.error("Error fetching sheets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSheet = (sheet: FinishingSheet) => {
    // Navigate to daily sheet with pre-selected line and work order
    navigate(`/finishing/daily-sheet?line=${sheet.line_id}&po=${sheet.work_order_id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">My Finishing Submissions</h1>
        </div>
        <Button onClick={() => navigate("/finishing/daily-sheet")}>
          + New Daily Sheet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
        </CardHeader>
        <CardContent>
          {sheets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No submissions found</p>
              <p className="text-sm mt-2">
                Create a new daily sheet to start logging hourly production
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead>PO / Style</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-center">Hours Logged</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.map((sheet) => {
                  const date = parseISO(sheet.production_date);
                  const isTodaySheet = isToday(date);
                  const hoursProgress = sheet.hourly_logs_count;

                  return (
                    <TableRow key={sheet.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{format(date, "MMM dd, yyyy")}</span>
                          {isTodaySheet && (
                            <Badge variant="secondary" className="text-xs">
                              Today
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {sheet.line?.line_id || "—"}
                        </span>
                        {sheet.line?.name && (
                          <span className="text-muted-foreground ml-1">
                            ({sheet.line.name})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {sheet.po_no || sheet.work_order?.po_number || "—"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {sheet.style || sheet.work_order?.style || "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sheet.buyer || sheet.work_order?.buyer || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Badge
                            variant={
                              hoursProgress === 10
                                ? "default"
                                : hoursProgress > 0
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {hoursProgress} / 10
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSheet(sheet)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {isTodaySheet ? "Continue" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
