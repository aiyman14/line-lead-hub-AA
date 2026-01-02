import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, Search, Filter, Clock } from "lucide-react";
import { BLOCKER_IMPACT_LABELS } from "@/lib/constants";

interface Blocker {
  id: string;
  type: 'sewing' | 'finishing';
  line_name: string;
  po_number: string | null;
  description: string | null;
  impact: string | null;
  owner: string | null;
  status: string;
  submitted_at: string;
  production_date: string;
}

export default function Blockers() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterImpact, setFilterImpact] = useState("all");
  const [activeTab, setActiveTab] = useState("open");

  useEffect(() => {
    if (profile?.factory_id) {
      fetchBlockers();
    }
  }, [profile?.factory_id]);

  async function fetchBlockers() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      const [sewingRes, finishingRes] = await Promise.all([
        supabase
          .from('production_updates_sewing')
          .select('*, lines(line_id, name), work_orders(po_number)')
          .eq('factory_id', profile.factory_id)
          .eq('has_blocker', true)
          .order('submitted_at', { ascending: false })
          .limit(100),
        supabase
          .from('production_updates_finishing')
          .select('*, lines(line_id, name), work_orders(po_number)')
          .eq('factory_id', profile.factory_id)
          .eq('has_blocker', true)
          .order('submitted_at', { ascending: false })
          .limit(100),
      ]);

      const sewingBlockers: Blocker[] = (sewingRes.data || []).map(b => ({
        id: b.id,
        type: 'sewing',
        line_name: b.lines?.name || b.lines?.line_id || 'Unknown',
        po_number: b.work_orders?.po_number || null,
        description: b.blocker_description,
        impact: b.blocker_impact,
        owner: b.blocker_owner,
        status: b.blocker_status || 'open',
        submitted_at: b.submitted_at,
        production_date: b.production_date,
      }));

      const finishingBlockers: Blocker[] = (finishingRes.data || []).map(b => ({
        id: b.id,
        type: 'finishing',
        line_name: b.lines?.name || b.lines?.line_id || 'Unknown',
        po_number: b.work_orders?.po_number || null,
        description: b.blocker_description,
        impact: b.blocker_impact,
        owner: b.blocker_owner,
        status: b.blocker_status || 'open',
        submitted_at: b.submitted_at,
        production_date: b.production_date,
      }));

      setBlockers([...sewingBlockers, ...finishingBlockers].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      ));
    } catch (error) {
      console.error('Error fetching blockers:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredBlockers = blockers.filter(b => {
    const matchesSearch = b.line_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.po_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesImpact = filterImpact === 'all' || b.impact === filterImpact;
    const matchesTab = activeTab === 'all' || b.status === activeTab;
    return matchesSearch && matchesImpact && matchesTab;
  });

  const openBlockers = blockers.filter(b => b.status === 'open');
  const inProgressBlockers = blockers.filter(b => b.status === 'in_progress');
  const resolvedBlockers = blockers.filter(b => b.status === 'resolved');

  const getImpactColor = (impact: string | null) => {
    switch (impact) {
      case 'critical': return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'high': return 'bg-orange-500/10 border-orange-500/30 text-orange-600';
      case 'medium': return 'bg-warning/10 border-warning/30 text-warning';
      case 'low': return 'bg-success/10 border-success/30 text-success';
      default: return 'bg-muted border-border';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Blockers
          </h1>
          <p className="text-muted-foreground">Track and resolve production blockers</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{openBlockers.length}</p>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-warning">{inProgressBlockers.length}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-success">{resolvedBlockers.length}</p>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blockers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterImpact} onValueChange={setFilterImpact}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by impact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Impacts</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open">Open ({openBlockers.length})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({inProgressBlockers.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedBlockers.length})</TabsTrigger>
          <TabsTrigger value="all">All ({blockers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredBlockers.length > 0 ? (
            <div className="space-y-3">
              {filteredBlockers.map((blocker) => (
                <Card key={blocker.id} className={`border ${getImpactColor(blocker.impact)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold">{blocker.line_name}</span>
                          <StatusBadge variant={blocker.type} size="sm">{blocker.type}</StatusBadge>
                          {blocker.impact && (
                            <StatusBadge variant={blocker.impact as any} size="sm">
                              {BLOCKER_IMPACT_LABELS[blocker.impact as keyof typeof BLOCKER_IMPACT_LABELS] || blocker.impact}
                            </StatusBadge>
                          )}
                          {blocker.po_number && (
                            <span className="text-xs text-muted-foreground">{blocker.po_number}</span>
                          )}
                        </div>
                        <p className="text-sm text-foreground mb-2">
                          {blocker.description || 'No description provided'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {blocker.owner && (
                            <span>Owner: <span className="font-medium text-foreground">{blocker.owner}</span></span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(blocker.submitted_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No blockers found</p>
                {activeTab === 'open' && <p className="text-sm">Production is running smoothly!</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
