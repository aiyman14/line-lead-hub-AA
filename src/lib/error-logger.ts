import { supabase } from '@/integrations/supabase/client';

type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorLogPayload {
  message: string;
  stack?: string;
  source?: string;
  severity?: ErrorSeverity;
  metadata?: Record<string, unknown>;
}

// Rate limiter state
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
let errorTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  errorTimestamps = errorTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (errorTimestamps.length >= RATE_LIMIT_MAX) {
    return true;
  }
  errorTimestamps.push(now);
  return false;
}

// User context cache (set externally by AuthProvider)
let _userId: string | null = null;
let _factoryId: string | null = null;

export function setErrorLoggerUserContext(userId: string | null, factoryId: string | null) {
  _userId = userId;
  _factoryId = factoryId;
}

export async function logError(payload: ErrorLogPayload): Promise<void> {
  const { message, stack, source, severity = 'error', metadata } = payload;

  const consoleMethod = severity === 'warning' ? console.warn : severity === 'info' ? console.info : console.error;
  consoleMethod(`[${severity.toUpperCase()}] ${source ?? 'unknown'}:`, message, stack ?? '');

  if (isRateLimited()) {
    console.warn('[errorLogger] Rate limited — skipping Supabase insert');
    return;
  }

  try {
    const { error } = await (supabase as any)
      .from('app_error_logs')
      .insert({
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 5000) ?? null,
        source: source ?? null,
        severity,
        user_id: _userId,
        factory_id: _factoryId,
        url: typeof window !== 'undefined' ? window.location.href : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        metadata: metadata ?? {},
      });

    if (error) {
      console.error('[errorLogger] Supabase insert failed:', error.message);
    }
  } catch (err) {
    console.error('[errorLogger] Failed to log error to Supabase:', err);
  }
}

export function logWarning(message: string, source?: string, metadata?: Record<string, unknown>) {
  return logError({ message, source, severity: 'warning', metadata });
}

export function logInfo(message: string, source?: string, metadata?: Record<string, unknown>) {
  return logError({ message, source, severity: 'info', metadata });
}
