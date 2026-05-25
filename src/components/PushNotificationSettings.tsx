'use client'

/**
 * Push Notification Settings Component
 * Allows users to manage push notification preferences
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, BellOff, Loader2, CheckCircle, XCircle } from "lucide-react";
import { usePushNotifications, getPushSubscription } from "@/lib/pushNotifications";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isClerkId } from "@/lib/user-id-helpers";

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface PushNotificationSettingsProps {
  vapidPublicKey?: string;
}

export function PushNotificationSettings({ vapidPublicKey }: PushNotificationSettingsProps) {
  const {
    permission,
    subscription,
    isSupported,
    isPermitted,
    requestPermission,
    subscribe,
    unsubscribe,
    show,
  } = usePushNotifications();
  
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(!!subscription);

  useEffect(() => {
    setIsSubscribed(!!subscription);
  }, [subscription]);

  const handleEnable = async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!isPermitted) {
        const newPermission = await requestPermission();
        if (newPermission !== "granted") {
          toast({
            title: "Permission Denied",
            description: "Please enable notifications in your browser settings",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      if (vapidPublicKey) {
        const sub = await subscribe(vapidPublicKey);
        if (sub) {
          // Send subscription to backend
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          
          // Get user ID from auth - use profile UUID for database operations
          if (!user?.id || !profile?.id) {
            throw new Error("User not authenticated or profile not found");
          }
          
          // Ensure we use profile UUID (not Clerk ID) for database operations
          const profileUuid = profile.id;
          
          const response = await fetch(
            `${supabaseUrl}/functions/v1/push-subscription`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${supabaseAnonKey}`,
                "apikey": supabaseAnonKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                endpoint: sub.endpoint,
                keys: {
                  p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
                  auth: arrayBufferToBase64(sub.getKey("auth")),
                },
                user_id: profileUuid, // Use profile UUID, not Clerk ID
              }),
            }
          );

          if (response.ok) {
            toast({
              title: "Success",
              description: "Push notifications enabled",
            });
            setIsSubscribed(true);
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to store subscription");
          }
        }
      } else {
        toast({
          title: "Configuration Error",
          description: "VAPID public key not configured",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error.message || "Failed to enable push notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    setIsLoading(true);
    try {
      const sub = await getPushSubscription();
      if (sub) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!user?.id || !profile?.id) {
          throw new Error("User not authenticated or profile not found");
        }
        
        // Ensure we use profile UUID (not Clerk ID) for database operations
        const profileUuid = profile.id;
        
        const response = await fetch(
          `${supabaseUrl}/functions/v1/push-subscription`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "apikey": supabaseAnonKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              user_id: profileUuid, // Use profile UUID, not Clerk ID
            }),
          }
        );

        if (response.ok) {
          await unsubscribe();
          toast({
            title: "Success",
            description: "Push notifications disabled",
          });
          setIsSubscribed(false);
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to remove subscription");
        }
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error.message || "Failed to disable push notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    await show({
      title: "Test Notification",
      body: "This is a test notification from Optimix",
      icon: "/favicon.ico",
      tag: "test",
    });
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>Browser does not support push notifications</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive browser notifications for important updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === "denied" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Notifications are blocked. Please enable them in your browser settings.
            </AlertDescription>
          </Alert>
        )}

        {isPermitted && isSubscribed && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Push notifications are enabled and active.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-notifications">Enable Push Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications even when the app is closed
            </p>
          </div>
          <Switch
            id="push-notifications"
            checked={isSubscribed && isPermitted}
            onCheckedChange={(checked) => {
              if (checked) {
                handleEnable();
              } else {
                handleDisable();
              }
            }}
            disabled={isLoading || permission === "denied"}
          />
        </div>

        {isPermitted && isSubscribed && (
          <Button
            variant="outline"
            onClick={handleTest}
            className="w-full"
          >
            <Bell className="mr-2 h-4 w-4" />
            Send Test Notification
          </Button>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

