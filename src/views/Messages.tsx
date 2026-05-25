'use client'

import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendMessage, createChannelId } from "@/lib/api";
import { getProfile } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Message, Profile } from "@/lib/types";

interface Channel {
  channelId: string;
  otherUserId: string;
  lastMessage?: Message;
  unreadCount: number;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);

  // Get all unique channels for the current user
  useEffect(() => {
    if (!user?.id) return;

    const fetchChannels = async () => {
      const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .or(`channel_id.ilike.%,${user.id},%`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching channels:", error);
        return;
      }

      // Group messages by channel
      const channelMap = new Map<string, Channel>();
      messages?.forEach((message: Message) => {
        if (!channelMap.has(message.channel_id)) {
          // Extract other user ID from channel_id
          const userIds = message.channel_id.split("_");
          const otherUserId = userIds.find((id) => id !== user.id) || "";
          
          channelMap.set(message.channel_id, {
            channelId: message.channel_id,
            otherUserId,
            lastMessage: message,
            unreadCount: message.read ? 0 : 1,
          });
        } else {
          const channel = channelMap.get(message.channel_id)!;
          if (!channel.lastMessage || new Date(message.created_at || 0) > new Date(channel.lastMessage.created_at || 0)) {
            channel.lastMessage = message;
          }
          if (!message.read) {
            channel.unreadCount++;
          }
        }
      });

      setChannels(Array.from(channelMap.values()));
      
      // Select first channel if none selected
      if (!selectedChannel && channels.length > 0) {
        setSelectedChannel(channels[0].channelId);
      }
    };

    fetchChannels();
  }, [user?.id, selectedChannel]);

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedChannel],
    queryFn: () => {
      if (!selectedChannel) return [];
      return getMessages(selectedChannel, 100);
    },
    enabled: !!selectedChannel,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (body: string) => {
      if (!selectedChannel || !user?.id) throw new Error("Invalid state");
      return sendMessage({
        channel_id: selectedChannel,
        body,
      });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChannel] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Subscribe to real-time messages
  useEffect(() => {
    if (!selectedChannel || !user?.id) return;

    const channel = supabase
      .channel(`messages:${selectedChannel}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${selectedChannel}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", selectedChannel] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannel, user?.id, queryClient]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChannel) return;
    sendMessageMutation.mutate(messageText.trim());
  };

  const selectedChannelObj = channels.find((c) => c.channelId === selectedChannel);
  const otherUserId = selectedChannelObj?.otherUserId;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8">
        <div className="max-w-6xl mx-auto h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">
          <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Messages
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Channels List */}
            <Card className="md:col-span-1">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="p-4 border-b">
                  <h2 className="font-semibold">Conversations</h2>
                </div>
                <ScrollArea className="flex-1">
                  {channels.length > 0 ? (
                    <div className="divide-y">
                      {channels.map((channel) => (
                        <ChannelItem
                          key={channel.channelId}
                          channel={channel}
                          isSelected={channel.channelId === selectedChannel}
                          onClick={() => setSelectedChannel(channel.channelId)}
                          currentUserId={user?.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No conversations yet
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card className="md:col-span-2">
              <CardContent className="p-0 h-full flex flex-col">
                {selectedChannel ? (
                  <>
                    {otherUserId && <ChatHeader userId={otherUserId} />}
                    <ScrollArea className="flex-1 p-4">
                      {messages && messages.length > 0 ? (
                        <div className="space-y-4">
                          {messages.map((message) => (
                            <MessageBubble
                              key={message.id}
                              message={message}
                              isOwn={message.sender === user?.id}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No messages yet. Start the conversation!
                        </div>
                      )}
                    </ScrollArea>
                    <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
                      <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sendMessageMutation.isPending}
                      />
                      <Button
                        type="submit"
                        disabled={!messageText.trim() || sendMessageMutation.isPending}
                      >
                        {sendMessageMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Select a conversation to start messaging
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function ChannelItem({
  channel,
  isSelected,
  onClick,
  currentUserId,
}: {
  channel: Channel;
  isSelected: boolean;
  onClick: () => void;
  currentUserId?: string;
}) {
  const { data: profile } = useQuery({
    queryKey: ["profile", channel.otherUserId],
    queryFn: () => getProfile(channel.otherUserId),
    enabled: !!channel.otherUserId,
  });

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-muted transition-colors ${
        isSelected ? "bg-muted" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback>
            {profile?.username?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {profile?.display_name || profile?.username || "User"}
          </p>
          {channel.lastMessage && (
            <p className="text-xs text-muted-foreground truncate">
              {channel.lastMessage.body?.substring(0, 30)}...
            </p>
          )}
        </div>
        {channel.unreadCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {channel.unreadCount}
          </Badge>
        )}
      </div>
    </div>
  );
}

function ChatHeader({ userId }: { userId: string }) {
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile(userId),
    enabled: !!userId,
  });

  return (
    <div className="p-4 border-b flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={profile?.avatar_url || undefined} />
        <AvatarFallback>
          {profile?.username?.[0]?.toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="font-semibold">{profile?.display_name || profile?.username || "User"}</p>
        <p className="text-xs text-muted-foreground">
          {profile?.is_vendor ? "Vendor" : "User"}
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="text-sm">{message.body}</p>
        {message.created_at && (
          <p
            className={`text-xs mt-1 ${
              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </p>
        )}
      </div>
    </div>
  );
}

