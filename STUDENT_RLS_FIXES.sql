-- =====================================================
-- STUDENT RLS POLICIES FIX
-- =====================================================
-- This script fixes the 500 errors students get when submitting feedback
-- by correcting the Row Level Security (RLS) policies for student operations
-- =====================================================

-- =====================================================
-- 1. FIX CHAT_LOGS POLICIES FOR STUDENTS
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can insert their own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Students can view their own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Students can update their own chat logs" ON public.chat_logs;

-- Create clear, working policies for students
CREATE POLICY "Students can insert their own chat logs" ON public.chat_logs
    FOR INSERT 
    WITH CHECK (
        -- Allow students to insert logs where user_id matches their auth.uid()
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'student'
        ) 
        AND user_id = auth.uid()
    );

CREATE POLICY "Students can view their own chat logs" ON public.chat_logs
    FOR SELECT 
    USING (
        -- Allow students to view their own logs
        user_id = auth.uid()
        OR
        -- Allow admin/professor access (from previous fix)
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
    );

CREATE POLICY "Students can update their own chat logs" ON public.chat_logs
    FOR UPDATE 
    USING (
        -- Allow students to update their own logs (for feedback)
        user_id = auth.uid()
        OR
        -- Allow admin/professor access
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
    )
    WITH CHECK (
        -- Ensure they can only update their own logs
        user_id = auth.uid()
        OR
        -- Allow admin/professor updates
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
    );

-- =====================================================
-- 2. FIX PROFILES POLICIES FOR STUDENTS
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Students can update their own profile" ON public.profiles;

-- Create clear policies for student profile access
CREATE POLICY "Students can view their own profile" ON public.profiles
    FOR SELECT 
    USING (
        -- Allow users to view their own profile
        id = auth.uid()
        OR
        -- Allow admin/professor access (from previous fix)
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
    );

CREATE POLICY "Students can update their own profile" ON public.profiles
    FOR UPDATE 
    USING (
        -- Allow users to update their own profile
        id = auth.uid()
        OR
        -- Allow admin/professor access
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
    )
    WITH CHECK (
        -- Ensure they can only update their own profile
        id = auth.uid()
        OR
        -- Allow admin/professor updates
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
    );

-- =====================================================
-- 3. FIX TEAMS POLICIES FOR STUDENTS (LEADERBOARD)
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can view teams for leaderboard" ON public.teams;

-- Create policy for students to view teams (needed for leaderboard)
CREATE POLICY "Students can view teams for leaderboard" ON public.teams
    FOR SELECT 
    USING (
        -- Allow all authenticated users to view teams (for leaderboard)
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- =====================================================
-- 4. FIX COMPARATIVE_CHAT_LOGS POLICIES FOR STUDENTS
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can insert their own comparative chat logs" ON public.comparative_chat_logs;
DROP POLICY IF EXISTS "Students can view their own comparative chat logs" ON public.comparative_chat_logs;

-- Create policies for Bot Arena functionality
CREATE POLICY "Students can insert their own comparative chat logs" ON public.comparative_chat_logs
    FOR INSERT 
    WITH CHECK (
        -- Allow students to insert comparative logs
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'student'
        ) 
        AND user_id = auth.uid()
    );

CREATE POLICY "Students can view their own comparative chat logs" ON public.comparative_chat_logs
    FOR SELECT 
    USING (
        -- Allow students to view their own comparative logs
        user_id = auth.uid()
        OR
        -- Allow admin/professor access
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
    );

-- =====================================================
-- 5. FIX DISEASES POLICIES FOR STUDENTS
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can view diseases" ON public.diseases;

-- Create policy for students to view diseases (needed for UI)
CREATE POLICY "Students can view diseases" ON public.diseases
    FOR SELECT 
    USING (
        -- Allow all authenticated users to view diseases
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- =====================================================
-- 6. VERIFICATION AND SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
    chat_logs_policies INTEGER;
    profiles_policies INTEGER;
    teams_policies INTEGER;
    comparative_policies INTEGER;
    diseases_policies INTEGER;
BEGIN
    -- Count policies for each table
    SELECT COUNT(*) INTO chat_logs_policies
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'chat_logs'
    AND policyname LIKE 'Students can%';
    
    SELECT COUNT(*) INTO profiles_policies
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles'
    AND policyname LIKE 'Students can%';
    
    SELECT COUNT(*) INTO teams_policies
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'teams'
    AND policyname LIKE 'Students can%';
    
    SELECT COUNT(*) INTO comparative_policies
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'comparative_chat_logs'
    AND policyname LIKE 'Students can%';
    
    SELECT COUNT(*) INTO diseases_policies
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'diseases'
    AND policyname LIKE 'Students can%';
    
    IF chat_logs_policies >= 3 AND profiles_policies >= 2 AND teams_policies >= 1 
       AND comparative_policies >= 2 AND diseases_policies >= 1 THEN
        RAISE NOTICE '✅ STUDENT RLS POLICIES SUCCESSFULLY FIXED!';
        RAISE NOTICE '';
        RAISE NOTICE '📊 Student policies created:';
        RAISE NOTICE '  - Chat logs: % policies', chat_logs_policies;
        RAISE NOTICE '  - Profiles: % policies', profiles_policies;
        RAISE NOTICE '  - Teams: % policies', teams_policies;
        RAISE NOTICE '  - Comparative logs: % policies', comparative_policies;
        RAISE NOTICE '  - Diseases: % policies', diseases_policies;
        RAISE NOTICE '';
        RAISE NOTICE '🎉 STUDENTS SHOULD NOW BE ABLE TO SUBMIT FEEDBACK!';
        RAISE NOTICE '';
        RAISE NOTICE 'Fixed issues:';
        RAISE NOTICE '✅ Chat logs: Students can INSERT/SELECT/UPDATE their own logs';
        RAISE NOTICE '✅ Profiles: Students can SELECT/UPDATE their own profile';
        RAISE NOTICE '✅ Teams: Students can SELECT teams for leaderboard';
        RAISE NOTICE '✅ Comparative logs: Students can use Bot Arena';
        RAISE NOTICE '✅ Diseases: Students can view disease list';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Test student feedback submission';
        RAISE NOTICE '2. Test leaderboard loading';
        RAISE NOTICE '3. Test Bot Arena functionality';
        RAISE NOTICE '4. Verify no more 500 errors in console';
    ELSE
        RAISE WARNING 'Some student policies may not have been created properly.';
        RAISE WARNING 'Chat logs: % (expected 3+)', chat_logs_policies;
        RAISE WARNING 'Profiles: % (expected 2+)', profiles_policies;
        RAISE WARNING 'Teams: % (expected 1+)', teams_policies;
        RAISE WARNING 'Comparative: % (expected 2+)', comparative_policies;
        RAISE WARNING 'Diseases: % (expected 1+)', diseases_policies;
    END IF;
END $$;
