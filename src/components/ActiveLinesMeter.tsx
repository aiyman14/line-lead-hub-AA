import { useActiveLines } from '@/hooks/useActiveLines';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Rows3, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLAN_TIERS, getMaxLinesDisplay } from '@/lib/plan-tiers';

interface ActiveLinesMeterProps {
  compact?: boolean;
  showUpgrade?: boolean;
}

export function ActiveLinesMeter({ compact = false, showUpgrade = true }: ActiveLinesMeterProps) {
  const navigate = useNavigate();
  const { status, loading } = useActiveLines();

  if (loading || !status) {
    return null;
  }

  const { activeCount, maxLines, planTier, isAtLimit, archivedCount } = status;
  const planConfig = PLAN_TIERS[planTier];
  
  // Calculate percentage for progress bar
  const percentage = maxLines ? Math.min((activeCount / maxLines) * 100, 100) : 0;
  
  // Determine color based on usage
  const getProgressColor = () => {
    if (isAtLimit) return 'bg-destructive';
    if (percentage >= 80) return 'bg-warning';
    return 'bg-primary';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Rows3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Active Lines:</span>
        <span className={`font-medium ${isAtLimit ? 'text-destructive' : ''}`}>
          {activeCount} / {getMaxLinesDisplay(maxLines)}
        </span>
        {isAtLimit && (
          <Badge variant="destructive" className="text-xs">
            Limit Reached
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className={isAtLimit ? 'border-destructive/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Rows3 className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Active Line Slots</p>
              <p className="text-xs text-muted-foreground">{planConfig.name} Plan</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${isAtLimit ? 'text-destructive' : ''}`}>
              {activeCount}
              <span className="text-base text-muted-foreground font-normal">
                {' '}/ {getMaxLinesDisplay(maxLines)}
              </span>
            </p>
            {archivedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                +{archivedCount} archived
              </p>
            )}
          </div>
        </div>

        {maxLines && (
          <div className="space-y-1.5">
            <Progress 
              value={percentage} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(percentage)}% used</span>
              <span>{maxLines - activeCount} slots available</span>
            </div>
          </div>
        )}

        {isAtLimit && showUpgrade && (
          <div className="mt-4 p-3 bg-destructive/10 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Plan limit reached</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upgrade your plan to activate more production lines
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={() => navigate('/billing-plan')}
              className="shrink-0"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Upgrade
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
