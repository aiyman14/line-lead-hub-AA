// Client-side security utilities

import { supabase } from "@/integrations/supabase/client";

interface RateLimitOptions {
  email?: string;
  factoryId?: string;
  isCritical?: boolean;
}

const CRITICAL_ACTIONS = ["login", "reset_password", "signup", "invite"] as const;
type RateLimitAction = typeof CRITICAL_ACTIONS[number];

export async function checkRateLimit(
  action: RateLimitAction,
  options: RateLimitOptions = {}
): Promise<{ allowed: boolean; error?: string }> {
  const { email, factoryId, isCritical } = options;
  const shouldFailClosed = isCritical ?? CRITICAL_ACTIONS.includes(action);

  try {
    const response = await supabase.functions.invoke("auth-rate-limit", {
      body: { action, email, factoryId },
    });

    if (response.error) {
      console.error("Rate limit check failed:", response.error);
      if (shouldFailClosed) {
        return { allowed: false, error: "Service temporarily unavailable. Please try again." };
      }
      return { allowed: true };
    }

    if (!response.data?.allowed) {
      return {
        allowed: false,
        error: response.data?.error || "Too many attempts. Please try again later.",
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Rate limit check error:", error);
    if (shouldFailClosed) {
      return { allowed: false, error: "Service temporarily unavailable. Please try again." };
    }
    return { allowed: true };
  }
}

// Sanitize user input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// Validate file upload
export function validateFileUpload(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const { maxSizeMB = 5, allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] } = options;

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type must be one of: ${allowedTypes.join(", ")}` };
  }

  // Check file extension matches type
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expectedExtensions: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/gif": ["gif"],
    "image/webp": ["webp"],
  };

  const validExtensions = expectedExtensions[file.type] || [];
  if (!extension || !validExtensions.includes(extension)) {
    return { valid: false, error: "File extension does not match file type" };
  }

  return { valid: true };
}

// Generate secure file path with factory isolation
export function getSecureFilePath(factoryId: string, userId: string, filename: string): string {
  // Sanitize filename
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  return `${factoryId}/${userId}/${timestamp}_${randomSuffix}_${sanitizedFilename}`;
}
