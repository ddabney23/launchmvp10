'use client'

/**
 * React Hook for Audit Logging
 * Provides easy access to audit logging functionality
 */

import { useCallback } from "react";
import { logAuditEvent, type AuditAction, type AuditResourceType } from "@/lib/auditLog";
import { useAuth } from "./useAuth";

export function useAuditLog() {
  const { user, profile } = useAuth();
  
  const logEvent = useCallback(
    async (
      action: AuditAction,
      resourceType: AuditResourceType,
      options?: {
        resourceId?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details?: Record<string, any>;
      }
    ) => {
      try {
        // Use profile UUID if available (preferred), otherwise use user.id (which might be Clerk ID)
        // logAuditEvent will handle Clerk ID to UUID conversion if needed
        const userId = profile?.id || user?.id || null;
        await logAuditEvent(userId, {
          action,
          resource_type: resourceType,
          resource_id: options?.resourceId || null,
          details: options?.details || null,
        });
      } catch (error) {
        // Silently fail - audit logging should not break the app
        console.error("Failed to log audit event:", error);
      }
    },
    [user?.id, profile?.id]
  );

  return { logEvent };
}

