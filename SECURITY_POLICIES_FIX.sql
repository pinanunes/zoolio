-- =====================================================
-- ZOOLIO SECURITY POLICIES FIX
-- =====================================================
-- This script fixes the loading screen issue by creating proper
-- Row Level Security (RLS) policies for all tables.
-- 
-- PROBLEM: Users get stuck on loading screen because the app
-- can't fetch profile data due to missing RLS policies.
-- 
-- SOLUTION: Create proper security policies that allow:
-- - Users to read their own data
-- - Admins/professors to manage data
-- - Proper access control for all operations
-- =====================================================

-- =====================================================
-- 1. PROFILES TABLE SECURITY
-- =====================================================

-- Enable RLS on profiles table (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Policy for users to view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policy for users to insert their own profile (during registration)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy for admins and professors to view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'professor')
        )
    );

-- Policy for admins to manage all profiles
CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- =====================================================
-- 2. TEAMS TABLE SECURITY
-- =====================================================

-- Enable RLS on teams table
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own team" ON public.teams;
DROP POLICY IF EXISTS "Students can view all teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;

-- Policy for users to view their own team
CREATE POLICY "Users can view own team" ON public.teams
    FOR SELECT USING (
        id IN (
            SELECT team_id FROM public.profiles 
            WHERE id = auth.uid() AND team_id IS NOT NULL
        )
    );

-- Policy for students to view all teams (for leaderboard, etc.)
CREATE POLICY "Students can view all teams" ON public.teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('student', 'professor', 'admin')
        )
    );

-- Policy for admins and professors to manage teams
CREATE POLICY "Admins can manage teams" ON public.teams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'professor')
        )
    );

-- =====================================================
-- 3. DISEASES TABLE SECURITY
-- =====================================================

-- Enable RLS on diseases table
ALTER TABLE public.diseases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view diseases" ON public.diseases;
DROP POLICY IF EXISTS "Admins can manage diseases" ON public.diseases;

-- Policy for everyone to view diseases
CREATE POLICY "Everyone can view diseases" ON public.diseases
    FOR SELECT USING (true);

-- Policy for admins to manage diseases
CREATE POLICY "Admins can manage diseases" ON public.diseases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- =====================================================
-- 4. CHAT_LOGS TABLE SECURITY
-- =====================================================

-- Enable RLS on chat_logs table
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Users can insert own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Users can update own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Professors can view all chat logs" ON public.chat_logs;

-- Policy for users to view their own chat logs
CREATE POLICY "Users can view own chat logs" ON public.chat_logs
    FOR SELECT USING (user_id = auth.uid());

-- Policy for users to insert their own chat logs
CREATE POLICY "Users can insert own chat logs" ON public.chat_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy for users to update their own chat logs (for feedback)
CREATE POLICY "Users can update own chat logs" ON public.chat_logs
    FOR UPDATE USING (user_id = auth.uid());

-- Policy for professors and admins to view all chat logs
CREATE POLICY "Professors can view all chat logs" ON public.chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'professor')
        )
    );

-- =====================================================
-- 5. COMPARATIVE_CHAT_LOGS TABLE SECURITY
-- =====================================================

-- Enable RLS on comparative_chat_logs table
ALTER TABLE public.comparative_chat_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own comparative logs" ON public.comparative_chat_logs;
DROP POLICY IF EXISTS "Users can insert own comparative logs" ON public.comparative_chat_logs;
DROP POLICY IF EXISTS "Users can update own comparative logs" ON public.comparative_chat_logs;
DROP POLICY IF EXISTS "Professors can view all comparative logs" ON public.comparative_chat_logs;

-- Policy for users to view their own comparative chat logs
CREATE POLICY "Users can view own comparative logs" ON public.comparative_chat_logs
    FOR SELECT USING (user_id = auth.uid());

-- Policy for users to insert their own comparative chat logs
CREATE POLICY "Users can insert own comparative logs" ON public.comparative_chat_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy for users to update their own comparative chat logs
CREATE POLICY "Users can update own comparative logs" ON public.comparative_chat_logs
    FOR UPDATE USING (user_id = auth.uid());

-- Policy for professors and admins to view all comparative chat logs
CREATE POLICY "Professors can view all comparative logs" ON public.comparative_chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'professor')
        )
    );

-- =====================================================
-- 6. FEEDBACK_VALIDATIONS TABLE SECURITY
-- =====================================================

-- Enable RLS on feedback_validations table
ALTER TABLE public.feedback_validations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Students can view validations of their logs" ON public.feedback_validations;
DROP POLICY IF EXISTS "Professors can manage validations" ON public.feedback_validations;

-- Policy for students to view validations of their own chat logs
CREATE POLICY "Students can view validations of their logs" ON public.feedback_validations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_logs 
            WHERE id = feedback_validations.log_id 
            AND user_id = auth.uid()
        )
    );

-- Policy for professors to manage all validations
CREATE POLICY "Professors can manage validations" ON public.feedback_validations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'professor')
        )
    );

-- =====================================================
-- 7. FEEDBACK_QUOTAS TABLE SECURITY (Already handled in main script)
-- =====================================================

-- The feedback_quotas table policies were already created in the main deployment script
-- But let's ensure they exist and are correct

-- Enable RLS on feedback_quotas table (if not already enabled)
ALTER TABLE public.feedback_quotas ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view own quotas" ON public.feedback_quotas;
DROP POLICY IF EXISTS "Users can update own quotas" ON public.feedback_quotas;
DROP POLICY IF EXISTS "Users can insert own quotas" ON public.feedback_quotas;
DROP POLICY IF EXISTS "Admins can view all quotas" ON public.feedback_quotas;

-- Policy for users to see their own quotas
CREATE POLICY "Users can view own quotas" ON public.feedback_quotas
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to update their own quotas (through functions)
CREATE POLICY "Users can update own quotas" ON public.feedback_quotas
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for inserting quotas (through functions)
CREATE POLICY "Users can insert own quotas" ON public.feedback_quotas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for admins to see all quotas
CREATE POLICY "Admins can view all quotas" ON public.feedback_quotas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'professor')
        )
    );

-- =====================================================
-- 8. GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant basic permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.diseases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.comparative_chat_logs TO authenticated;
GRANT SELECT ON public.feedback_validations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feedback_quotas TO authenticated;

-- Grant sequence permissions for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- 9. VERIFICATION AND SUCCESS MESSAGE
-- =====================================================

-- Verify that all policies were created successfully
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    -- Count the number of policies created
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'teams', 'diseases', 'chat_logs', 'comparative_chat_logs', 'feedback_validations', 'feedback_quotas');
    
    IF policy_count >= 15 THEN
        RAISE NOTICE '✅ SECURITY POLICIES SUCCESSFULLY CREATED!';
        RAISE NOTICE 'Total policies created: %', policy_count;
        RAISE NOTICE '';
        RAISE NOTICE '🎉 THE LOADING SCREEN ISSUE SHOULD NOW BE FIXED!';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Refresh your browser at https://zoolio.netlify.app';
        RAISE NOTICE '2. Try logging in again';
        RAISE NOTICE '3. The app should now load properly without getting stuck';
        RAISE NOTICE '';
        RAISE NOTICE 'If you still have issues, check the browser console for any remaining errors.';
    ELSE
        RAISE WARNING 'Some policies may not have been created. Expected at least 15, got %', policy_count;
    END IF;
END $$;
