# 🤖 Complete Social Media Platform Features - Implementation Guide

## Context
You are working on a Next.js 15 viral social media platform (TikTok/Instagram/Facebook hybrid) with Supabase backend. The project has:
- ✅ User authentication (Clerk)
- ✅ Posts feed with engagement (likes, comments, views, shares)
- ✅ Gamification system (points, levels, badges)
- ✅ Supabase Storage for media uploads
- ✅ React Query for state management
- ✅ Migration 038 with reactions, hashtags, polls, engagement events
- ✅ Mobile-responsive navigation

## 🎯 Remaining Features to Complete

### **Priority 1: Fix Current Issues** ⚠️
1. **Like/Comment Functionality** - CRITICAL
   - Users currently cannot like posts or comment
   - API routes exist but need testing
   - Need to verify profile UUID mapping
   
2. **Display Name/Username Display**
   - Usernames should appear on all posts
   - Profile avatars should load
   - "Unknown" placeholder needs fixing

### **Priority 2: Enhanced Social Features** 🚀

#### A. Instagram-Style Stories (Top Priority)
**What:** Ephemeral 24-hour visual content at top of feed
**Components needed:**
- `StoriesCarousel.tsx` - Horizontal scrolling avatars with rings
- `StoryViewer.tsx` - Full-screen modal viewer
- `CreateStory.tsx` - Upload interface
- `StoryProgressBars.tsx` - Progress indicators

**Database tables:**
```sql
CREATE TABLE stories (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  visibility TEXT DEFAULT 'public',
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE story_views (
  story_id UUID REFERENCES stories(id),
  viewer_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

CREATE TABLE story_replies (
  id UUID PRIMARY KEY,
  story_id UUID REFERENCES stories(id),
  sender_id UUID REFERENCES profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features:**
- Auto-advance every 5 seconds (images) or video duration
- Tap left/right to navigate
- Swipe down to close
- Reply via DM
- View count for own stories
- Gradient ring for unviewed (pink/purple)
- Gray ring for viewed
- Auto-expire after 24 hours

**Gamification:**
- +3 points for creating story
- +10 points at 100 views
- +2 points per reply
- Badge: "Story Starter 📖" (first story)
- Badge: "Story Streak 🔥" (7 days consecutive)
- Badge: "Viral Story 🚀" (1000+ views)

#### B. Hashtag System (Already in DB, needs UI)
**What:** Click hashtags to see all posts with that tag
**Components needed:**
- `HashtagLink.tsx` - Clickable hashtag
- `src/app/hashtags/[tag]/page.tsx` - Hashtag feed page
- `TrendingHashtags.tsx` - Sidebar widget

**Features:**
- Auto-extract #hashtags from post content
- Auto-create hashtag records
- Link via post_hashtags table
- Display as clickable links in posts
- Hashtag page shows all posts with that tag
- Trending widget shows top hashtags by score
- Trending score = (24hr count * 10) + all-time count

**Implementation:**
```typescript
// In createPost function
const extractHashtags = (content: string) => {
  const hashtagRegex = /#(\w+)/g;
  return content.match(hashtagRegex)?.map(tag => tag.slice(1)) || [];
};

const hashtags = extractHashtags(content);
for (const tag of hashtags) {
  // Upsert hashtag, link to post
}
```

#### C. Polls & Voting (Already in DB, needs UI)
**What:** Create polls in posts, vote, see results
**Components needed:**
- `PollCreation.tsx` - Create poll in post modal
- `PollDisplay.tsx` - Show poll with vote buttons
- `PollResults.tsx` - Show results with progress bars

**Features:**
- 2-4 poll options
- Optional expiration date
- One vote per user
- Live vote count updates
- Progress bars showing percentages
- "You voted" indicator
- Award +1 point per vote

**Database (already exists):**
- `polls` table - Question, expires_at
- `poll_options` table - Options with vote_count
- `poll_votes` table - User votes

#### D. User Tagging (@mentions)
**What:** Tag users in posts, they get notified
**Components needed:**
- `MentionInput.tsx` - Autocomplete @username
- `UserMentionLink.tsx` - Clickable @mention

**Features:**
- Type @ to trigger autocomplete
- Search profiles as you type
- Clickable mentions link to profiles
- Tagged users get notification
- +1 point when tagged

**Database (already exists):**
- `post_tags` table links posts to tagged users

#### E. Repost/Reshare Feature
**What:** Share someone's post to your feed
**Components needed:**
- Repost button in PostCard
- Repost modal with optional comment

**Features:**
- "Repost" button next to share
- Option to add comment (quote repost)
- Shows original post embedded
- Original author gets +2 points
- Reposter gets +1 point
- Track repost_count on posts

**Database:**
- `posts.is_repost BOOLEAN`
- `posts.original_post_id UUID`
- `posts.repost_count INTEGER`

#### F. Trending Feed & Discovery
**What:** Separate feed showing viral/trending posts
**Components needed:**
- `src/app/trending/page.tsx` - Trending feed
- `TrendingWidget.tsx` - Sidebar preview

**Features:**
- Sort by trending_score (engagement weight)
- Time-decay algorithm (recent = higher)
- Shows posts from last 7 days
- Filter by category (viral, new, rising)
- "People You May Know" widget
- "New Users" widget

**Algorithm:**
```typescript
trending_score = 
  (views * 0.1) + 
  (likes * 1) + 
  (comments * 2) + 
  (shares * 3) + 
  (time_decay_factor)

time_decay_factor = 
  1 / (hours_since_post / 24)
```

#### G. Live Notifications
**What:** Real-time notifications for engagement
**Components needed:**
- `NotificationBell.tsx` - Bell icon with count badge
- `NotificationDropdown.tsx` - List of notifications
- `src/app/notifications/page.tsx` - Full notifications page

**Features:**
- Real-time Supabase subscriptions
- Notification types: like, comment, follow, mention, reply
- Mark as read
- Badge count in navigation
- Sound/vibration on new notification
- Clear all button

**Database:**
- `notifications` table with type, read status
- Real-time channel subscription

#### H. Direct Messaging (DMs)
**What:** Private messages between users
**Components needed:**
- `src/app/messages/page.tsx` - Inbox page
- `ConversationList.tsx` - List of chats
- `MessageThread.tsx` - Chat interface
- `MessageInput.tsx` - Send message

**Features:**
- Send text, images, videos
- Real-time message updates
- Typing indicators
- Read receipts
- Message search
- Delete messages
- Block users

**Database:**
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  participant_1 UUID REFERENCES profiles(id),
  participant_2 UUID REFERENCES profiles(id),
  last_message_at TIMESTAMPTZ,
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender_id UUID REFERENCES profiles(id),
  content TEXT,
  media_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### I. User Search & Discovery
**What:** Search for users, posts, hashtags
**Components needed:**
- `SearchBar.tsx` - Omnisearch input
- `SearchResults.tsx` - Tabbed results (users, posts, hashtags)

**Features:**
- Full-text search across profiles, posts
- Filter by type (users, posts, hashtags)
- Recent searches
- Suggested users
- Trending hashtags in search

#### J. Follow Suggestions
**What:** Recommend users to follow
**Components needed:**
- `FollowSuggestions.tsx` - Card with suggested users
- Algorithm: mutual follows, similar interests

**Features:**
- "People You May Know" based on:
  - Mutual followers
  - Similar badges/levels
  - Engagement patterns
- "New Users to Follow"
- "Trending Creators"

---

## 📋 Complete Implementation Checklist

### Phase 1: Core Fixes (Week 1)
- [ ] Fix like/comment functionality (URGENT)
- [ ] Fix username/avatar display
- [ ] Test all engagement features
- [ ] Verify points system working

### Phase 2: Hashtags & Polls (Week 2)
- [ ] Auto-extract hashtags from posts
- [ ] Create hashtag pages
- [ ] Build trending hashtags widget
- [ ] Implement poll creation UI
- [ ] Build poll voting interface
- [ ] Show poll results

### Phase 3: Stories Feature (Week 3)
- [ ] Create stories database migration
- [ ] Build stories carousel
- [ ] Implement full-screen story viewer
- [ ] Add story creation interface
- [ ] Auto-expire stories (24hr)
- [ ] Track views and replies

### Phase 4: Advanced Social (Week 4)
- [ ] User tagging with autocomplete
- [ ] Repost/reshare feature
- [ ] Trending feed algorithm
- [ ] Discovery widgets

### Phase 5: Real-Time Features (Week 5)
- [ ] Live notifications system
- [ ] Notification bell with count
- [ ] Real-time post updates
- [ ] Typing indicators (for DMs later)

### Phase 6: Messaging (Week 6)
- [ ] DM database schema
- [ ] Inbox/conversation list
- [ ] Chat interface
- [ ] Real-time messages
- [ ] Media sharing in DMs

### Phase 7: Search & Discovery (Week 7)
- [ ] Omnisearch implementation
- [ ] User search
- [ ] Post search
- [ ] Hashtag search
- [ ] Follow suggestions algorithm

### Phase 8: Polish & Optimization (Week 8)
- [ ] Performance optimizations
- [ ] Mobile responsiveness
- [ ] Loading states
- [ ] Error handling
- [ ] Analytics dashboard

---

## 🎨 Design Guidelines

**Color Scheme (Threads/Instagram-inspired):**
- Primary: Pink/Purple gradients
- Secondary: Blue/Teal
- Accent: Yellow/Orange
- Text: Dark gray on white
- Rings: Gradient (unviewed), Gray (viewed)

**Typography:**
- Headers: Bold, clean sans-serif
- Body: Regular weight, readable
- Usernames: Medium weight, clickable
- Timestamps: Small, gray

**Spacing:**
- Mobile-first (320px minimum)
- Generous padding (16px, 24px)
- Card-based layouts
- Bottom navigation (mobile)

---

## 🔧 Technical Stack

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- TailwindCSS
- shadcn/ui components
- React Query (TanStack Query)
- Clerk (auth)

**Backend:**
- Supabase (PostgreSQL)
- Supabase Storage (media)
- Supabase Real-time (subscriptions)
- Row Level Security (RLS)

**Additional Libraries:**
- date-fns (timestamps)
- react-swipeable (gestures)
- react-mentions (autocomplete)
- framer-motion (animations)

---

## 📚 Reference Patterns

**Existing files to follow:**
- `src/views/Feed.tsx` - Feed structure
- `src/components/PostCard.tsx` - Post display
- `src/lib/api.ts` - API patterns
- `src/hooks/useFeed.ts` - React Query hooks
- `supabase/migrations/038_enhanced_social_features_fixed.sql` - Schema patterns

**API route pattern:**
```typescript
// app/api/feature/route.ts
export async function GET(req: NextRequest) {
  const userId = await getClerkUserId();
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('table')
    .select('*')
    .eq('user_id', userId);
    
  return NextResponse.json({ data });
}
```

---

## 🚀 Success Criteria

Feature is complete when:
- ✅ No console errors
- ✅ Mobile responsive
- ✅ Real-time updates work
- ✅ Points/badges awarded correctly
- ✅ RLS policies secure
- ✅ Loading states present
- ✅ Error handling graceful
- ✅ Performance optimized

---

**Start with fixing likes/comments, then build Stories, then expand to full social features! 🎯**

---

## 📋 Implementation Requirements

### 1. Database Setup
Create the following tables in Supabase:

**stories table:**
- Store story media (images/videos), user_id, caption, visibility
- Auto-expire after 24 hours (expires_at field)
- Track view count
- RLS policies for privacy (public, followers-only)

**story_views table:**
- Track who viewed each story
- Prevent duplicate views (unique constraint)
- Auto-increment story view count via trigger

**story_replies table:**
- Allow users to reply to stories (DM-style)
- Link to story_id and sender_id

### 2. Core Features to Implement

#### A. Stories Carousel (Top of Feed)
- Horizontal scrolling carousel above the feed
- Show user avatars with gradient rings (unviewed) or gray rings (viewed)
- "Your Story" button with + icon to create story
- Display username below each avatar
- Order: unviewed first, then by recency

#### B. Story Viewer (Full-Screen)
- Full-screen modal when clicking a story avatar
- Progress bars at top (one per story from that user)
- Auto-advance through stories (5 seconds for images, video duration for videos)
- Tap left side = previous story
- Tap right side = next story
- Swipe down = close viewer
- Show username and "X ago" timestamp
- Reply input at bottom
- View count for your own stories

#### C. Story Creation
- Simple upload interface (camera or gallery)
- Support images and videos (max 30 seconds)
- Text overlay tool (optional)
- Privacy selector (public/followers-only)
- "Share to Story" button
- Award +3 points on story creation

#### D. Real-Time Updates
- New story appears in carousel immediately
- Story rings update when viewed
- Live view count updates

### 3. UI/UX Guidelines

**Design Style:**
- Follow Threads/Instagram minimalist design
- Clean, modern, mobile-first
- Use existing TailwindCSS theme colors
- Gradient ring: `from-yellow-400 via-pink-500 to-purple-600`
- Smooth transitions and animations

**Component Structure:**
```
src/components/stories/
├── StoriesCarousel.tsx       # Horizontal scrolling carousel
├── StoryRing.tsx             # Avatar with gradient ring
├── StoryViewer.tsx           # Full-screen viewer modal
├── CreateStory.tsx           # Story creation interface
├── StoryProgressBars.tsx     # Progress indicators
└── StoryReplyInput.tsx       # Reply at bottom of viewer
```

### 4. API Routes to Create

```
app/api/stories/
├── route.ts                  # GET (active stories), POST (create story)
├── [userId]/route.ts         # GET (user's stories)
├── views/route.ts            # POST (record view)
└── replies/route.ts          # POST (send reply)
```

### 5. Database Functions

Create these PostgreSQL functions:
- `get_active_stories(user_uuid)` - Get stories for feed with unviewed status
- `increment_story_views()` - Trigger to increment view count
- `cleanup_expired_stories()` - Delete stories older than 24 hours

### 6. Gamification Integration

**Points:**
- +3 points for creating a story
- +10 points when story reaches 100 views
- +2 points when someone replies

**Badges:**
- "Story Starter 📖" - First story created
- "Story Streak 🔥" - 7 days in a row
- "Viral Story 🚀" - Story reached 1000 views

---

## 🔧 Technical Implementation Details

### Supabase Storage Setup
```typescript
// Create storage bucket for stories
const { data, error } = await supabase.storage.createBucket('stories', {
  public: true,
  fileSizeLimit: 52428800, // 50MB
  allowedMimeTypes: ['image/*', 'video/*']
});
```

### Story Expiration Logic
```typescript
// Auto-cleanup via cron job or scheduled function
const cleanupExpiredStories = async () => {
  const { data } = await supabase
    .from('stories')
    .delete()
    .lt('expires_at', new Date().toISOString());
};
```

### Progress Timer Logic
```typescript
// In StoryViewer component
useEffect(() => {
  const duration = story.media_type === 'video' 
    ? story.duration * 1000 
    : 5000; // 5 seconds for images
  
  const interval = setInterval(() => {
    setProgress(prev => {
      if (prev >= 100) {
        nextStory();
        return 0;
      }
      return prev + (100 / (duration / 100));
    });
  }, 100);
  
  return () => clearInterval(interval);
}, [currentStoryIndex]);
```

### View Tracking
```typescript
// Record view when story is displayed
const recordView = async (storyId: string) => {
  await supabase
    .from('story_views')
    .insert({ story_id: storyId, viewer_id: user.id })
    .onConflict(['story_id', 'viewer_id'])
    .ignoreDuplicates();
};
```

---

## 📱 Mobile-First Considerations

### Gestures (use react-swipeable or similar)
- Swipe down: Close viewer
- Swipe left/right: Navigate between users
- Tap left/right: Navigate between stories
- Hold: Pause story

### Performance Optimizations
- Lazy load story media
- Preload next 2 stories
- Compress videos server-side
- Use thumbnails for video stories
- Implement infinite scroll for carousel

---

## ✅ Acceptance Criteria

Before considering this feature complete, verify:

1. **Carousel Display**
   - [ ] Stories carousel appears at top of feed
   - [ ] Gradient ring for unviewed stories
   - [ ] Gray ring for viewed stories
   - [ ] "Your Story" button works
   - [ ] Horizontal scrolling is smooth

2. **Story Viewer**
   - [ ] Full-screen modal opens on tap
   - [ ] Progress bars show correctly
   - [ ] Stories auto-advance
   - [ ] Tap zones work (left/right)
   - [ ] View count displays for own stories
   - [ ] Close button/swipe down works

3. **Story Creation**
   - [ ] Upload interface is intuitive
   - [ ] Images upload successfully
   - [ ] Videos upload successfully (max 30s)
   - [ ] Privacy settings work
   - [ ] Story appears in carousel immediately

4. **Real-Time Updates**
   - [ ] New stories appear without refresh
   - [ ] View counts update live
   - [ ] Story rings update after viewing

5. **Gamification**
   - [ ] +3 points awarded on story creation
   - [ ] Notification appears for points
   - [ ] Badges unlock at milestones

6. **Expiration**
   - [ ] Stories disappear after 24 hours
   - [ ] Cleanup function runs correctly

---

## 🎨 Code Style Requirements

- Use TypeScript with proper typing
- Follow existing project structure and patterns
- Use shadcn/ui components where applicable
- Keep components small and focused (max 200 lines)
- Add proper error handling
- Include loading states
- Write clean, readable code with comments

---

## 📦 Dependencies to Add

```json
{
  "react-swipeable": "^7.0.1",
  "date-fns": "^3.0.0" // For "X ago" timestamps
}
```

---

## 🚀 Step-by-Step Implementation Order

### Phase 1: Database (Day 1)
1. Create migration file `034_stories_feature.sql`
2. Add stories, story_views, story_replies tables
3. Add RLS policies
4. Create database functions and triggers
5. Run migration in Supabase

### Phase 2: Backend APIs (Day 2)
1. Create API route `app/api/stories/route.ts`
2. Create API route `app/api/stories/[userId]/route.ts`
3. Create API route `app/api/stories/views/route.ts`
4. Test all endpoints with Postman/Bruno

### Phase 3: Components (Days 3-4)
1. Create `StoriesCarousel.tsx`
2. Create `StoryRing.tsx`
3. Create `StoryViewer.tsx`
4. Create `CreateStory.tsx`
5. Add to Feed page

### Phase 4: Real-Time & Polish (Day 5)
1. Add real-time subscriptions
2. Implement view tracking
3. Add reply functionality
4. Test on mobile devices
5. Fix any bugs

### Phase 5: Gamification (Day 6)
1. Integrate point awards
2. Create story badges
3. Add notifications
4. Test end-to-end

---

## 🐛 Common Pitfalls to Avoid

1. **Don't forget RLS policies** - Stories won't load without proper policies
2. **Handle video duration** - Extract duration from video files
3. **Prevent memory leaks** - Clean up intervals/subscriptions
4. **Test expiration logic** - Ensure 24-hour cleanup works
5. **Mobile testing** - Test gestures on actual devices
6. **Performance** - Don't load all stories at once
7. **Timezone handling** - Use UTC for expires_at

---

## 📚 Reference Files

Check these existing files for patterns:
- `src/views/Feed.tsx` - Feed layout and structure
- `src/views/CreatePost.tsx` - File upload logic
- `src/lib/api.ts` - API client patterns
- `src/hooks/useFeed.ts` - React Query hooks
- `supabase/migrations/032_gamification_system.sql` - Gamification patterns

---

## 🎯 Success Metrics

After implementation, the feature is successful if:
- Users can create and view stories smoothly
- No console errors or warnings
- Stories expire after 24 hours automatically
- Real-time updates work reliably
- Mobile experience is smooth
- Gamification awards points correctly

---

## 💡 Tips for Cursor AI

1. **Start with database** - Get the schema right first
2. **Test incrementally** - Don't build everything at once
3. **Use existing patterns** - Follow the project's conventions
4. **Think mobile-first** - Most users will be on mobile
5. **Optimize early** - Stories are performance-critical
6. **Handle errors gracefully** - Network issues are common

---

## 🔗 Additional Resources

- See `STORIES_FEATURE_IMPLEMENTATION_PLAN.md` for detailed architecture
- Check Instagram/Threads for UX inspiration
- Review Supabase Real-time docs for live updates
- Test with different file sizes and formats

---

**Good luck! Build an amazing Stories feature! 🚀**
