-- =====================================================
-- BACKOFFICE RLS AND FUNCTIONS FIX
-- =====================================================
-- This script fixes the backoffice issues by:
-- 1. Creating missing database functions
-- 2. Fixing RLS policies for complex joins
-- 3. Adding proper permissions for admin/professor access
-- =====================================================

-- =====================================================
-- 1. CREATE MISSING DATABASE FUNCTIONS
-- =====================================================

-- Function to get student analytics (for StudentAnalytics component)
-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_student_analytics();

CREATE OR REPLACE FUNCTION get_student_analytics()
RETURNS TABLE (
    student_id UUID,
    full_name TEXT,
    student_number TEXT,
    team_id INT,
    team_name TEXT,
    assigned_disease_id INT,
    assigned_disease_name TEXT,
    red_team_1_disease TEXT,
    red_team_2_disease TEXT,
    total_feedbacks BIGINT,
    approved_feedbacks BIGINT,
    total_points BIGINT,
    average_points_per_feedback NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as student_id,
        p.full_name,
        p.student_number,
        p.team_id,
        t.team_name,
        t.assigned_disease_id,
        d.name as assigned_disease_name,
        d1.name as red_team_1_disease,
        d2.name as red_team_2_disease,
        COALESCE(feedback_stats.total_feedbacks, 0) as total_feedbacks,
        COALESCE(feedback_stats.approved_feedbacks, 0) as approved_feedbacks,
        COALESCE(feedback_stats.total_points, 0) as total_points,
        CASE 
            WHEN COALESCE(feedback_stats.approved_feedbacks, 0) > 0 
            THEN ROUND(COALESCE(feedback_stats.total_points, 0)::NUMERIC / feedback_stats.approved_feedbacks, 2)
            ELSE 0
        END as average_points_per_feedback
    FROM public.profiles p
    LEFT JOIN public.teams t ON p.team_id = t.id
    LEFT JOIN public.diseases d ON t.assigned_disease_id = d.id
    LEFT JOIN public.teams rt1 ON t.red_team_1_target_id = rt1.id
    LEFT JOIN public.diseases d1 ON rt1.assigned_disease_id = d1.id
    LEFT JOIN public.teams rt2 ON t.red_team_2_target_id = rt2.id
    LEFT JOIN public.diseases d2 ON rt2.assigned_disease_id = d2.id
    LEFT JOIN (
        SELECT 
            cl.user_id,
            COUNT(*) as total_feedbacks,
            COUNT(fv.id) FILTER (WHERE fv.is_validated = true) as approved_feedbacks,
            COALESCE(SUM(fv.points_awarded) FILTER (WHERE fv.is_validated = true), 0) as total_points
        FROM public.chat_logs cl
        LEFT JOIN public.feedback_validations fv ON cl.id = fv.log_id
        WHERE cl.feedback IS NOT NULL
        GROUP BY cl.user_id
    ) feedback_stats ON p.id = feedback_stats.user_id
    WHERE p.role = 'student'
    ORDER BY p.full_name;
END;
$$;

-- Function to increment team points (for FeedbackValidation component)
CREATE OR REPLACE FUNCTION increment_team_points(team_id INT, points_to_add INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.teams 
    SET points = COALESCE(points, 0) + points_to_add
    WHERE id = team_id;
END;
$$;

-- =====================================================
-- 2. ENHANCED RLS POLICIES FOR COMPLEX JOINS
-- =====================================================

-- Drop and recreate policies for better join support

-- Enhanced profiles policies for admin/professor access
DROP POLICY IF EXISTS "Enhanced admin access to profiles" ON public.profiles;
CREATE POLICY "Enhanced admin access to profiles" ON public.profiles
    FOR ALL USING (
        -- Allow if user is admin/professor
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
        OR
        -- Allow users to access their own profile
        auth.uid() = id
    );

-- Enhanced teams policies for admin/professor access
DROP POLICY IF EXISTS "Enhanced admin access to teams" ON public.teams;
CREATE POLICY "Enhanced admin access to teams" ON public.teams
    FOR ALL USING (
        -- Allow if user is admin/professor
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
        OR
        -- Allow students to view teams (for leaderboard, etc.)
        EXISTS (
            SELECT 1 FROM public.profiles student_profile
            WHERE student_profile.id = auth.uid() 
            AND student_profile.role = 'student'
        )
    );

-- Enhanced chat_logs policies for admin/professor access
DROP POLICY IF EXISTS "Enhanced admin access to chat_logs" ON public.chat_logs;
CREATE POLICY "Enhanced admin access to chat_logs" ON public.chat_logs
    FOR ALL USING (
        -- Allow if user is admin/professor
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
        OR
        -- Allow users to access their own logs
        auth.uid() = user_id
    );

-- Enhanced feedback_validations policies
DROP POLICY IF EXISTS "Enhanced admin access to feedback_validations" ON public.feedback_validations;
CREATE POLICY "Enhanced admin access to feedback_validations" ON public.feedback_validations
    FOR ALL USING (
        -- Allow if user is admin/professor
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
        OR
        -- Allow students to view validations of their own logs
        EXISTS (
            SELECT 1 FROM public.chat_logs 
            WHERE id = feedback_validations.log_id 
            AND user_id = auth.uid()
        )
    );

-- =====================================================
-- 3. GRANT PERMISSIONS FOR FUNCTIONS
-- =====================================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_student_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_team_points(INT, INT) TO authenticated;

-- Grant permissions for RPC calls
GRANT USAGE ON SCHEMA public TO authenticated;

-- =====================================================
-- 4. ADD MISSING TEAM COLUMNS (if they don't exist)
-- =====================================================

-- Add Red Team columns if they don't exist
DO $$ 
BEGIN
    -- Add red_team_1_target_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' 
        AND column_name = 'red_team_1_target_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN red_team_1_target_id INT REFERENCES public.teams(id);
    END IF;

    -- Add red_team_2_target_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' 
        AND column_name = 'red_team_2_target_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN red_team_2_target_id INT REFERENCES public.teams(id);
    END IF;

    -- Add has_submitted_sheet column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' 
        AND column_name = 'has_submitted_sheet'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN has_submitted_sheet BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add has_submitted_review column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' 
        AND column_name = 'has_submitted_review'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN has_submitted_review BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- =====================================================
-- 5. CREATE TEAMS IF THEY DON'T EXIST (1-30)
-- =====================================================

-- Insert teams 1-30 if they don't exist
DO $$
BEGIN
    FOR i IN 1..30 LOOP
        INSERT INTO public.teams (team_name, points)
        VALUES ('Grupo ' || i, 0)
        ON CONFLICT (team_name) DO NOTHING;
    END LOOP;
END $$;

-- =====================================================
-- 6. VERIFICATION AND SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
    function_count INTEGER;
    policy_count INTEGER;
    team_count INTEGER;
BEGIN
    -- Count functions
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname IN ('get_student_analytics', 'increment_team_points');
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND policyname LIKE 'Enhanced%';
    
    -- Count teams
    SELECT COUNT(*) INTO team_count
    FROM public.teams;
    
    IF function_count >= 2 AND policy_count >= 4 AND team_count >= 30 THEN
        RAISE NOTICE '✅ BACKOFFICE FIXES SUCCESSFULLY APPLIED!';
        RAISE NOTICE '';
        RAISE NOTICE '📊 Functions created: %', function_count;
        RAISE NOTICE '🔒 Enhanced policies: %', policy_count;
        RAISE NOTICE '👥 Teams available: %', team_count;
        RAISE NOTICE '';
        RAISE NOTICE '🎉 THE BACKOFFICE SHOULD NOW WORK PROPERLY!';
        RAISE NOTICE '';
        RAISE NOTICE 'Fixed issues:';
        RAISE NOTICE '✅ Student Analytics: get_student_analytics() function created';
        RAISE NOTICE '✅ Team Management: Enhanced RLS policies for complex joins';
        RAISE NOTICE '✅ Feedback Validation: Fixed statistics calculation';
        RAISE NOTICE '✅ All 30 teams created and available';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Refresh the backoffice pages';
        RAISE NOTICE '2. Test student analytics dashboard';
        RAISE NOTICE '3. Test team management assignments';
        RAISE NOTICE '4. Test feedback validation';
    ELSE
        RAISE WARNING 'Some components may not have been created properly.';
        RAISE WARNING 'Functions: % (expected 2)', function_count;
        RAISE WARNING 'Policies: % (expected 4+)', policy_count;
        RAISE WARNING 'Teams: % (expected 30)', team_count;
    END IF;
END $$;
