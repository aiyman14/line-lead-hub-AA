// Shared security utilities for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Security headers to add to all responses
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "frame-ancestors 'none'",
};

// Combine all headers for responses
export function getSecureHeaders(contentType = "application/json") {
  return {
    ...corsHeaders,
    ...securityHeaders,
    "Content-Type": contentType,
  };
}

// Create admin client
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

// Get client IP from request headers
export function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// Get user agent
export function getUserAgent(req: Request): string {
  return req.headers.get("user-agent") || "unknown";
}

// Check rate limit using database function
export async function checkRateLimit(
  adminClient: ReturnType<typeof createAdminClient>,
  identifier: string,
  actionType: string,
  maxAttempts = 5,
  windowMinutes = 15,
  blockMinutes = 30
): Promise<{ allowed: boolean; reason?: string; attempts?: number; blockedUntil?: string }> {
  const { data, error } = await adminClient.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_action_type: actionType,
    p_max_attempts: maxAttempts,
    p_window_minutes: windowMinutes,
    p_block_minutes: blockMinutes,
  });

  if (error) {
    console.error("Rate limit check error:", error);
    // Fail open but log the issue
    return { allowed: true };
  }

  return {
    allowed: data.allowed,
    reason: data.reason,
    attempts: data.attempts,
    blockedUntil: data.blocked_until,
  };
}

// Log security event
export async function logSecurityEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  eventType: string,
  userId: string | null,
  factoryId: string | null,
  ipAddress: string,
  userAgent: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await adminClient.rpc("log_security_event", {
      p_event_type: eventType,
      p_user_id: userId,
      p_factory_id: factoryId,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_details: details,
    });
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
}

// Validation schemas
export const emailSchema = z.string().email().max(255).trim().toLowerCase();
export const passwordSchema = z.string().min(8).max(128);
export const uuidSchema = z.string().uuid();

// Error response helper
export function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: getSecureHeaders() }
  );
}

// Success response helper
export function successResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: getSecureHeaders() }
  );
}

// Rate limit error response
export function rateLimitResponse(blockedUntil?: string) {
  return new Response(
    JSON.stringify({
      error: "Too many attempts. Please try again later.",
      blocked_until: blockedUntil,
    }),
    { status: 429, headers: getSecureHeaders() }
  );
}
