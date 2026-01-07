import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  queueSubmission,
  processQueue,
  hasPendingSubmissions,
  getPendingCount,
  setupOnlineSync,
} from '@/lib/offline-queue';

/**
 * Hook for managing offline submissions and sync
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online', { description: 'Syncing pending submissions...' });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline', { description: 'Submissions will be queued and synced when online.' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Setup auto-sync on online
    const cleanup = setupOnlineSync((result) => {
      setPendingCount(getPendingCount());
      if (result.successful.length > 0) {
        toast.success(`Synced ${result.successful.length} submission(s)`);
      }
      if (result.failed.length > 0) {
        toast.error(`Failed to sync ${result.failed.length} submission(s)`);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanup();
    };
  }, []);

  const submitWithOfflineSupport = useCallback(
    async <T>(
      endpoint: string,
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      body: T,
      headers: Record<string, string> = {}
    ): Promise<{ queued: boolean; response?: Response; id?: string }> => {
      if (!navigator.onLine) {
        const id = queueSubmission(endpoint, method, body, headers);
        setPendingCount(getPendingCount());
        toast.info('Saved for later', { description: 'Your submission will be sent when online.' });
        return { queued: true, id };
      }

      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(body),
        });
        return { queued: false, response };
      } catch {
        // Network error - queue for later
        const id = queueSubmission(endpoint, method, body, headers);
        setPendingCount(getPendingCount());
        toast.info('Saved for later', { description: 'Network error. Your submission will be sent when online.' });
        return { queued: true, id };
      }
    },
    []
  );

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
      setPendingCount(getPendingCount());
      if (result.successful.length > 0) {
        toast.success(`Synced ${result.successful.length} submission(s)`);
      }
      if (result.failed.length > 0) {
        toast.error(`Failed to sync ${result.failed.length} submission(s)`);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    submitWithOfflineSupport,
    manualSync,
    hasPending: pendingCount > 0,
  };
}
