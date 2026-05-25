-- Two-Factor Authentication Tables
-- This migration creates tables for TOTP-based 2FA and backup codes

-- User Two-Factor Authentication table
CREATE TABLE IF NOT EXISTS public.user_two_factor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  secret TEXT NOT NULL, -- Encrypted TOTP secret
  enabled BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE, -- Must verify during setup
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Two-Factor Backup Codes table
CREATE TABLE IF NOT EXISTS public.two_factor_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  code_hash TEXT NOT NULL, -- Hashed backup code
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, code_hash)
);

-- Two-Factor Verification Attempts (for rate limiting)
CREATE TABLE IF NOT EXISTS public.two_factor_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ, -- Lock account if too many failed attempts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Indexes for performance
CREATE INDEX idx_user_two_factor_user_id ON public.user_two_factor(user_id);
CREATE INDEX idx_two_factor_backup_codes_user_id ON public.two_factor_backup_codes(user_id);
CREATE INDEX idx_two_factor_backup_codes_used ON public.two_factor_backup_codes(user_id, used) WHERE used = FALSE;
CREATE INDEX idx_two_factor_attempts_user_id ON public.two_factor_attempts(user_id);
CREATE INDEX idx_two_factor_attempts_locked ON public.two_factor_attempts(user_id, locked_until) WHERE locked_until IS NOT NULL;

-- Function to update updated_at timestamp
CREATE TRIGGER update_user_two_factor_updated_at
  BEFORE UPDATE ON public.user_two_factor
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_two_factor_attempts_updated_at
  BEFORE UPDATE ON public.two_factor_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.user_two_factor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_two_factor
-- Users can only see their own 2FA settings
CREATE POLICY "Users can view own two_factor"
  ON public.user_two_factor FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own 2FA settings
CREATE POLICY "Users can insert own two_factor"
  ON public.user_two_factor FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own 2FA settings
CREATE POLICY "Users can update own two_factor"
  ON public.user_two_factor FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own 2FA settings
CREATE POLICY "Users can delete own two_factor"
  ON public.user_two_factor FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for two_factor_backup_codes
-- Users can only see their own backup codes
CREATE POLICY "Users can view own backup_codes"
  ON public.two_factor_backup_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own backup codes
CREATE POLICY "Users can insert own backup_codes"
  ON public.two_factor_backup_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own backup codes (mark as used)
CREATE POLICY "Users can update own backup_codes"
  ON public.two_factor_backup_codes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own backup codes
CREATE POLICY "Users can delete own backup_codes"
  ON public.two_factor_backup_codes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for two_factor_attempts
-- Users can only see their own attempt records
CREATE POLICY "Users can view own attempts"
  ON public.two_factor_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update attempts (for rate limiting)
-- Note: This will be handled via Supabase Edge Functions or service role
-- For now, users can insert their own attempts
CREATE POLICY "Users can insert own attempts"
  ON public.two_factor_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts"
  ON public.two_factor_attempts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

