-- Audit Logging System
-- This migration creates the audit_logs table for tracking admin actions

-- Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Admin who performed the action
  action TEXT NOT NULL, -- Action type (e.g., 'user_updated', 'badge_created', 'vendor_approved')
  resource_type TEXT NOT NULL, -- Resource type (e.g., 'user', 'badge', 'vendor', 'news')
  resource_id UUID, -- ID of the affected resource
  details JSONB, -- Additional details about the action
  ip_address INET, -- IP address of the user
  user_agent TEXT, -- User agent string
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON public.audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource_composite ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_user_action ON public.audit_logs(user_id, action);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
-- Only admins can view audit logs
-- Note: This uses a function to check admin status
-- For now, we'll use a policy that checks if the user is an admin via email pattern
-- In production, you should use a proper role-based check

-- Function to check if user is admin (based on email pattern)
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_uuid;
  
  -- Check if email matches admin pattern
  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check for admin email pattern
  IF user_email LIKE '%@admin%' OR user_email LIKE '%admin@%' OR user_email = 'ddabney23@gmail.com' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if profile has is_admin flag (if column exists)
  -- This is a fallback for future role-based admin system
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_uuid
    AND (is_admin = TRUE OR email LIKE '%@admin%' OR email LIKE '%admin@%')
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Only admins can view audit logs
CREATE POLICY "Admins can view audit_logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin_user(auth.uid()));

-- Policy: Only admins can insert audit logs
-- Note: In practice, this should be done via service role or edge functions
-- But we allow admins to insert for client-side logging
CREATE POLICY "Admins can insert audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Policy: No updates or deletes allowed (audit logs are immutable)
-- This ensures audit trail integrity

-- Retention policy function (optional - can be run as a scheduled job)
-- This function deletes audit logs older than the specified retention period
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE public.audit_logs IS 'Audit log for tracking admin actions and system events';
COMMENT ON COLUMN public.audit_logs.action IS 'Type of action performed (e.g., user_updated, badge_created)';
COMMENT ON COLUMN public.audit_logs.resource_type IS 'Type of resource affected (e.g., user, badge, vendor)';
COMMENT ON COLUMN public.audit_logs.resource_id IS 'UUID of the affected resource';
COMMENT ON COLUMN public.audit_logs.details IS 'JSON object with additional action details';

