# Complete Supabase Realtime Setup Guide

This guide will help you enable and configure Supabase Realtime for all tables in your Optimix application.

## 📋 Prerequisites

- Supabase project set up
- Database migrations applied
- Environment variables configured

## 🚀 Quick Start

### Step 1: Apply the Migration

**Option A: Using Supabase Dashboard (Recommended)**

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/024_enable_realtime_all_tables.sql`
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
6. Verify success message: "All tables successfully added to supabase_realtime publication"

**Option B: Using Supabase CLI**

```bash
cd my-app
supabase db push
```

**Option C: Direct SQL Connection**

```bash
psql $DATABASE_URL -f supabase/migrations/024_enable_realtime_all_tables.sql
```

### Step 2: Verify Realtime is Enabled

1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Verify these tables are listed under "Realtime":
   - ✅ posts
   - ✅ messages
   - ✅ notifications
   - ✅ bookings
   - ✅ listings
   - ✅ comments
   - ✅ likes
   - ✅ profiles
   - ✅ orders
   - ✅ follows

### Step 3: Verify Environment Variables

Ensure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 4: Test Realtime Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open browser DevTools → **Network** → **WS** (WebSocket)
3. Look for connection to: `wss://your-project.supabase.co/realtime/v1/websocket`
4. Status should be **101 (Switching Protocols)**

## 🔧 Configuration

### Supabase Client Configuration

Your Supabase client is already configured in `src/integrations/supabase/client.ts` with:

```typescript
realtime: {
  params: {
    eventsPerSecond: 10,
  },
  heartbeatIntervalMs: 30000,
  reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
}
```

This configuration:
- Limits events to 10 per second (prevents overwhelming)
- Sends heartbeat every 30 seconds (keeps connection alive)
- Reconnects with exponential backoff (max 30 seconds)

## 📝 Usage Examples

### Example 1: Posts (Already Implemented)

Your `Home.tsx` and `Feed.tsx` already have realtime subscriptions for posts.

### Example 2: Messages

```typescript
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

function MessagesComponent({ channelId, userId }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !channelId) return;

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log('New message:', payload.new);
          queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
        }
      )
      .subscribe((status) => {
        console.log('Messages subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, channelId, queryClient]);

  // ... rest of component
}
```

### Example 3: Notifications

```typescript
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

function NotificationsComponent({ userId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('New notification:', payload.new);
          
          // Update notifications list
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          
          // Show toast notification
          toast({
            title: "New notification",
            description: payload.new.data?.message || "You have a new notification",
          });
        }
      )
      .subscribe((status) => {
        console.log('Notifications subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, toast]);

  // ... rest of component
}
```

### Example 4: Comments on Posts

```typescript
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

function PostComments({ postId }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log('New comment:', payload.new);
          queryClient.invalidateQueries({ queryKey: ['comments', postId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  // ... rest of component
}
```

### Example 5: Likes

```typescript
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

function PostCard({ postId }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`likes:${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'likes',
          filter: `target_type=eq.post AND target_id=eq.${postId}`,
        },
        (payload) => {
          console.log('Like changed:', payload);
          // Update like count and status
          queryClient.invalidateQueries({ queryKey: ['likes', 'post', postId] });
          queryClient.invalidateQueries({ queryKey: ['likeCount', 'post', postId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  // ... rest of component
}
```

### Example 6: Using the Realtime Utility

You have a utility at `src/lib/realtime.ts` that simplifies subscriptions:

```typescript
import { useRealtimeSubscription } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

function MyComponent({ userId }) {
  const queryClient = useQueryClient();

  useRealtimeSubscription(supabase, {
    table: 'posts',
    event: 'INSERT',
    callback: (payload) => {
      console.log('New post:', payload.new);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    enabled: !!userId, // Only subscribe when user is logged in
  });

  // ... rest of component
}
```

## 🧪 Testing Realtime

### Test Script

Add this to any component or run in browser console:

```typescript
// Test realtime connection
const testRealtime = async () => {
  const channel = supabase
    .channel('test-channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'posts',
    }, (payload) => {
      console.log('✅ Realtime working!', payload);
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
      // Should see: 'SUBSCRIBED'
    });
  
  // Clean up after 10 seconds
  setTimeout(() => {
    supabase.removeChannel(channel);
    console.log('Test channel removed');
  }, 10000);
};

// Call this function
testRealtime();
```

### Manual Testing

1. **Open two browser windows/tabs**
2. **Window 1**: Create a post, comment, or like
3. **Window 2**: Should see the update appear automatically
4. **Check console**: Look for subscription status and payload logs

## 🔍 Monitoring & Debugging

### Check WebSocket Connection

1. Open **Browser DevTools** → **Network** → **WS** (WebSocket)
2. Look for: `wss://your-project.supabase.co/realtime/v1/websocket`
3. Status should be **101 (Switching Protocols)**
4. Messages tab should show heartbeat messages

### Check Subscription Status

```typescript
const channel = supabase
  .channel('my-channel')
  .on('postgres_changes', { ... }, callback)
  .subscribe((status) => {
    console.log('Subscription status:', status);
    // Status can be:
    // - 'SUBSCRIBED' ✅
    // - 'TIMED_OUT' ⏱️
    // - 'CLOSED' ❌
    // - 'CHANNEL_ERROR' ⚠️
  });
```

### Debug All Channels

```typescript
// Check all active channels
supabase.realtime.getChannels().forEach(channel => {
  console.log('Channel:', channel.topic, 'Status:', channel.state);
});
```

### Connection Status Listeners

```typescript
// Listen for connection events
supabase.realtime.onOpen(() => {
  console.log('✅ Realtime connected');
});

supabase.realtime.onClose(() => {
  console.log('❌ Realtime disconnected');
});

supabase.realtime.onError((error) => {
  console.error('⚠️ Realtime error:', error);
});
```

## 🐛 Troubleshooting

### Issue 1: Realtime Not Working

**Checklist:**
- [ ] Migration applied successfully
- [ ] Tables visible in Dashboard → Database → Replication
- [ ] WebSocket connection established (DevTools → Network → WS)
- [ ] No console errors
- [ ] Environment variables correct
- [ ] User is authenticated (if RLS is enabled)

**Solution:**
1. Verify migration was applied: Check Supabase Dashboard → Database → Replication
2. Check browser console for errors
3. Verify WebSocket connection in Network tab
4. Ensure environment variables are set correctly

### Issue 2: Too Many Subscriptions

**Symptoms:**
- Performance issues
- Connection drops
- High memory usage

**Solution:**
- Limit subscriptions per component
- Always clean up subscriptions on unmount
- Use filters to narrow subscription scope
- Consider debouncing rapid updates

```typescript
// Always clean up!
useEffect(() => {
  const channel = supabase.channel('...').subscribe();
  
  return () => {
    supabase.removeChannel(channel); // ✅ Important!
  };
}, [dependencies]);
```

### Issue 3: Connection Drops

**Symptoms:**
- Subscriptions stop working
- No real-time updates

**Solution:**
- Your client already has reconnection logic
- Check network stability
- Verify Supabase service status
- Add connection status listeners (see above)

### Issue 4: RLS (Row Level Security) Blocking Updates

**Symptoms:**
- Subscriptions connect but no events received
- Works for some users but not others

**Solution:**
- Verify RLS policies allow SELECT on subscribed tables
- Check that user has proper permissions
- Test with service role key (admin) to verify it's RLS

## ⚡ Performance Optimization

### 1. Use Filters

Limit subscriptions to only relevant data:

```typescript
// ❌ Bad: Subscribes to all posts
filter: undefined

// ✅ Good: Only posts from specific user
filter: `author=eq.${userId}`

// ✅ Better: Only posts in specific group
filter: `group_id=eq.${groupId}`
```

### 2. Debounce Rapid Updates

```typescript
import { useMemo } from 'react';
import { debounce } from 'lodash';

const debouncedCallback = useMemo(
  () => debounce((payload) => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  }, 300),
  [queryClient]
);

useRealtimeSubscription(supabase, {
  table: 'posts',
  callback: debouncedCallback,
});
```

### 3. Limit Subscription Scope

```typescript
// Only subscribe when component is visible
const [isVisible, setIsVisible] = useState(true);

useRealtimeSubscription(supabase, {
  table: 'posts',
  enabled: isVisible && !!user?.id,
});
```

### 4. Batch Updates

```typescript
const [pendingUpdates, setPendingUpdates] = useState([]);

useEffect(() => {
  if (pendingUpdates.length === 0) return;

  const timer = setTimeout(() => {
    // Process all pending updates at once
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    setPendingUpdates([]);
  }, 500);

  return () => clearTimeout(timer);
}, [pendingUpdates]);
```

## ✅ Complete Checklist

Before considering realtime fully set up:

- [ ] Migration `024_enable_realtime_all_tables.sql` applied
- [ ] All tables visible in Supabase Dashboard → Database → Replication
- [ ] Environment variables configured in `.env.local`
- [ ] Supabase client configured with realtime settings
- [ ] Components using realtime subscriptions
- [ ] All subscriptions cleaned up on unmount
- [ ] WebSocket connection established (check DevTools)
- [ ] Tested with two browser windows
- [ ] No console errors
- [ ] Connection status listeners added (optional but recommended)

## 📚 Additional Resources

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [PostgreSQL Replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## 🎯 Next Steps

1. Apply the migration
2. Verify tables are enabled
3. Test with the test script
4. Implement realtime in your components
5. Monitor connection status
6. Optimize performance as needed

---

**Status:** ✅ Ready to use after migration is applied

**Last Updated:** 2025-01-27

