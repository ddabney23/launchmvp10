'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { useRealtimeSubscription } from '@/lib/realtime'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Activity, Database, Webhook, Server } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ProtectedRoute } from '@/components/ProtectedRoute'

interface EventLog {
  id: string
  timestamp: Date
  type: 'post' | 'comment' | 'message' | 'booking' | 'listing'
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  data: any
}

interface WebhookLog {
  id: string
  timestamp: Date
  source: 'stripe'
  event: string
  status: 'success' | 'failed' | 'pending'
  payload?: any
  error?: string
}

interface SystemHealth {
  supabase: 'healthy' | 'unhealthy' | 'unknown'
  prisma: 'healthy' | 'unhealthy' | 'unknown'
  environment: 'healthy' | 'unhealthy' | 'unknown'
  stripe: 'healthy' | 'unhealthy' | 'unknown'
  version: string
  uptime: number
}

function RealtimeDiagnosticsContent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [eventLogs, setEventLogs] = useState<EventLog[]>([])
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([])
  const [isRecording, setIsRecording] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Fetch system health
  const { data: health, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await fetch('/api/health')
      if (!response.ok) throw new Error('Failed to fetch health')
      return response.json()
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  // Check Prisma connection
  const { data: prismaStatus } = useQuery({
    queryKey: ['prisma-status'],
    queryFn: async () => {
      try {
        // Try to query a simple table via Prisma
        const response = await fetch('/api/health')
        const data = await response.json()
        return data.checks?.prisma || 'unknown'
      } catch {
        return 'unhealthy'
      }
    },
    refetchInterval: 15000,
  })

  // Add event log helper
  const addEventLog = (log: EventLog) => {
    if (!isRecording) return
    
    setEventLogs((prev) => {
      const newLogs = [log, ...prev].slice(0, 100) // Keep last 100 logs
      return newLogs
    })
    
    // Auto-scroll to bottom
    setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // Subscribe to posts
  useRealtimeSubscription(supabase, {
    table: 'posts',
    event: '*',
    callback: (payload) => {
      addEventLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type: 'post',
        event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        table: 'posts',
        data: payload.new || payload.old,
      })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    enabled: isRecording && !!user,
  })

  // Subscribe to comments
  useRealtimeSubscription(supabase, {
    table: 'comments',
    event: '*',
    callback: (payload) => {
      addEventLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type: 'comment',
        event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        table: 'comments',
        data: payload.new || payload.old,
      })
      queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
    enabled: isRecording && !!user,
  })

  // Subscribe to messages
  useRealtimeSubscription(supabase, {
    table: 'messages',
    event: '*',
    callback: (payload) => {
      addEventLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type: 'message',
        event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        table: 'messages',
        data: payload.new || payload.old,
      })
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    },
    enabled: isRecording && !!user,
  })

  // Subscribe to bookings
  useRealtimeSubscription(supabase, {
    table: 'bookings',
    event: '*',
    callback: (payload) => {
      addEventLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type: 'booking',
        event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        table: 'bookings',
        data: payload.new || payload.old,
      })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
    enabled: isRecording && !!user,
  })

  // Subscribe to listings
  useRealtimeSubscription(supabase, {
    table: 'listings',
    event: '*',
    callback: (payload) => {
      addEventLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type: 'listing',
        event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        table: 'listings',
        data: payload.new || payload.old,
      })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
    enabled: isRecording && !!user,
  })

  // Fetch webhook logs from database (optional feature - disabled by default)
  // To enable this feature:
  // 1. Create a migration file: supabase/migrations/XXX_create_webhook_logs.sql
  // 2. Define the webhook_logs table schema
  // 3. Uncomment the query below
  // Note: This is an optional feature for debugging webhook issues
  const webhookLogsData: WebhookLog[] | undefined = undefined
  // const { data: webhookLogsData } = useQuery({
  //   queryKey: ['webhook-logs'],
  //   queryFn: async () => {
  //     const { data, error } = await supabase
  //       .from('webhook_logs')
  //       .select('*')
  //       .order('created_at', { ascending: false })
  //       .limit(50)
  //
  //     if (error) {
  //       logger.error('Failed to fetch webhook logs', error)
  //       return []
  //     }
  //
  //     return (data || []).map((log) => ({
  //       id: log.id,
  //       timestamp: new Date(log.created_at),
  //       source: log.source as 'stripe',
  //       event: log.event_type,
  //       status: log.status as 'success' | 'failed' | 'pending',
  //       payload: log.payload,
  //       error: log.error || undefined,
  //     })) as WebhookLog[]
  //   },
  //   enabled: isRecording && !!user,
  //   refetchInterval: 5000, // Refresh every 5 seconds
  // })

  useEffect(() => {
    if (webhookLogsData) {
      setWebhookLogs(webhookLogsData)
    }
  }, [webhookLogsData])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500">Healthy</Badge>
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getEventColor = (event: string) => {
    switch (event) {
      case 'INSERT':
        return 'text-green-600 bg-green-50'
      case 'UPDATE':
        return 'text-blue-600 bg-blue-50'
      case 'DELETE':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (healthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Realtime Diagnostics</h1>
            <p className="text-muted-foreground mt-1">
              Monitor live events, webhooks, and system health
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant={isRecording ? 'destructive' : 'default'}
              onClick={() => setIsRecording(!isRecording)}
            >
              {isRecording ? (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEventLogs([])
                // Note: Webhook logs are stored in database, not cleared here
                toast({
                  title: 'Event Logs Cleared',
                  description: 'Local event logs have been cleared. Webhook logs are stored in the database.',
                })
              }}
            >
              Clear Event Logs
            </Button>
          </div>
        </div>

        {/* System Health */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Supabase</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getStatusIcon(health?.supabase || 'unknown')}
                {getStatusBadge(health?.supabase || 'unknown')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prisma DB</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getStatusIcon(prismaStatus || 'unknown')}
                {getStatusBadge(prismaStatus || 'unknown')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stripe</CardTitle>
              <Webhook className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getStatusIcon(health?.stripe || 'unknown')}
                {getStatusBadge(health?.stripe || 'unknown')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Environment</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getStatusIcon(health?.environment || 'unknown')}
                {getStatusBadge(health?.environment || 'unknown')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Version & Uptime Info */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Version and uptime details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="text-lg font-semibold">{health?.version || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className="text-lg font-semibold">
                  {health?.uptime ? `${Math.floor(health.uptime / 60)}m` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Event Logs</p>
                <p className="text-lg font-semibold">{eventLogs.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Webhook Logs</p>
                <p className="text-lg font-semibold">{webhookLogs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Event Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Live Event Logs</CardTitle>
              <CardDescription>
                Real-time Supabase events (Posts, Comments, Messages, Bookings, Listings)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full">
                <div className="space-y-2">
                  {eventLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No events recorded yet</p>
                      <p className="text-sm">Events will appear here in real-time</p>
                    </div>
                  ) : (
                    eventLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getEventColor(log.event)}>
                              {log.event}
                            </Badge>
                            <Badge variant="outline">{log.type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {log.table}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                          <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Webhook Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Delivery Logs</CardTitle>
              <CardDescription>Stripe webhook events and delivery status</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full">
                <div className="space-y-2">
                  {webhookLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No webhook events recorded yet</p>
                      <p className="text-sm">Webhook events will appear here</p>
                    </div>
                  ) : (
                    webhookLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.source}</Badge>
                            <Badge
                              variant={
                                log.status === 'success'
                                  ? 'default'
                                  : log.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {log.status}
                            </Badge>
                            <span className="text-xs font-medium">{log.event}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        {log.error && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-2">
                            Error: {log.error}
                          </div>
                        )}
                        {log.payload && (
                          <div className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                            <pre className="whitespace-pre-wrap break-words">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Environment Variables Check */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>Required environment variables status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'NEXT_PUBLIC_SUPABASE_URL',
                'NEXT_PUBLIC_SUPABASE_ANON_KEY',
                'SUPABASE_SERVICE_ROLE_KEY',
                'STRIPE_SECRET_KEY',
                'STRIPE_WEBHOOK_SECRET',
              ].map((varName) => {
                const isSet = typeof window !== 'undefined' 
                  ? false // Client-side can't check server env vars
                  : !!process.env[varName]
                
                return (
                  <div
                    key={varName}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <span className="text-sm font-mono">{varName}</span>
                    {isSet ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Note: Environment variables are only visible server-side. Check your deployment
              environment (Vercel) for actual values.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RealtimeDiagnosticsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <RealtimeDiagnosticsContent />
    </ProtectedRoute>
  )
}

