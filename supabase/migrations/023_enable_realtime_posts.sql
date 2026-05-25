-- Enable realtime for posts table
-- This migration adds the posts table to the supabase_realtime publication
-- so that real-time subscriptions can work for post updates

-- Check if the publication exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add posts table to the realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE posts;
  END IF;
END $$;

-- Verify the table is in the publication
-- This will show an error if something went wrong, but won't fail the migration
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_publication_tables 
  WHERE pubname = 'supabase_realtime' 
  AND tablename = 'posts';
  
  IF table_count = 0 THEN
    RAISE WARNING 'Posts table was not added to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'Posts table successfully added to supabase_realtime publication';
  END IF;
END $$;

