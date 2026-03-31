/**
 * Hook for monitoring network status and offline queue
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  processQueue,
  getPendingCount,
  getFailedCount,
  hasPendingSubmissions,
  setupOnlineSync,
  retryFailedSubmissions,
  clearFailedSubmissions,
  type SyncResult,
} from '@/lib/offline-queue';

export interface NetworkStatus {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [failedCount, setFailedCount] = useState(getFailedCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Update counts
  const updateCounts = useCallback(() => {
    setPendingCount(getPendingCount());
    setFailedCount(getFailedCount());
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online', {
        description: hasPendingSubmissions() ? 'Syncing pending submissions...' : undefined,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline', {
        description: 'Submissions will be saved and synced when online.',
      });
    };

    const handleQueueUpdate = () => {
      updateCounts();
    };

    // Cross-tab sync: update counts when another tab modifies the queue in localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pp_offline_submission_queue') {
        updateCounts();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-updated', handleQueueUpdate);
    window.addEventListener('storage', handleStorageChange);

    // Setup automatic sync on online
    const cleanup = setupOnlineSync((result) => {
      setLastSyncResult(result);
      updateCounts();

      if (result.successful.length > 0) {
        toast.success(`Synced ${result.successful.length} submission(s)`);
      }
      if (result.failed.length > 0) {
        toast.error(`Failed to sync ${result.failed.length} submission(s)`, {
          description: 'Check the sync status for details.',
        });
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-updated', handleQueueUpdate);
      window.removeEventListener('storage', handleStorageChange);
      cleanup();
    };
  }, [updateCounts]);

  // Manual sync
  const manualSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Cannot sync while offline');
      return;
    }

    if (!hasPendingSubmissions()) {
      toast.info('No pending submissions to sync');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await processQueue();
      setLastSyncResult(result);
      updateCounts();

      if (result.successful.length > 0) {
        toast.success(`Synced ${result.successful.length} submission(s)`);
      }
      if (result.failed.length > 0) {
        toast.error(`Failed to sync ${result.failed.length} submission(s)`);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [updateCounts]);

  // Retry failed
  const retryFailed = useCallback(() => {
    retryFailedSubmissions();
    updateCounts();
    if (navigator.onLine) {
      manualSync();
    }
  }, [updateCounts, manualSync]);

  // Clear failed
  const clearFailed = useCallback(() => {
    clearFailedSubmissions();
    updateCounts();
  }, [updateCounts]);

  return {
    isOnline,
    pendingCount,
    failedCount,
    isSyncing,
    lastSyncResult,
    manualSync,
    retryFailed,
    clearFailed,
    hasPending: pendingCount > 0,
    hasFailed: failedCount > 0,
  };
}
