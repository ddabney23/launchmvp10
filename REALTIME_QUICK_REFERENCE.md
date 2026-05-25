# Supabase Realtime Quick Reference

## 🚀 Quick Setup

1. **Apply Migration:**
   ```sql
   -- Run in Supabase Dashboard → SQL Editor
   -- File: supabase/migrations/024_enable_realtime_all_tables.sql
   ```

2. **Verify:**
   - Dashboard → Database → Replication
   - All tables should be listed

3. **Test:**
   ```typescript
   // In browser console
   const channel = supabase.channel('test')
     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, console.log)
     .subscribe(console.log);
   ```

## 📋 Common Patterns

### Basic Subscription

```typescript
useEffect(() => {
  const channel = supabase
    .channel('my-channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'posts',
    }, (payload) => {
      console.log('New:', payload.new);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

### With Filter

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'posts',
  filter: `author=eq.${userId}`, // Only posts from this user
}, callback)
```

### Multiple Events

```typescript
.on('postgres_changes', {
  event: '*', // INSERT, UPDATE, DELETE
  schema: 'public',
  table: 'posts',
}, (payload) => {
  if (payload.eventType === 'INSERT') {
    // Handle insert
  } else if (payload.eventType === 'UPDATE') {
    // Handle update
  } else if (payload.eventType === 'DELETE') {
    // Handle delete
  }
})
```

### Using Utility Hook

```typescript
import { useRealtimeSubscription } from '@/lib/realtime';

useRealtimeSubscription(supabase, {
  table: 'posts',
  event: 'INSERT',
  callback: (payload) => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  },
  enabled: !!user?.id,
});
```

## 🔍 Debugging

### Check Connection

```typescript
// In browser console
supabase.realtime.getChannels().forEach(ch => {
  console.log(ch.topic, ch.state);
});
```

### Monitor Status

```typescript
channel.subscribe((status) => {
  console.log('Status:', status);
  // SUBSCRIBED, TIMED_OUT, CLOSED, CHANNEL_ERROR
});
```

### Connection Events

```typescript
supabase.realtime.onOpen(() => console.log('Connected'));
supabase.realtime.onClose(() => console.log('Disconnected'));
supabase.realtime.onError((err) => console.error('Error:', err));
```

## 📊 Tables Enabled for Realtime

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

## ⚠️ Common Issues

| Issue | Solution |
|-------|----------|
| No events received | Check tables in Dashboard → Replication |
| Connection drops | Check network, verify reconnection logic |
| Too many subscriptions | Clean up on unmount, use filters |
| RLS blocking | Verify RLS policies allow SELECT |

## 🎯 Best Practices

1. ✅ Always clean up subscriptions
2. ✅ Use filters to limit scope
3. ✅ Debounce rapid updates
4. ✅ Monitor connection status
5. ✅ Handle errors gracefully

