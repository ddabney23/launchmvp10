/**
 * Audit Logging Utilities
 * Handles logging of admin actions and system events
 * CLERK MIGRATION: Updated to work with Clerk authentication
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "./logger";

export type AuditAction =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "user_banned"
  | "user_unbanned"
  | "vendor_approved"
  | "vendor_rejected"
  | "vendor_verified"
  | "badge_created"
  | "badge_updated"
  | "badge_deleted"
  | "badge_awarded"
  | "news_created"
  | "news_updated"
  | "news_deleted"
  | "post_created"
  | "post_updated"
  | "post_deleted"
  | "listing_created"
  | "listing_updated"
  | "listing_deleted"
  | "order_updated"
  | "order_cancelled"
  | "settings_updated"
  | "system_config_changed"
  | "other";

export type AuditResourceType =
  | "user"
  | "vendor"
  | "badge"
  | "news"
  | "post"
  | "listing"
  | "order"
  | "settings"
  | "system"
  | "other";

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogCreate {
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface AuditLogFilters {
  user_id?: string;
  action?: AuditAction;
  resource_type?: AuditResourceType;
  resource_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Log an audit event
 * Only admins can create audit logs
 * CLERK MIGRATION: Admin check is now done via profile.is_admin in the database
 */
export async function logAuditEvent(
  userId: string | null,
  event: AuditLogCreate
): Promise<void> {
  // Audit logging should not break the app - wrap everything in try-catch
  try {
    // If userId is provided, verify it's a profile UUID (not Clerk ID)
    // Admin check should be done server-side via profile.is_admin
    // For client-side, we'll just log the event (server-side APIs should verify admin status)
    
    // Get IP address and user agent
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    
    try {
      ipAddress = await getClientIP();
      userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    } catch (ipError) {
      // Ignore IP fetch errors - not critical
      logger.warn("Failed to get client IP for audit log", ipError);
    }

    const profileId: string | null = userId || null

    // Attempt to insert audit log
    const { error } = await supabase.from("audit_logs").insert({
      user_id: profileId,
      action: event.action,
      resource_type: event.resource_type,
      resource_id: event.resource_id || null,
      details: event.details || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      // Log error but don't throw - audit logging should not break the app
      logger.warn("Failed to create audit log (non-critical)", error, { 
        userId, 
        profileId, 
        action: event.action,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      });
    }
  } catch (error) {
    // Catch any unexpected errors and log them, but don't throw
    logger.warn("Unexpected error in audit logging (non-critical)", error, { 
      userId, 
      action: event.action 
    });
  }
}

/**
 * Get audit logs with filtering
 * Only admins can view audit logs
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {}
): Promise<{ data: AuditLog[]; count: number }> {
  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  // Apply filters
  if (filters.user_id) {
    query = query.eq("user_id", filters.user_id);
  }
  if (filters.action) {
    query = query.eq("action", filters.action);
  }
  if (filters.resource_type) {
    query = query.eq("resource_type", filters.resource_type);
  }
  if (filters.resource_id) {
    query = query.eq("resource_id", filters.resource_id);
  }
  if (filters.start_date) {
    query = query.gte("created_at", filters.start_date);
  }
  if (filters.end_date) {
    query = query.lte("created_at", filters.end_date);
  }

  // Apply pagination
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get audit logs: ${error.message}`);
  }

  return {
    data: (data || []) as AuditLog[],
    count: count || 0,
  };
}

/**
 * Export audit logs to CSV
 */
export async function exportAuditLogsToCSV(
  filters: AuditLogFilters = {}
): Promise<string> {
  // Get all logs (no pagination for export)
  const result = await getAuditLogs({
    ...filters,
    limit: 10000, // Large limit for export
    offset: 0,
  });

  // CSV headers
  const headers = [
    "ID",
    "User ID",
    "Action",
    "Resource Type",
    "Resource ID",
    "Details",
    "IP Address",
    "User Agent",
    "Created At",
  ];

  // CSV rows
  const rows = result.data.map((log) => [
    log.id,
    log.user_id || "",
    log.action,
    log.resource_type,
    log.resource_id || "",
    JSON.stringify(log.details || {}),
    log.ip_address || "",
    log.user_agent || "",
    log.created_at,
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return csvContent;
}

/**
 * Get client IP address
 * Note: This is a simplified version - in production, get IP from server-side
 */
async function getClientIP(): Promise<string | null> {
  try {
    // Try to get IP from a service (for demo purposes)
    // In production, this should be done server-side
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip || null;
  } catch {
    return null;
  }
}


