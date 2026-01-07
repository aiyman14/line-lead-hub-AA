/**
 * Offline Queue Manager
 * Queues form submissions when offline and syncs when online
 */

const QUEUE_KEY = 'offline_submission_queue';
const SYNC_TAG = 'sync-submissions';

export interface QueuedSubmission {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: unknown;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

/**
 * Get all queued submissions
 */
export function getQueuedSubmissions(): QueuedSubmission[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Add a submission to the offline queue
 */
export function queueSubmission(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: unknown,
  headers: Record<string, string> = {}
): string {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const submission: QueuedSubmission = {
    id,
    endpoint,
    method,
    body,
    headers,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: 3,
  };

  const queue = getQueuedSubmissions();
  queue.push(submission);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

  // Request background sync if available
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
        .sync.register(SYNC_TAG);
    });
  }

  return id;
}

/**
 * Remove a submission from the queue
 */
export function removeFromQueue(id: string): void {
  const queue = getQueuedSubmissions().filter((s) => s.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Update retry count for a submission
 */
export function incrementRetry(id: string): void {
  const queue = getQueuedSubmissions();
  const index = queue.findIndex((s) => s.id === id);
  if (index !== -1) {
    queue[index].retryCount++;
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

/**
 * Process the offline queue
 */
export async function processQueue(): Promise<{
  successful: string[];
  failed: string[];
}> {
  const queue = getQueuedSubmissions();
  const successful: string[] = [];
  const failed: string[] = [];

  for (const submission of queue) {
    try {
      const response = await fetch(submission.endpoint, {
        method: submission.method,
        headers: {
          'Content-Type': 'application/json',
          ...submission.headers,
        },
        body: JSON.stringify(submission.body),
      });

      if (response.ok) {
        removeFromQueue(submission.id);
        successful.push(submission.id);
      } else if (submission.retryCount >= submission.maxRetries) {
        removeFromQueue(submission.id);
        failed.push(submission.id);
      } else {
        incrementRetry(submission.id);
      }
    } catch {
      if (submission.retryCount >= submission.maxRetries) {
        removeFromQueue(submission.id);
        failed.push(submission.id);
      } else {
        incrementRetry(submission.id);
      }
    }
  }

  return { successful, failed };
}

/**
 * Check if there are pending submissions
 */
export function hasPendingSubmissions(): boolean {
  return getQueuedSubmissions().length > 0;
}

/**
 * Get count of pending submissions
 */
export function getPendingCount(): number {
  return getQueuedSubmissions().length;
}

/**
 * Clear all queued submissions
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Hook to listen for online status and sync
 */
export function setupOnlineSync(onSync: (result: { successful: string[]; failed: string[] }) => void): () => void {
  const handleOnline = async () => {
    if (hasPendingSubmissions()) {
      const result = await processQueue();
      onSync(result);
    }
  };

  window.addEventListener('online', handleOnline);
  
  // Also check on load if online
  if (navigator.onLine && hasPendingSubmissions()) {
    handleOnline();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
