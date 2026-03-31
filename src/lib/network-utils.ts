import { supabase } from '@/integrations/supabase/client';

/**
 * Detect whether an error is caused by a network issue (transient, retriable).
 */
export function isNetworkError(error: unknown): boolean {
  const message = String((error as any)?.message || error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('load failed') ||
    message.includes('timeout') ||
    message.includes('err_internet') ||
    message.includes('econnrefused')
  );
}

/**
 * Return a user-friendly error message, distinguishing network errors from others.
 */
export function networkErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Connection failed. Please check your network and try again.';
  }
  return (error as any)?.message || 'An unexpected error occurred. Please try again.';
}

interface InvokeOptions {
  headers?: Record<string, string>;
  maxRetries?: number;
}

/**
 * Invoke a Supabase edge function with automatic retry on network errors.
 * Non-network errors are returned immediately without retry.
 */
export async function invokeEdgeFn<T = any>(
  fnName: string,
  body?: Record<string, unknown>,
  options?: InvokeOptions,
): Promise<{ data: T | null; error: any }> {
  const maxRetries = options?.maxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const invokeOptions: any = {};
    if (body) invokeOptions.body = body;
    if (options?.headers) invokeOptions.headers = options.headers;

    const { data, error } = await supabase.functions.invoke(fnName, invokeOptions);

    if (!error) return { data, error: null };
    if (!isNetworkError(error) || attempt === maxRetries) return { data, error };

    console.warn(`[network-retry] ${fnName} attempt ${attempt + 1} failed, retrying...`);
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  return { data: null, error: new Error('Max retries exceeded') };
}

/**
 * Wrap a Supabase query builder call with automatic retry on network errors.
 * Non-network errors (validation, RLS, duplicates, etc.) are returned immediately.
 */
export async function mutateWithRetry<T>(
  fn: () => PromiseLike<{ data: T; error: any }>,
  maxRetries = 2,
): Promise<{ data: T; error: any }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fn();

    if (!result.error) return result;
    if (!isNetworkError(result.error) || attempt === maxRetries) return result;

    console.warn(`[network-retry] mutation attempt ${attempt + 1} failed, retrying...`);
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  // Unreachable safety net — TypeScript requires a return
  return await fn();
}
