# Instagram/Facebook Stories Feature - Implementation Plan

## 📋 Overview

This document outlines the complete implementation plan for adding Instagram/Facebook-style Stories to the social media platform. Stories are temporary posts (24-hour duration) that appear in a horizontal carousel at the top of the feed.

---

## 🎯 Feature Requirements

### Core Features
- ✅ **24-hour expiration** - Stories automatically disappear after 24 hours
- ✅ **Sequential viewing** - Tap to advance through stories
- ✅ **Progress indicators** - Visual bars showing story progress
- ✅ **Media support** - Images and short videos (max 30 seconds)
- ✅ **Story rings** - Gradient ring around unviewed stories, gray for viewed
- ✅ **View tracking** - See who viewed your stories
- ✅ **Reply to stories** - Direct message replies
- ✅ **Privacy controls** - Public, followers-only, or custom audience

### Advanced Features (Phase 2)
- 🔄 **Story highlights** - Save stories permanently to profile
- 🎨 **Stickers & text overlays** - Interactive elements
- 📊 **Story insights** - View counts, engagement metrics
- 🔗 **Link stickers** - Add external links (verified users)
- 📍 **Location tags** - Geolocation stickers
- 🎵 **Music integration** - Add background music
- ✨ **AR filters** - Augmented reality effects

---

## 📦 Database Schema

### New Tables

#### 1. `stories` Table
```sql
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  thumbnail_url TEXT, -- For video stories
  duration INTEGER DEFAULT 5, -- Seconds to display (5 for images, video length for videos)
  caption TEXT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'close_friends')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  view_count INTEGER DEFAULT 0,
  
  -- Constraints
  CHECK (duration <= 30) -- Max 30 seconds for videos
);

-- Indexes for performance
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX idx_stories_expires_at ON stories(expires_at);
CREATE INDEX idx_stories_active ON stories(expires_at) WHERE expires_at > NOW();

-- RLS Policies
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Anyone can view public stories
CREATE POLICY "Public stories are viewable by everyone"
  ON stories FOR SELECT
  USING (visibility = 'public' AND expires_at > NOW());

-- Followers can view followers-only stories
CREATE POLICY "Followers can view follower stories"
  ON stories FOR SELECT
  USING (
    visibility = 'followers' 
    AND expires_at > NOW()
    AND (
      user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM follows 
        WHERE follower_id = auth.uid() 
        AND following_id = stories.user_id
      )
    )
  );

-- Users can create their own stories
CREATE POLICY "Users can create own stories"
  ON stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own stories
CREATE POLICY "Users can delete own stories"
  ON stories FOR DELETE
  USING (auth.uid() = user_id);
```

#### 2. `story_views` Table
```sql
CREATE TABLE story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate views
  UNIQUE(story_id, viewer_id)
);

-- Indexes
CREATE INDEX idx_story_views_story_id ON story_views(story_id);
CREATE INDEX idx_story_views_viewer_id ON story_views(viewer_id);

-- RLS Policies
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Users can view who saw their stories
CREATE POLICY "Users can view their story views"
  ON story_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = story_views.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- Users can record views
CREATE POLICY "Users can record story views"
  ON story_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);
```

#### 3. `story_replies` Table
```sql
CREATE TABLE story_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_story_replies_story_id ON story_replies(story_id);
CREATE INDEX idx_story_replies_sender_id ON story_replies(sender_id);

-- RLS Policies
ALTER TABLE story_replies ENABLE ROW LEVEL SECURITY;

-- Story owner can view replies
CREATE POLICY "Story owners can view replies"
  ON story_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = story_replies.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- Senders can view their own replies
CREATE POLICY "Senders can view own replies"
  ON story_replies FOR SELECT
  USING (auth.uid() = sender_id);

-- Users can send replies
CREATE POLICY "Users can send story replies"
  ON story_replies FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
```

#### 4. `story_highlights` Table (Phase 2)
```sql
CREATE TABLE story_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  cover_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE story_highlight_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID REFERENCES story_highlights(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(highlight_id, story_id)
);
```

---

## 🗄️ Database Functions

### Auto-increment view count
```sql
CREATE OR REPLACE FUNCTION increment_story_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE stories 
  SET view_count = view_count + 1 
  WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER story_view_increment
  AFTER INSERT ON story_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_story_views();
```

### Auto-cleanup expired stories
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available) or run via cron job
-- SELECT cron.schedule('cleanup-stories', '0 * * * *', 'SELECT cleanup_expired_stories()');
```

### Get active stories for feed
```sql
CREATE OR REPLACE FUNCTION get_active_stories(user_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  story_count INTEGER,
  latest_story_at TIMESTAMPTZ,
  has_unviewed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COUNT(s.id)::INTEGER as story_count,
    MAX(s.created_at) as latest_story_at,
    BOOL_OR(sv.viewer_id IS NULL) as has_unviewed
  FROM profiles p
  INNER JOIN stories s ON s.user_id = p.id
  LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = user_uuid
  WHERE s.expires_at > NOW()
    AND (
      s.visibility = 'public'
      OR s.user_id = user_uuid
      OR (
        s.visibility = 'followers' 
        AND EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = user_uuid 
          AND following_id = s.user_id
        )
      )
    )
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  ORDER BY has_unviewed DESC, latest_story_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🎨 Frontend Components

### 1. `StoriesCarousel.tsx` - Horizontal scrolling carousel
```tsx
interface Story {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  has_unviewed: boolean;
  story_count: number;
}

export function StoriesCarousel({ stories }: { stories: Story[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
      {/* Your Story */}
      <YourStoryButton />
      
      {/* Other Stories */}
      {stories.map(story => (
        <StoryRing key={story.user_id} story={story} />
      ))}
    </div>
  );
}
```

### 2. `StoryRing.tsx` - Story avatar with ring
```tsx
export function StoryRing({ story }: { story: Story }) {
  return (
    <button className="flex flex-col items-center gap-1">
      {/* Ring */}
      <div className={cn(
        "p-[2px] rounded-full",
        story.has_unviewed 
          ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" 
          : "bg-gray-300"
      )}>
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full border-2 border-background overflow-hidden">
          <img src={story.avatar_url} alt={story.username} />
        </div>
      </div>
      
      {/* Username */}
      <span className="text-xs truncate max-w-[70px]">
        {story.username}
      </span>
    </button>
  );
}
```

### 3. `StoryViewer.tsx` - Full-screen story viewer
```tsx
export function StoryViewer({ userId, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Progress bars */}
      <div className="flex gap-1 p-2">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-gray-600 rounded">
            <div 
              className="h-full bg-white rounded transition-all"
              style={{ width: i === currentIndex ? `${progress}%` : i < currentIndex ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>
      
      {/* Story content */}
      <div className="relative h-full">
        {stories[currentIndex].media_type === 'image' ? (
          <img src={stories[currentIndex].media_url} className="w-full h-full object-contain" />
        ) : (
          <video src={stories[currentIndex].media_url} className="w-full h-full object-contain" autoPlay />
        )}
        
        {/* Tap zones */}
        <div className="absolute inset-0 flex">
          <button className="flex-1" onClick={previousStory} />
          <button className="flex-1" onClick={nextStory} />
        </div>
      </div>
    </div>
  );
}
```

### 4. `CreateStory.tsx` - Story creation interface
```tsx
export function CreateStory() {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  return (
    <div className="fixed inset-0 bg-black z-50">
      {preview ? (
        <>
          {/* Preview with editing tools */}
          <img src={preview} className="w-full h-full object-contain" />
          
          {/* Text overlay tool */}
          <TextOverlayTool />
          
          {/* Publish button */}
          <Button onClick={publishStory}>Share Story</Button>
        </>
      ) : (
        <FileUpload onSelect={handleFileSelect} />
      )}
    </div>
  );
}
```

---

## 🔌 API Routes

### `app/api/stories/route.ts` - Get active stories
```typescript
export async function GET(req: Request) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  
  const { data: stories } = await supabase
    .rpc('get_active_stories', { user_uuid: user.id });
    
  return Response.json(stories);
}

export async function POST(req: Request) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  
  const { media_url, media_type, duration, caption } = await req.json();
  
  const { data: story } = await supabase
    .from('stories')
    .insert({
      user_id: user.id,
      media_url,
      media_type,
      duration,
      caption
    })
    .select()
    .single();
    
  return Response.json(story);
}
```

### `app/api/stories/[userId]/route.ts` - Get user's stories
```typescript
export async function GET(req: Request, { params }: { params: { userId: string } }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  
  const { data: stories } = await supabase
    .from('stories')
    .select('*')
    .eq('user_id', params.userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
    
  return Response.json(stories);
}
```

### `app/api/stories/views/route.ts` - Record story view
```typescript
export async function POST(req: Request) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  
  const { story_id } = await req.json();
  
  await supabase
    .from('story_views')
    .insert({ story_id, viewer_id: user.id })
    .onConflict('story_id,viewer_id')
    .ignoreDuplicates();
    
  return Response.json({ success: true });
}
```

---

## 🎯 Implementation Phases

### Phase 1: Core Stories (Week 1-2)
- [ ] Create database tables and migrations
- [ ] Build `StoriesCarousel` component
- [ ] Build `StoryViewer` component
- [ ] Implement story creation (image only)
- [ ] Add 24-hour expiration logic
- [ ] Implement view tracking
- [ ] Add to Feed page

### Phase 2: Advanced Features (Week 3-4)
- [ ] Video support (max 30 seconds)
- [ ] Story replies/DMs
- [ ] View list (who viewed your story)
- [ ] Privacy controls (followers-only, close friends)
- [ ] Auto-cleanup cron job

### Phase 3: Premium Features (Week 5-6)
- [ ] Story highlights (save to profile)
- [ ] Text overlays and stickers
- [ ] Story insights/analytics
- [ ] Music integration
- [ ] Location tags

---

## 🚀 Gamification Integration

### Points System
```sql
-- Add story-related point actions
INSERT INTO point_actions (action, points, description) VALUES
('story_created', 3, 'Created a story'),
('story_viewed_100', 10, 'Your story reached 100 views'),
('story_replied', 2, 'Someone replied to your story');
```

### Badges
```sql
INSERT INTO badges (key, name, description, icon) VALUES
('first_story', 'Story Starter', 'Created your first story', '📖'),
('story_streak_7', 'Story Streak', 'Posted stories for 7 days straight', '🔥'),
('viral_story', 'Viral Story', 'Story reached 1000 views', '🚀'),
('story_master', 'Story Master', 'Created 100 stories', '🎬');
```

---

## 📱 Mobile Considerations

### Gestures
- **Tap left side** - Previous story
- **Tap right side** - Next story
- **Swipe down** - Close viewer
- **Swipe left/right** - Switch between users
- **Hold** - Pause story

### Performance
- Preload next 2 stories
- Lazy load images
- Video compression (max 30 seconds, 720p)
- Thumbnail generation for videos
- CDN for media delivery

---

## 🔒 Security & Privacy

### Content Moderation
- Auto-scan for inappropriate content
- Report functionality
- Admin review queue

### Privacy Controls
- Block users from viewing stories
- Hide story from specific users
- Close friends list management

### Data Retention
- Stories deleted after 24 hours
- Highlights saved permanently
- Views data retained for 30 days

---

## 📊 Analytics & Insights

### User Metrics
- Total views
- Unique viewers
- Completion rate
- Replies received
- Shares

### Platform Metrics
- Daily active story creators
- Average stories per user
- Peak posting times
- Story retention rate

---

## 🛠️ Tech Stack

- **Frontend**: React, Next.js 15, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Real-time, Storage)
- **Media**: Supabase Storage with CDN
- **State**: React Query (TanStack Query)
- **Video Processing**: FFmpeg for compression/thumbnails
- **Real-time**: Supabase Real-time for live view counts

---

## 📝 Migration Checklist

1. ✅ Create stories table
2. ✅ Create story_views table
3. ✅ Create story_replies table
4. ✅ Add RLS policies
5. ✅ Create database functions
6. ✅ Add indexes for performance
7. ✅ Set up storage bucket for story media
8. ✅ Create cleanup cron job
9. ✅ Add gamification integration
10. ✅ Test end-to-end flow

---

## 🎨 Design Inspiration

- **Instagram Stories** - Progress bars, tap zones, gradients
- **Facebook Stories** - Carousel layout, replies
- **Snapchat Stories** - Ephemeral content, privacy
- **WhatsApp Status** - Simple UX, privacy controls

---

## 🚧 Known Challenges

1. **Video compression** - Need server-side processing
2. **Real-time updates** - Story ring updates when new story posted
3. **Performance** - Preloading without excessive bandwidth
4. **Storage costs** - Auto-cleanup critical
5. **Timezone handling** - 24-hour expiration across timezones

---

## 📚 Resources

- [Instagram Stories Design Patterns](https://www.instagram.com)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [FFmpeg Video Processing](https://ffmpeg.org/documentation.html)
- [React Swipe Gestures](https://github.com/FormidableLabs/react-swipeable)

---

**Estimated Timeline**: 4-6 weeks for full implementation
**Complexity**: High
**Priority**: Medium-High (popular feature request)
