/**
 * Network Status Indicator
 * Shows online/offline status, pending count, and sync controls
 */

import { useState } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/utils';
import { getQueuedSubmissions } from '@/lib/offline-queue';
import { format } from 'date-fns';

export function NetworkStatusIndicator() {
  const {
    isOnline,
    pendingCount,
    failedCount,
    isSyncing,
    manualSync,
    retryFailed,
    clearFailed,
  } = useNetworkStatus();

  const [open, setOpen] = useState(false);
  const submissions = getQueuedSubmissions();

  const showIndicator = !isOnline || pendingCount > 0 || failedCount > 0;

  if (!showIndicator && isOnline) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'relative h-8 gap-1.5 px-2',
            !isOnline && 'text-destructive',
            failedCount > 0 && 'text-destructive',
            pendingCount > 0 && isOnline && !failedCount && 'text-amber-600'
          )}
        >
          {isOnline ? (
            pendingCount > 0 || failedCount > 0 ? (
              <Cloud className={cn('h-4 w-4', isSyncing && 'animate-pulse')} />
            ) : (
              <Wifi className="h-4 w-4" />
            )
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          
          {(pendingCount > 0 || failedCount > 0) && (
            <Badge 
              variant={failedCount > 0 ? 'destructive' : 'secondary'} 
              className="h-5 min-w-5 px-1 text-xs"
            >
              {pendingCount + failedCount}
            </Badge>
          )}

          {!isOnline && (
            <span className="hidden sm:inline text-xs font-medium">Offline</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {isSyncing && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Syncing...
              </div>
            )}
          </div>

          {/* Pending/Failed Counts */}
          {(pendingCount > 0 || failedCount > 0) && (
            <div className="flex gap-4 text-sm">
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Cloud className="h-4 w-4 text-amber-600" />
                  <span>{pendingCount} pending</span>
                </div>
              )}
              {failedCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span>{failedCount} failed</span>
                </div>
              )}
            </div>
          )}

          {/* Queue Details */}
          {submissions.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Queued Submissions
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {submissions.slice(0, 5).map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                  >
                    <div>
                      <div className="font-medium capitalize">
                        {sub.formType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-muted-foreground">
                        {format(new Date(sub.timestamp), 'MMM d, h:mm a')}
                      </div>
                    </div>
                    <Badge
                      variant={
                        sub.status === 'failed' ? 'destructive' :
                        sub.status === 'syncing' ? 'default' : 'secondary'
                      }
                      className="text-[10px] h-5"
                    >
                      {sub.status}
                    </Badge>
                  </div>
                ))}
                {submissions.length > 5 && (
                  <div className="text-xs text-center text-muted-foreground">
                    +{submissions.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            {pendingCount > 0 && isOnline && (
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={manualSync}
                disabled={isSyncing}
              >
                <RefreshCw className={cn('h-3 w-3 mr-1.5', isSyncing && 'animate-spin')} />
                Sync Now
              </Button>
            )}
            {failedCount > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={retryFailed}
                  disabled={isSyncing}
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearFailed}
                  className="text-destructive"
                >
                  <X className="h-3 w-3 mr-1.5" />
                  Clear
                </Button>
              </>
            )}
          </div>

          {/* Offline Message */}
          {!isOnline && (
            <p className="text-xs text-muted-foreground">
              Your submissions will be saved locally and synced automatically when you're back online.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
