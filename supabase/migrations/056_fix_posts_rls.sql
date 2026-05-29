-- Fix posts RLS broken in 051 (wrong columns: author_id, published).
-- Schema uses posts.author and posts.visibility (see 001_init_schema.sql).

DROP POLICY IF EXISTS "Published posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
DROP POLICY IF EXISTS "select_posts_public" ON public.posts;
DROP POLICY IF EXISTS "insert_posts" ON public.posts;
DROP POLICY IF EXISTS "update_own_posts" ON public.posts;
DROP POLICY IF EXISTS "delete_own_posts" ON public.posts;

CREATE POLICY "select_posts_public" ON public.posts
  FOR SELECT
  USING (
    visibility = 'public'
    OR author = auth.uid()
    OR (
      visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower = auth.uid()
        AND following = posts.author
      )
    )
  );

CREATE POLICY "insert_posts" ON public.posts
  FOR INSERT
  WITH CHECK (author = auth.uid());

CREATE POLICY "update_own_posts" ON public.posts
  FOR UPDATE
  USING (author = auth.uid())
  WITH CHECK (author = auth.uid());

CREATE POLICY "delete_own_posts" ON public.posts
  FOR DELETE
  USING (author = auth.uid());
