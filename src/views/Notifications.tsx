'use client'

import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Bell, Inbox } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Notification } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { AdsWidget } from "@/components/feed/widgets/AdsWidget";

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id, "all"],
    queryFn: () => {
      if (!user?.id) return [];
      return getNotifications(user.id, false); // Get all notifications
    },
    enabled: !!user?.id,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error("Not authenticated");
      return markAllNotificationsAsRead(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}:page`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const getNotificationLink = (notification: Notification): string => {
    const data = notification.data as any;
    if (data?.post_id) return `/post/${data.post_id}`;
    if (data?.listing_id) return `/listing/${data.listing_id}`;
    if (data?.order_id) return `/orders/${data.order_id}`;
    if (data?.booking_id) return `/bookings/${data.booking_id}`;
    if (data?.follower) return `/profile/${data.follower}`;
    return "#";
  };

  const getNotificationMessage = (notification: Notification): string => {
    const data = notification.data as any;
    switch (notification.type) {
      case "post_liked":
        return "liked your post";
      case "post_commented":
        return "commented on your post";
      case "user_followed":
        return "started following you";
      case "new_order":
        return "placed a new order";
      case "booking_requested":
        return "requested a booking";
      case "booking_confirmed":
        return "confirmed your booking";
      case "booking_canceled":
        return "canceled your booking";
      default:
        return "sent you a notification";
    }
  };

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                Mark all as read
              </Button>
            )}
          </div>

          <AdsWidget placement="notifications" className="mb-6" />

          {!notifications || notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Inbox className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No notifications yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  When you get likes, comments, follows, or messages, they'll show up here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const link = getNotificationLink(notification);
                const message = getNotificationMessage(notification);

                return (
                  <Card
                    key={notification.id}
                    className={notification.read ? "opacity-75" : ""}
                  >
                    <CardContent className="p-4">
                      <Link
                        href={link}
                        onClick={() => {
                          if (!notification.read) {
                            markAsReadMutation.mutate(notification.id);
                          }
                        }}
                        className="block"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                              notification.read ? "bg-transparent" : "bg-primary"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm">
                                <span className="font-semibold">Someone</span> {message}
                              </p>
                              {!notification.read && (
                                <Badge variant="outline" className="text-xs">
                                  New
                                </Badge>
                              )}
                            </div>
                            {notification.created_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

