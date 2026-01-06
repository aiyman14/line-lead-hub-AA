import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  Clock,
  Plus,
  ChevronRight,
  ClipboardList,
  Boxes,
  Timer,
} from "lucide-react";

interface DailySheetSummary {
  id: string;
  line_id: string;
  line_name: string;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  finishing_no: string | null;
  hours_logged: number;
  total_poly: number;
  total_carton: number;
  total_iron: number;
  created_at: string;
}

interface FinishingStats {
  totalSheets: number;
  totalHoursLogged: number;
  totalPoly: number;
  totalCarton: number;
  linesWithSheets: number;
}

export function FinishingDashboard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [sheets, setSheets] = useState<DailySheetSummary[]>([]);
  const [stats, setStats] = useState<FinishingStats>({
    totalSheets: 0,
    totalHoursLogged: 0,
    totalPoly: 0,
    totalCarton: 0,
    linesWithSheets: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFinishingData();
    }
  }, [profile?.factory_id]);

  async function fetchFinishingData() {
    if (!profile?.factory_id) return;
    
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Fetch today's daily sheets with hourly logs
      const { data: sheetsData } = await supabase
        .from('finishing_daily_sheets')
        .select('*, lines(id, line_id, name), work_orders(po_number, buyer, style), finishing_hourly_logs(*)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('created_at', { ascending: false });

      // Format sheets with aggregated data
      const formattedSheets: DailySheetSummary[] = (sheetsData || []).map((sheet: any) => {
        const logs = sheet.finishing_hourly_logs || [];
        return {
          id: sheet.id,
          line_id: sheet.lines?.line_id || 'Unknown',
          line_name: sheet.lines?.name || sheet.lines?.line_id || 'Unknown',
          po_number: sheet.work_orders?.po_number || sheet.po_no || null,
          buyer: sheet.work_orders?.buyer || sheet.buyer || null,
          style: sheet.work_orders?.style || sheet.style || null,
          finishing_no: sheet.finishing_no,
          hours_logged: logs.length,
          total_poly: logs.reduce((sum: number, l: any) => sum + (l.poly_actual || 0), 0),
          total_carton: logs.reduce((sum: number, l: any) => sum + (l.carton_actual || 0), 0),
          total_iron: logs.reduce((sum: number, l: any) => sum + (l.iron_actual || 0), 0),
          created_at: sheet.created_at,
        };
      });

      // Calculate stats
      const uniqueLines = new Set(formattedSheets.map(s => s.line_id));
      const totalStats: FinishingStats = {
        totalSheets: formattedSheets.length,
        totalHoursLogged: formattedSheets.reduce((sum, s) => sum + s.hours_logged, 0),
        totalPoly: formattedSheets.reduce((sum, s) => sum + s.total_poly, 0),
        totalCarton: formattedSheets.reduce((sum, s) => sum + s.total_carton, 0),
        linesWithSheets: uniqueLines.size,
      };

      setSheets(formattedSheets);
      setStats(totalStats);
    } catch (error) {
      console.error('Error fetching finishing data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString(i18n.language === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Max hours possible in a day (10 regular + 5 OT)
  const maxHoursPerSheet = 15;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        {/* Sheets skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Finishing Stats - Consolidated into 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Activity Card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Activity</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-3xl font-bold">{stats.totalSheets}</p>
                <p className="text-sm text-muted-foreground">Daily Sheets</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stats.linesWithSheets} lines active</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.totalHoursLogged}</p>
                <p className="text-sm text-muted-foreground">Hours Logged</p>
                <p className="text-xs text-muted-foreground mt-0.5">across all sheets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Output Card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Output</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-3xl font-bold text-success">{stats.totalPoly.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Poly Packed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-warning">{stats.totalCarton.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Cartons Packed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Daily Sheets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Today's Daily Sheets
          </CardTitle>
          <div className="flex gap-2">
            <Link to="/finishing/daily-sheet">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Sheet
              </Button>
            </Link>
            <Link to="/finishing/my-submissions">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {sheets.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {sheets.map((sheet) => (
                <Link
                  key={sheet.id}
                  to={`/finishing/daily-sheet?sheet=${sheet.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{sheet.line_name}</span>
                          {sheet.finishing_no && (
                            <Badge variant="outline" className="text-xs">
                              {sheet.finishing_no}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sheet.po_number || 'No PO'} • {sheet.style || 'No Style'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {sheet.hours_logged} hours logged
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Started {formatTime(sheet.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex gap-4">
                        <div>
                          <p className="font-mono font-bold text-lg text-success">{sheet.total_poly.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">poly</p>
                        </div>
                        <div>
                          <p className="font-mono font-bold text-lg text-warning">{sheet.total_carton.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">carton</p>
                        </div>
                      </div>
                      {/* Progress bar for hours */}
                      <div className="mt-2 w-32">
                        <Progress 
                          value={(sheet.hours_logged / maxHoursPerSheet) * 100} 
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No daily sheets today</p>
              <p className="text-sm mb-4">Start tracking finishing production for today</p>
              <Link to="/finishing/daily-sheet">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Daily Sheet
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
