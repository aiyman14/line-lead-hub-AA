/**
 * Hook for handling form submissions with offline support
 * Wraps Supabase inserts and queues them if offline
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';
import { 
  queueSubmission, 
  FormType,
  type QueuedSubmission 
} from '@/lib/offline-queue';
import { toast } from 'sonner';

interface SubmissionOptions {
  /** Show toast on queue */
  showQueuedToast?: boolean;
  /** Show toast on success */
  showSuccessToast?: boolean;
  /** Custom success message */
  successMessage?: string;
  /** Custom queued message */
  queuedMessage?: string;
}

interface SubmissionResult {
  success: boolean;
  queued: boolean;
  queueId?: string;
  error?: string;
  data?: unknown;
}

export function useOfflineSubmission() {
  const { user, profile } = useAuth();
  const { isOnline } = useNetworkStatus();

  const submit = useCallback(async <T extends Record<string, unknown>>(
    formType: FormType,
    tableName: string,
    payload: T,
    options: SubmissionOptions = {}
  ): Promise<SubmissionResult> => {
    const {
      showQueuedToast = true,
      showSuccessToast = true,
      successMessage = 'Submission saved successfully',
      queuedMessage = 'Saved offline. Will sync when online.',
    } = options;

    // Validate user context
    if (!user?.id || !profile?.factory_id) {
      return {
        success: false,
        queued: false,
        error: 'User not authenticated or no factory assigned',
      };
    }

    // If offline, queue the submission
    if (!isOnline) {
      const queueId = queueSubmission(
        formType,
        tableName,
        payload as Record<string, unknown>,
        profile.factory_id,
        user.id
      );

      if (showQueuedToast) {
        toast.info('Saved for later', {
          description: queuedMessage,
        });
      }

      return {
        success: true,
        queued: true,
        queueId,
      };
    }

    // Online - try direct submission
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .from(tableName as any)
        .insert(payload as any)
        .select();

      if (error) {
        // If network error during submission, queue it
        if (error.message.includes('network') || error.message.includes('fetch')) {
          const queueId = queueSubmission(
            formType,
            tableName,
            payload as Record<string, unknown>,
            profile.factory_id,
            user.id
          );

          if (showQueuedToast) {
            toast.info('Saved for later', {
              description: 'Network error. Will sync when connection is restored.',
            });
          }

          return {
            success: true,
            queued: true,
            queueId,
          };
        }

        return {
          success: false,
          queued: false,
          error: error.message,
        };
      }

      if (showSuccessToast) {
        toast.success(successMessage);
      }

      return {
        success: true,
        queued: false,
        data,
      };
    } catch (err) {
      // Network failure - queue the submission
      const queueId = queueSubmission(
        formType,
        tableName,
        payload as Record<string, unknown>,
        profile.factory_id,
        user.id
      );

      if (showQueuedToast) {
        toast.info('Saved for later', {
          description: 'Connection lost. Will sync when online.',
        });
      }

      return {
        success: true,
        queued: true,
        queueId,
      };
    }
  }, [user, profile, isOnline]);

  return { submit, isOnline };
}
