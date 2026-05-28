-- Fix infinite recursion when is_admin_user() reads profiles under RLS.

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = user_uuid),
    FALSE
  );
$$;

-- Public read for published news (homepage, feed teasers).
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published news" ON public.news;
CREATE POLICY "Public can read published news"
  ON public.news
  FOR SELECT
  USING (is_published = TRUE);
