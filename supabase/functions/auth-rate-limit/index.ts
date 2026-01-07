// Rate limiting middleware for authentication endpoints
// This function is called before auth operations to check/enforce limits

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  corsHeaders,
  getSecureHeaders,
  createAdminClient,
  getClientIP,
  getUserAgent,
  checkRateLimit,
  logSecurityEvent,
  emailSchema,
  errorResponse,
  successResponse,
  rateLimitResponse,
} from "../_shared/security.ts";

const requestSchema = z.object({
  action: z.enum(["login", "reset_password", "invite", "signup"]),
  email: emailSchema.optional(),
  factoryId: z.string().uuid().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createAdminClient();
    const ip = getClientIP(req);
    const userAgent = getUserAgent(req);

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid request parameters", 400);
    }

    const { action, email, factoryId } = parsed.data;

    // Create composite identifier for rate limiting
    // Use both IP and email (if provided) to prevent abuse
    const identifiers = [ip];
    if (email) identifiers.push(email);

    // Check rate limits for each identifier
    for (const identifier of identifiers) {
      const result = await checkRateLimit(
        adminClient,
        identifier,
        action,
        action === "login" ? 5 : 3, // Fewer attempts for sensitive actions
        action === "login" ? 15 : 30, // Longer window for sensitive actions
        action === "login" ? 15 : 60 // Longer block for sensitive actions
      );

      if (!result.allowed) {
        // Log the rate limit hit
        await logSecurityEvent(
          adminClient,
          `rate_limit_${action}`,
          null,
          factoryId || null,
          ip,
          userAgent,
          { email, reason: result.reason, attempts: result.attempts }
        );

        return rateLimitResponse(result.blockedUntil);
      }
    }

    return successResponse({ allowed: true });
  } catch (error) {
    console.error("Rate limit check error:", error);
    // Fail open but log
    return successResponse({ allowed: true, warning: "Rate limit check failed" });
  }
});
