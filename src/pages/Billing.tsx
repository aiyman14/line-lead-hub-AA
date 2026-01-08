import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { openExternalUrl } from "@/lib/capacitor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  CreditCard, 
  Receipt, 
  Settings, 
  Download, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  created: string;
  period_start: string | null;
  period_end: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

interface Subscription {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  items: Array<{
    price_id: string;
    product_id: string;
    amount: number;
    currency: string;
    interval: string;
  }>;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface BillingData {
  invoices: Invoice[];
  subscriptions: Subscription[];
  paymentMethods: PaymentMethod[];
}

export default function Billing() {
  const { user, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingData, setBillingData] = useState<BillingData | null>(null);

  useEffect(() => {
    fetchBillingHistory();
  }, [user]);

  const fetchBillingHistory = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-billing-history');
      
      if (error) throw error;
      setBillingData(data);
    } catch (err) {
      console.error('Error fetching billing history:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load billing history.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data.url) {
        await openExternalUrl(data.url);
      }
    } catch (err) {
      console.error('Error opening portal:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
      case 'active':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'open':
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'void':
      case 'uncollectible':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubscriptionStatusBadge = (sub: Subscription) => {
    if (sub.cancel_at_period_end) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Canceling</Badge>;
    }
    switch (sub.status) {
      case 'active':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge variant="outline">Canceled</Badge>;
      default:
        return <Badge variant="outline">{sub.status}</Badge>;
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!isAdminOrHigher()) {
    return (
      <div className="container max-w-2xl py-8 px-4">
        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              Only factory owners and admins can view billing information.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeSubscription = billingData?.subscriptions.find(
    s => s.status === 'active' || s.status === 'trialing'
  );

  return (
    <div className="container max-w-5xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and view billing history
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoice History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Active Subscription */}
          <Card>
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSubscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Production Portal</p>
                      <p className="text-sm text-muted-foreground">
                        {activeSubscription.items[0]?.amount 
                          ? formatCurrency(activeSubscription.items[0].amount, activeSubscription.items[0].currency)
                          : '$350.00'} / {activeSubscription.items[0]?.interval || 'month'}
                      </p>
                    </div>
                    {getSubscriptionStatusBadge(activeSubscription)}
                  </div>
                  
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm">
                      <span className="font-medium">Next billing date:</span>{" "}
                      {new Date(activeSubscription.current_period_end).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    {activeSubscription.cancel_at_period_end && (
                      <p className="text-sm text-destructive mt-2">
                        Your subscription will end on this date
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No active subscription</p>
                  <Button onClick={() => navigate('/subscription')}>
                    View Plans
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Cards on file for billing</CardDescription>
            </CardHeader>
            <CardContent>
              {billingData?.paymentMethods && billingData.paymentMethods.length > 0 ? (
                <div className="space-y-3">
                  {billingData.paymentMethods.map(pm => (
                    <div key={pm.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium capitalize">{pm.brand} •••• {pm.last4}</p>
                          <p className="text-sm text-muted-foreground">
                            Expires {pm.exp_month}/{pm.exp_year}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No payment methods on file</p>
              )}
              
              <Button 
                onClick={handleManageBilling} 
                disabled={portalLoading}
                variant="outline"
                className="w-full mt-4"
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Payment Methods
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>Your past invoices and payments</CardDescription>
            </CardHeader>
            <CardContent>
              {billingData?.invoices && billingData.invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingData.invoices.map(invoice => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.number || invoice.id.slice(0, 12)}
                        </TableCell>
                        <TableCell>
                          {new Date(invoice.created).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(invoice.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {invoice.invoice_pdf && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openExternalUrl(invoice.invoice_pdf!)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {invoice.hosted_invoice_url && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openExternalUrl(invoice.hosted_invoice_url!)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invoices yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Billing Settings</CardTitle>
              <CardDescription>Manage your billing preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Billing Portal</p>
                  <p className="text-sm text-muted-foreground">
                    Update payment methods, download invoices, and manage your subscription
                  </p>
                </div>
                <Button 
                  onClick={handleManageBilling} 
                  disabled={portalLoading}
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Open Portal
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Change Plan</p>
                  <p className="text-sm text-muted-foreground">
                    Upgrade, downgrade, or cancel your subscription
                  </p>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/subscription')}
                >
                  View Plans
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Refresh Data</p>
                  <p className="text-sm text-muted-foreground">
                    Sync the latest billing information from payment provider
                  </p>
                </div>
                <Button 
                  variant="ghost"
                  onClick={fetchBillingHistory}
                >
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
