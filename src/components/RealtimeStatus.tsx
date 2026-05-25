'use client'

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi, WifiOff, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * RealtimeStatus Component
 * 
 * Displays the current status of Supabase Realtime connections.
 * Useful for debugging and monitoring realtime functionality.
 * 
 * Usage:
 * ```tsx
 * import { RealtimeStatus } from '@/components/RealtimeStatus';
 * 
 * <RealtimeStatus />
 * ```
 */
export function RealtimeStatus() {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [channels, setChannels] = useState<Array<{ topic: string; state: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check initial connection status
    const checkConnection = () => {
      try {
        const realtime = supabase.realtime;
        const currentChannels = realtime.getChannels();
        
        setChannels(
          currentChannels.map((ch) => ({
            topic: ch.topic,
            state: ch.state || 'unknown',
          }))
        );

        // Determine overall connection status
        if (currentChannels.length > 0) {
          const hasSubscribed = currentChannels.some((ch) => ch.state === 'joined');
          setConnectionStatus(hasSubscribed ? 'connected' : 'disconnected');
        } else {
          setConnectionStatus('disconnected');
        }
      } catch (err) {
        setConnectionStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // Set up connection listeners
    const handleOpen = () => {
      setConnectionStatus('connected');
      setError(null);
      checkConnection();
    };

    const handleClose = () => {
      setConnectionStatus('disconnected');
      checkConnection();
    };

    const handleError = (err: Error) => {
      setConnectionStatus('error');
      setError(err.message);
      checkConnection();
    };

    // Attach listeners
    supabase.realtime.onOpen(handleOpen);
    supabase.realtime.onClose(handleClose);
    supabase.realtime.onError(handleError);

    // Initial check
    checkConnection();

    // Periodic check (every 5 seconds)
    const interval = setInterval(checkConnection, 5000);

    return () => {
      clearInterval(interval);
      // Note: We don't remove listeners as they're global
    };
  }, []);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'disconnected':
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Realtime Status</CardTitle>
          <Badge className={getStatusColor()}>
            {getStatusIcon()}
            <span className="ml-2 capitalize">{connectionStatus}</span>
          </Badge>
        </div>
        <CardDescription>
          Monitor Supabase Realtime connection and active channels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Connection</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {connectionStatus === 'connected' && 'WebSocket connected and active'}
            {connectionStatus === 'disconnected' && 'WebSocket disconnected or no active subscriptions'}
            {connectionStatus === 'error' && `Error: ${error || 'Unknown error'}`}
          </div>
        </div>

        {/* Active Channels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Active Channels</span>
            <Badge variant="outline">{channels.length}</Badge>
          </div>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active channels</p>
          ) : (
            <div className="space-y-2">
              {channels.map((channel, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                >
                  <code className="text-xs font-mono">{channel.topic}</code>
                  <Badge
                    variant={
                      channel.state === 'joined'
                        ? 'default'
                        : channel.state === 'errored'
                        ? 'destructive'
                        : 'outline'
                    }
                    className="text-xs"
                  >
                    {channel.state}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        {connectionStatus === 'disconnected' && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <p className="text-xs text-yellow-700">
              <strong>Tip:</strong> Realtime will connect automatically when you subscribe to a channel.
              Check your components for realtime subscriptions.
            </p>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
            <p className="text-xs text-red-700">
              <strong>Error:</strong> {error || 'Unknown error occurred'}
              <br />
              Check your Supabase configuration and network connection.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

