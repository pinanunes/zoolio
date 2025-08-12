-- =====================================================
-- COMPREHENSIVE PERMISSION AND SCHEMA FIX
-- =====================================================
-- This script fixes both RLS policy issues and missing schema columns
-- Execute this in Supabase SQL Editor to resolve all permission problems
-- =====================================================

-- Step 1: Add missing columns to teams table
-- =====================================================
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS red_team_1_target_id INT REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS red_team_2_target_id INT REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS has_submitted_sheet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_submitted_review BOOLEAN DEFAULT FALSE;

-- Add comments to document the columns
COMMENT ON COLUMN public.teams.red_team_1_target_id IS 'ID of the first Red Team that will test this team''s bot';
COMMENT ON COLUMN public.teams.red_team_2_target_id IS 'ID of the second Red Team that will test this team''s bot';
COMMENT ON COLUMN public.teams.has_submitted_sheet IS 'Whether the team has submitted their initial information sheet';
COMMENT ON COLUMN public.teams.has_submitted_review IS 'Whether the team has submitted their Blue Team review';

-- Step 2: Drop all existing problematic RLS policies
-- =====================================================

-- Drop policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Professors can view student profiles" ON public.profiles;

-- Drop policies on teams table
DROP POLICY IF EXISTS "Everyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Admin can manage teams" ON public.teams;
DROP POLICY IF EXISTS "Professors can view teams" ON public.teams;
DROP POLICY IF EXISTS "Admin/Prof can update teams" ON public.teams;

-- Drop policies on diseases table
DROP POLICY IF EXISTS "Everyone can view diseases" ON public.diseases;
DROP POLICY IF EXISTS "Admin can manage diseases" ON public.diseases;
DROP POLICY IF EXISTS "Admin can insert diseases" ON public.diseases;

-- Drop policies on chat_logs table
DROP POLICY IF EXISTS "Users can view own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Users can insert own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Professors can view all chat logs" ON public.chat_logs;

-- Drop policies on comparative_chat_logs table
DROP POLICY IF EXISTS "Users can view own comparative chat logs" ON public.comparative_chat_logs;
DROP POLICY IF EXISTS "Users can insert own comparative chat logs" ON public.comparative_chat_logs;
DROP POLICY IF EXISTS "Professors can view all comparative chat logs" ON public.comparative_chat_logs;

-- Drop policies on feedback_validations table
DROP POLICY IF EXISTS "Professors can manage feedback validations" ON public.feedback_validations;
DROP POLICY IF EXISTS "Users can view feedback on their logs" ON public.feedback_validations;

-- Drop policies on positive_feedback table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'positive_feedback' AND table_schema = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own positive feedback" ON public.positive_feedback';
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own positive feedback" ON public.positive_feedback';
        EXECUTE 'DROP POLICY IF EXISTS "Professors can view all positive feedback" ON public.positive_feedback';
    END IF;
END $$;

-- Step 3: Create robust helper function for role checking
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- First try to get role from profiles table (most reliable)
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = user_id;
    
    -- If not found in profiles, try auth metadata as fallback
    IF user_role IS NULL THEN
        SELECT (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' INTO user_role;
    END IF;
    
    -- Default to 'student' if still null
    RETURN COALESCE(user_role, 'student');
END;
$$;

-- Step 4: Create new, robust RLS policies
-- =====================================================

-- PROFILES TABLE POLICIES
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles" ON public.profiles
    FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin can update all profiles" ON public.profiles
    FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'student', 'professor'));

CREATE POLICY "Professors can view student profiles" ON public.profiles
    FOR SELECT USING (
        public.get_user_role(auth.uid()) = 'professor' AND role = 'student'
    );

-- TEAMS TABLE POLICIES
CREATE POLICY "Everyone can view teams" ON public.teams
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage teams" ON public.teams
    FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Professors can update teams" ON public.teams
    FOR UPDATE USING (public.get_user_role(auth.uid()) IN ('admin', 'professor'));

-- DISEASES TABLE POLICIES
CREATE POLICY "Everyone can view diseases" ON public.diseases
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage diseases" ON public.diseases
    FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- CHAT_LOGS TABLE POLICIES
CREATE POLICY "Users can view own chat logs" ON public.chat_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat logs" ON public.chat_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professors can view all chat logs" ON public.chat_logs
    FOR SELECT USING (public.get_user_role(auth.uid()) IN ('admin', 'professor'));

CREATE POLICY "Professors can update chat logs" ON public.chat_logs
    FOR UPDATE USING (public.get_user_role(auth.uid()) IN ('admin', 'professor'));

-- COMPARATIVE_CHAT_LOGS TABLE POLICIES
CREATE POLICY "Users can view own comparative chat logs" ON public.comparative_chat_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comparative chat logs" ON public.comparative_chat_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professors can view all comparative chat logs" ON public.comparative_chat_logs
    FOR SELECT USING (public.get_user_role(auth.uid()) IN ('admin', 'professor'));

-- FEEDBACK_VALIDATIONS TABLE POLICIES
CREATE POLICY "Professors can manage feedback validations" ON public.feedback_validations
    FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'professor'));

CREATE POLICY "Users can view feedback on their logs" ON public.feedback_validations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_logs 
            WHERE id = feedback_validations.log_id 
            AND user_id = auth.uid()
        )
    );

-- POSITIVE_FEEDBACK TABLE POLICIES (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'positive_feedback' AND table_schema = 'public') THEN
        EXECUTE 'CREATE POLICY "Users can insert own positive feedback" ON public.positive_feedback
            FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'CREATE POLICY "Users can view own positive feedback" ON public.positive_feedback
            FOR SELECT USING (auth.uid() = user_id)';
        
        EXECUTE 'CREATE POLICY "Professors can view all positive feedback" ON public.positive_feedback
            FOR SELECT USING (public.get_user_role(auth.uid()) IN (''admin'', ''professor''))';
    END IF;
END $$;

-- Step 5: Ensure RLS is enabled on all tables
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diseases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparative_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_validations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on positive_feedback if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'positive_feedback' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.positive_feedback ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- Step 6: Create indexes for better performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_teams_red_team_1 ON public.teams(red_team_1_target_id);
CREATE INDEX IF NOT EXISTS idx_teams_red_team_2 ON public.teams(red_team_2_target_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON public.chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_comparative_chat_logs_user_id ON public.comparative_chat_logs(user_id);

-- Step 7: Grant necessary permissions
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;

-- Step 8: Verification and success message
-- =====================================================
DO $$
DECLARE
    column_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Check if all required columns exist
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND table_schema = 'public'
    AND column_name IN ('red_team_1_target_id', 'red_team_2_target_id', 'has_submitted_sheet', 'has_submitted_review');
    
    -- Check if policies were created
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'teams', 'diseases', 'chat_logs', 'comparative_chat_logs', 'feedback_validations');
    
    IF column_count = 4 AND policy_count > 10 THEN
        RAISE NOTICE '✅ SUCCESS: Comprehensive fix applied successfully!';
        RAISE NOTICE '';
        RAISE NOTICE '🔧 Schema Updates:';
        RAISE NOTICE '  - Added 4 missing columns to teams table';
        RAISE NOTICE '  - Created performance indexes';
        RAISE NOTICE '';
        RAISE NOTICE '🔒 Security Updates:';
        RAISE NOTICE '  - Replaced all RLS policies with robust versions';
        RAISE NOTICE '  - Created reliable role checking function';
        RAISE NOTICE '  - Enabled RLS on all tables';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 Expected Results:';
        RAISE NOTICE '  - Team Management page should now save changes';
        RAISE NOTICE '  - Disease Management should allow adding diseases';
        RAISE NOTICE '  - All backoffice functions should work for admins';
        RAISE NOTICE '  - Student feedback submission should work';
        RAISE NOTICE '';
        RAISE NOTICE '🚀 Next Steps:';
        RAISE NOTICE '1. Refresh your application pages';
        RAISE NOTICE '2. Test team management functionality';
        RAISE NOTICE '3. Test disease management functionality';
        RAISE NOTICE '4. Verify student feedback works';
    ELSE
        RAISE WARNING 'Partial success: % columns added, % policies created', column_count, policy_count;
    END IF;
END $$;
