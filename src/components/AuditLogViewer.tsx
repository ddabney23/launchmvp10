'use client'

/**
 * Audit Log Viewer Component
 * Displays audit logs with filtering and export capabilities
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Download,
  Filter,
  Search,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getAuditLogs,
  exportAuditLogsToCSV,
  type AuditLog,
  type AuditAction,
  type AuditResourceType,
} from "@/lib/auditLog";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const ACTIONS: AuditAction[] = [
  "user_created",
  "user_updated",
  "user_deleted",
  "user_banned",
  "user_unbanned",
  "vendor_approved",
  "vendor_rejected",
  "vendor_verified",
  "badge_created",
  "badge_updated",
  "badge_deleted",
  "badge_awarded",
  "news_created",
  "news_updated",
  "news_deleted",
  "post_created",
  "post_updated",
  "post_deleted",
  "listing_created",
  "listing_updated",
  "listing_deleted",
  "order_updated",
  "order_cancelled",
  "settings_updated",
  "system_config_changed",
  "other",
];

const RESOURCE_TYPES: AuditResourceType[] = [
  "user",
  "vendor",
  "badge",
  "news",
  "post",
  "listing",
  "order",
  "settings",
  "system",
  "other",
];

export function AuditLogViewer() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters
  const [filters, setFilters] = useState<{
    action?: AuditAction;
    resource_type?: AuditResourceType;
    resource_id?: string;
    start_date?: string;
    end_date?: string;
    user_id?: string;
  }>({});

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs({
        ...filters,
        limit: pageSize,
        offset: page * pageSize,
      });
      setLogs(result.data);
      setTotalCount(result.count);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await exportAuditLogsToCSV(filters);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Audit logs exported successfully",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to export audit logs",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const formatAction = (action: string) => {
    return action
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getActionColor = (action: AuditAction) => {
    if (action.includes("deleted") || action.includes("banned")) {
      return "destructive";
    }
    if (action.includes("created") || action.includes("approved")) {
      return "default";
    }
    return "secondary";
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                View and export system audit logs
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={loadLogs}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={filters.action || "all"}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    action: value === "all" ? undefined : (value as AuditAction),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Resource Type</Label>
              <Select
                value={filters.resource_type || "all"}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    resource_type: value === "all" ? undefined : (value as AuditResourceType),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {RESOURCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Resource ID</Label>
              <Input
                placeholder="UUID"
                value={filters.resource_id || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    resource_id: e.target.value || undefined,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.start_date || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    start_date: e.target.value || undefined,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.end_date || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    end_date: e.target.value || undefined,
                  })
                }
              />
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <Alert>
              <AlertDescription>No audit logs found matching your filters.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.created_at), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.user_id ? log.user_id.slice(0, 8) + "..." : "System"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionColor(log.action)}>
                            {formatAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{log.resource_type}</div>
                            {log.resource_id && (
                              <div className="font-mono text-xs text-muted-foreground">
                                {log.resource_id.slice(0, 8)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.details ? (
                            <Button variant="ghost" size="sm">
                              View Details
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalCount)} of{" "}
                  {totalCount} logs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">ID</Label>
                  <p className="font-mono text-sm">{selectedLog.id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Timestamp</Label>
                  <p className="text-sm">
                    {format(new Date(selectedLog.created_at), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">User ID</Label>
                  <p className="font-mono text-sm">{selectedLog.user_id || "System"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Action</Label>
                  <Badge variant={getActionColor(selectedLog.action)}>
                    {formatAction(selectedLog.action)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Resource Type</Label>
                  <p className="text-sm capitalize">{selectedLog.resource_type}</p>
                </div>
                {selectedLog.resource_id && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Resource ID</Label>
                    <p className="font-mono text-sm">{selectedLog.resource_id}</p>
                  </div>
                )}
                {selectedLog.details && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Details</Label>
                    <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.ip_address && (
                  <div>
                    <Label className="text-xs text-muted-foreground">IP Address</Label>
                    <p className="font-mono text-sm">{selectedLog.ip_address}</p>
                  </div>
                )}
                {selectedLog.user_agent && (
                  <div>
                    <Label className="text-xs text-muted-foreground">User Agent</Label>
                    <p className="text-xs break-all">{selectedLog.user_agent}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

