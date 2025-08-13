-- =====================================================
-- RLS ROLE MISMATCH FIX - CORRECTED VERSION
-- =====================================================
-- The RLS policies are checking auth.users.raw_user_meta_data->>'role'
-- but the actual role is stored in the profiles.role column
-- This script fixes the helper functions to check the correct location
-- CORRECTED: Uses CREATE OR REPLACE instead of DROP to avoid dependency errors
-- =====================================================

-- Helper function to check if current user is admin
-- Now checks the profiles table instead of auth metadata
-- Using CREATE OR REPLACE to avoid dependency errors
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Helper function to check if current user is professor
CREATE OR REPLACE FUNCTION public.is_professor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'professor'
  );
$$;

-- Helper function to check if current user is student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'student'
  );
$$;

-- Helper function to check if current user is admin or professor
CREATE OR REPLACE FUNCTION public.is_admin_or_professor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'professor')
  );
$$;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_professor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_professor() TO authenticated;

-- =====================================================
-- ALSO FIX THE get_user_feedback_quotas FUNCTION
-- =====================================================
-- This function is also failing with 400 errors
-- Let's ensure it exists and has proper permissions

-- Recreate the feedback quota function using CREATE OR REPLACE
CREATE OR REPLACE FUNCTION get_user_feedback_quotas(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    current_year INTEGER;
BEGIN
    -- Get current year
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Build the result JSON
    SELECT json_build_object(
        'bot_junior', json_build_object(
            'used', COALESCE(junior_used.count, 0),
            'remaining', GREATEST(0, 5 - COALESCE(junior_used.count, 0)),
            'max', 5
        ),
        'bot_senior', json_build_object(
            'used', COALESCE(senior_used.count, 0),
            'remaining', GREATEST(0, 5 - COALESCE(senior_used.count, 0)),
            'max', 5
        )
    ) INTO result
    FROM (
        SELECT 
            COUNT(*) FILTER (WHERE bot_id = 'bot_junior') as junior_count,
            COUNT(*) FILTER (WHERE bot_id = 'bot_senior') as senior_count
        FROM public.user_feedback_quotas 
        WHERE user_id = p_user_id 
        AND quota_year = current_year
    ) as quota_counts
    LEFT JOIN (
        SELECT COUNT(*) as count
        FROM public.user_feedback_quotas 
        WHERE user_id = p_user_id 
        AND bot_id = 'bot_junior'
        AND quota_year = current_year
    ) junior_used ON true
    LEFT JOIN (
        SELECT COUNT(*) as count
        FROM public.user_feedback_quotas 
        WHERE user_id = p_user_id 
        AND bot_id = 'bot_senior'
        AND quota_year = current_year
    ) senior_used ON true;
    
    RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_feedback_quotas(UUID) TO authenticated;

-- =====================================================
-- ENSURE user_feedback_quotas TABLE HAS PROPER RLS
-- =====================================================

-- Enable RLS on user_feedback_quotas if not already enabled
ALTER TABLE public.user_feedback_quotas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on user_feedback_quotas
DROP POLICY IF EXISTS "user_feedback_quotas_select_policy" ON public.user_feedback_quotas;
DROP POLICY IF EXISTS "user_feedback_quotas_insert_policy" ON public.user_feedback_quotas;
DROP POLICY IF EXISTS "user_feedback_quotas_update_policy" ON public.user_feedback_quotas;
DROP POLICY IF EXISTS "user_feedback_quotas_delete_policy" ON public.user_feedback_quotas;

-- Create new policies for user_feedback_quotas
CREATE POLICY "user_feedback_quotas_select_policy" ON public.user_feedback_quotas
    FOR SELECT USING (
        auth.uid() = user_id OR public.is_admin_or_professor()
    );

CREATE POLICY "user_feedback_quotas_insert_policy" ON public.user_feedback_quotas
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR public.is_admin_or_professor()
    );

CREATE POLICY "user_feedback_quotas_update_policy" ON public.user_feedback_quotas
    FOR UPDATE USING (
        auth.uid() = user_id OR public.is_admin_or_professor()
    )
    WITH CHECK (
        auth.uid() = user_id OR public.is_admin_or_professor()
    );

CREATE POLICY "user_feedback_quotas_delete_policy" ON public.user_feedback_quotas
    FOR DELETE USING (
        public.is_admin()
    );

-- =====================================================
-- SCRIPT COMPLETED
-- =====================================================
-- This should fix the 400 errors by:
-- 1. Correcting the role check functions to use profiles.role
-- 2. Ensuring get_user_feedback_quotas function exists and works
-- 3. Adding proper RLS policies for user_feedback_quotas table
-- 
-- CORRECTED VERSION: Uses CREATE OR REPLACE to avoid dependency errors
-- =====================================================
