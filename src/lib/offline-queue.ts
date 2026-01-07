/**
 * Offline Queue Manager
 * Queues form submissions when offline and syncs when online
 * Supports all form types: sewing, cutting, finishing, storage
 */

import { supabase } from '@/integrations/supabase/client';

const QUEUE_KEY = 'pp_offline_submission_queue';
const SYNC_TAG = 'sync-submissions';

export type FormType = 
  | 'sewing_targets' 
  | 'sewing_actuals' 
  | 'finishing_targets' 
  | 'finishing_actuals'
  | 'finishing_daily_sheets'
  | 'finishing_hourly_logs'
  | 'cutting_targets' 
  | 'cutting_actuals'
  | 'storage_bin_cards'
  | 'production_updates_sewing'
  | 'production_updates_finishing';

export interface QueuedSubmission {
  id: string;
  formType: FormType;
  tableName: string;
  payload: Record<string, unknown>;
  factoryId: string;
  userId: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

export interface SyncResult {
  successful: string[];
  failed: { id: string; error: string }[];
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
 * Save queue to localStorage
 */
function saveQueue(queue: QueuedSubmission[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Add a submission to the offline queue
 */
export function queueSubmission(
  formType: FormType,
  tableName: string,
  payload: Record<string, unknown>,
  factoryId: string,
  userId: string
): string {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const submission: QueuedSubmission = {
    id,
    formType,
    tableName,
    payload,
    factoryId,
    userId,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: 5,
    status: 'pending',
  };

  const queue = getQueuedSubmissions();
  queue.push(submission);
  saveQueue(queue);

  // Request background sync if available (PWA)
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
        .sync.register(SYNC_TAG);
    }).catch(console.warn);
  }

  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('offline-queue-updated', { detail: { count: queue.length } }));

  return id;
}

/**
 * Remove a submission from the queue
 */
export function removeFromQueue(id: string): void {
  const queue = getQueuedSubmissions().filter((s) => s.id !== id);
  saveQueue(queue);
  window.dispatchEvent(new CustomEvent('offline-queue-updated', { detail: { count: queue.length } }));
}

/**
 * Update submission status
 */
export function updateSubmissionStatus(id: string, status: QueuedSubmission['status'], errorMessage?: string): void {
  const queue = getQueuedSubmissions();
  const index = queue.findIndex((s) => s.id === id);
  if (index !== -1) {
    queue[index].status = status;
    if (errorMessage) {
      queue[index].errorMessage = errorMessage;
    }
    saveQueue(queue);
  }
}

/**
 * Update retry count for a submission
 */
export function incrementRetry(id: string): void {
  const queue = getQueuedSubmissions();
  const index = queue.findIndex((s) => s.id === id);
  if (index !== -1) {
    queue[index].retryCount++;
    saveQueue(queue);
  }
}

/**
 * Process a single submission via Supabase
 */
async function processSubmission(submission: QueuedSubmission): Promise<{ success: boolean; error?: string }> {
  try {
    updateSubmissionStatus(submission.id, 'syncing');

    // Insert into the appropriate table using type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from(submission.tableName as any)
      .insert(submission.payload as any);

    if (error) {
      // Check if it's a duplicate error (already synced)
      if (error.code === '23505') {
        return { success: true }; // Treat as success - already exists
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Process the entire offline queue
 */
export async function processQueue(): Promise<SyncResult> {
  const queue = getQueuedSubmissions();
  const result: SyncResult = { successful: [], failed: [] };

  // Check if we're online
  if (!navigator.onLine) {
    return result;
  }

  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return result;
  }

  for (const submission of queue) {
    const { success, error } = await processSubmission(submission);

    if (success) {
      removeFromQueue(submission.id);
      result.successful.push(submission.id);
    } else if (submission.retryCount >= submission.maxRetries) {
      updateSubmissionStatus(submission.id, 'failed', error);
      result.failed.push({ id: submission.id, error: error || 'Max retries exceeded' });
    } else {
      incrementRetry(submission.id);
      updateSubmissionStatus(submission.id, 'pending', error);
    }
  }

  return result;
}

/**
 * Check if there are pending submissions
 */
export function hasPendingSubmissions(): boolean {
  return getQueuedSubmissions().filter(s => s.status === 'pending' || s.status === 'syncing').length > 0;
}

/**
 * Get count of pending submissions
 */
export function getPendingCount(): number {
  return getQueuedSubmissions().filter(s => s.status === 'pending' || s.status === 'syncing').length;
}

/**
 * Get count of failed submissions
 */
export function getFailedCount(): number {
  return getQueuedSubmissions().filter(s => s.status === 'failed').length;
}

/**
 * Clear all queued submissions
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
  window.dispatchEvent(new CustomEvent('offline-queue-updated', { detail: { count: 0 } }));
}

/**
 * Clear only failed submissions
 */
export function clearFailedSubmissions(): void {
  const queue = getQueuedSubmissions().filter(s => s.status !== 'failed');
  saveQueue(queue);
  window.dispatchEvent(new CustomEvent('offline-queue-updated', { detail: { count: queue.length } }));
}

/**
 * Retry failed submissions
 */
export function retryFailedSubmissions(): void {
  const queue = getQueuedSubmissions();
  queue.forEach(s => {
    if (s.status === 'failed') {
      s.status = 'pending';
      s.retryCount = 0;
      s.errorMessage = undefined;
    }
  });
  saveQueue(queue);
}

/**
 * Setup automatic online sync
 */
export function setupOnlineSync(onSync: (result: SyncResult) => void): () => void {
  const handleOnline = async () => {
    if (hasPendingSubmissions()) {
      const result = await processQueue();
      onSync(result);
    }
  };

  // Listen for online event
  window.addEventListener('online', handleOnline);

  // Also check on load if online
  if (navigator.onLine && hasPendingSubmissions()) {
    handleOnline();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

/**
 * Get submissions by form type
 */
export function getSubmissionsByType(formType: FormType): QueuedSubmission[] {
  return getQueuedSubmissions().filter(s => s.formType === formType);
}
