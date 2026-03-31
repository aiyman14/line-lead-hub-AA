import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DEV_FACTORY_ID_PREFIX } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { format } from "date-fns";

interface ChatAnalyticsEntry {
  id: string;
  message_id: string | null;
  conversation_id: string | null;
  factory_id: string | null;
  question_text: string | null;
  answer_length: number | null;
  citations_count: number | null;
  no_evidence: boolean | null;
  feedback: string | null;
  feedback_comment: string | null;
  user_role: string | null;
  language: string | null;
  created_at: string;
}

interface AnalyticsSummary {
  totalQuestions: number;
  unansweredQuestions: number;
  positiveRatings: number;
  negativeRatings: number;
  averageCitations: number;
}

export default function ChatAnalytics() {
  const { isAdminOrHigher, profile } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<ChatAnalyticsEntry[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("unanswered");

  // Check admin access + dev factory only
  useEffect(() => {
    if (!isAdminOrHigher() || !profile?.factory_id?.startsWith(DEV_FACTORY_ID_PREFIX)) {
      navigate("/dashboard");
    }
  }, [isAdminOrHigher, profile, navigate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_analytics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      setAnalytics((data || []) as ChatAnalyticsEntry[]);

      // Calculate summary
      const total = data?.length || 0;
      const unanswered = data?.filter((d: any) => d.no_evidence).length || 0;
      const positive = data?.filter((d: any) => d.feedback === "thumbs_up").length || 0;
      const negative = data?.filter((d: any) => d.feedback === "thumbs_down").length || 0;
      const avgCitations =
        total > 0
          ? data!.reduce((sum: number, d: any) => sum + (d.citations_count || 0), 0) / total
          : 0;

      setSummary({
        totalQuestions: total,
        unansweredQuestions: unanswered,
        positiveRatings: positive,
        negativeRatings: negative,
        averageCitations: avgCitations,
      });
    } catch (err) {
      console.error("Error fetching analytics:", err);
      toast.error("Error", { description: "Failed to load analytics" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const filteredAnalytics = analytics.filter((entry) => {
    switch (activeTab) {
      case "unanswered":
        return entry.no_evidence;
      case "negative":
        return entry.feedback === "thumbs_down";
      case "positive":
        return entry.feedback === "thumbs_up";
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chat Analytics</h1>
          <p className="text-muted-foreground">
            Monitor chat assistant performance and user feedback
          </p>
        </div>
        <Button variant="outline" onClick={fetchAnalytics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Questions</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
                {summary.totalQuestions}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unanswered</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <HelpCircle className="h-6 w-6 text-amber-500" />
                {summary.unansweredQuestions}
                <span className="text-sm font-normal text-muted-foreground">
                  ({((summary.unansweredQuestions / summary.totalQuestions) * 100 || 0).toFixed(1)}%)
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Positive Feedback</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <ThumbsUp className="h-6 w-6 text-green-500" />
                {summary.positiveRatings}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Negative Feedback</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <ThumbsDown className="h-6 w-6 text-red-500" />
                {summary.negativeRatings}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Analytics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Question Log</CardTitle>
          <CardDescription>
            View and analyze user questions and assistant responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All ({analytics.length})
              </TabsTrigger>
              <TabsTrigger value="unanswered">
                <AlertCircle className="h-4 w-4 mr-1" />
                Unanswered ({analytics.filter((a) => a.no_evidence).length})
              </TabsTrigger>
              <TabsTrigger value="negative">
                <ThumbsDown className="h-4 w-4 mr-1" />
                Negative ({analytics.filter((a) => a.feedback === "thumbs_down").length})
              </TabsTrigger>
              <TabsTrigger value="positive">
                <ThumbsUp className="h-4 w-4 mr-1" />
                Positive ({analytics.filter((a) => a.feedback === "thumbs_up").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filteredAnalytics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No entries in this category</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Citations</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnalytics.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="max-w-[400px]">
                          <p className="truncate font-medium">
                            {entry.question_text}
                          </p>
                          {entry.feedback_comment && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              "{entry.feedback_comment}"
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.user_role}</Badge>
                        </TableCell>
                        <TableCell>{entry.citations_count || 0}</TableCell>
                        <TableCell>
                          {entry.no_evidence ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              No Evidence
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Answered</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.feedback === "thumbs_up" && (
                            <ThumbsUp className="h-4 w-4 text-green-500" />
                          )}
                          {entry.feedback === "thumbs_down" && (
                            <ThumbsDown className="h-4 w-4 text-red-500" />
                          )}
                          {!entry.feedback && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(entry.created_at), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tips for improving */}
      <Card>
        <CardHeader>
          <CardTitle>Improvement Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>High "No Evidence" rate?</strong> Add more documents to the
            knowledge base covering frequently asked topics.
          </p>
          <p>
            <strong>Negative feedback?</strong> Review the questions and ensure
            the knowledge base has accurate, up-to-date information.
          </p>
          <p>
            <strong>Low citation count?</strong> Improve document chunking or add
            more specific content for common questions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
