-- Add parent_id column to comments table

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'comments' 
    AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.comments ADD COLUMN parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post_parent ON public.comments(post_id, parent_id);
  END IF;
END $$;

COMMENT ON COLUMN public.comments.parent_id IS 'Parent comment ID for nested replies';
