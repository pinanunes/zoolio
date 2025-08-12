-- =====================================================
-- FINAL RLS OVERHAUL - SIMPLIFIED VERSION
-- =====================================================
-- This script completely rebuilds the RLS security system to eliminate
-- infinite recursion and provide clean, maintainable permissions
-- Simplified version without complex verification block
-- =====================================================

-- =====================================================
-- 1. CREATE NON-RECURSIVE HELPER FUNCTIONS
-- =====================================================
-- These functions break the recursion loop by using direct auth.uid() checks
-- without referencing the tables they protect
-- NOTE: Functions are in public schema to avoid permission issues

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
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
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'professor'
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
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'student'
  );
$$;

-- Helper function to check if current user is admin or professor
CREATE OR REPLACE FUNCTION public.is_admin_or_professor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_admin() OR public.is_professor();
$$;

-- =====================================================
-- 2. DROP ALL EXISTING RLS POLICIES
-- =====================================================
-- Clean slate approach - remove all existing policies

-- Drop all policies on profiles
DROP POLICY IF EXISTS "Enhanced admin access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Students can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

-- Drop all policies on teams
DROP POLICY IF EXISTS "Enhanced admin access to teams" ON public.teams;
DROP POLICY IF EXISTS "Students can view teams for leaderboard" ON public.teams;
DROP POLICY IF EXISTS "Users can view teams" ON public.teams;
DROP POLICY IF EXISTS "Admin can manage teams" ON public.teams;

-- Drop all policies on chat_logs
DROP POLICY IF EXISTS "Enhanced admin access to chat_logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Students can insert their own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Students can view their own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Students can update their own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Users can view own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Users can insert own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Users can update own chat logs" ON public.chat_logs;

-- Drop all policies on feedback_validations
DROP POLICY IF EXISTS "Enhanced admin access to feedback_validations" ON public.feedback_validations;
DROP POLICY IF EXISTS "Admin can manage feedback validations" ON public.feedback_validations;
DROP POLICY IF EXISTS "Users can view own feedback validations" ON public.feedback_validations;

-- Drop all policies on comparative_chat_logs
DROP POLICY IF EXISTS "Students can insert their own comparative chat logs" ON public.comparative_chat_logs;
DROP POLICY IF EXISTS "Students can view their own comparative chat logs" ON public.comparative_chat_logs;
DROP POLICY IF EXISTS "Users can manage own comparative logs" ON public.comparative_chat_logs;

-- Drop all policies on diseases
DROP POLICY IF EXISTS "Students can view diseases" ON public.diseases;
DROP POLICY IF EXISTS "Users can view diseases" ON public.diseases;
DROP POLICY IF EXISTS "Admin can manage diseases" ON public.diseases;

-- =====================================================
-- 3. CREATE NEW NON-RECURSIVE RLS POLICIES
-- =====================================================

-- =====================================================
-- PROFILES TABLE POLICIES
-- =====================================================

-- Allow users to view their own profile + admin/professor can view all
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR public.is_admin_or_professor()
    );

-- Allow users to update their own profile + admin can update all
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id OR public.is_admin()
    )
    WITH CHECK (
        auth.uid() = id OR public.is_admin()
    );

-- Allow new user registration (insert)
CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id
    );

-- =====================================================
-- TEAMS TABLE POLICIES
-- =====================================================

-- Allow all authenticated users to view teams (needed for leaderboard)
-- Admin/professor can manage teams
CREATE POLICY "teams_select_policy" ON public.teams
    FOR SELECT USING (
        auth.uid() IS NOT NULL
    );

-- Only admin can insert teams
CREATE POLICY "teams_insert_policy" ON public.teams
    FOR INSERT WITH CHECK (
        public.is_admin()
    );

-- Only admin can update teams
CREATE POLICY "teams_update_policy" ON public.teams
    FOR UPDATE USING (
        public.is_admin()
    )
    WITH CHECK (
        public.is_admin()
    );

-- Only admin can delete teams
CREATE POLICY "teams_delete_policy" ON public.teams
    FOR DELETE USING (
        public.is_admin()
    );

-- =====================================================
-- CHAT_LOGS TABLE POLICIES
-- =====================================================

-- Users can view their own logs + admin/professor can view all
CREATE POLICY "chat_logs_select_policy" ON public.chat_logs
    FOR SELECT USING (
        auth.uid() = user_id OR public.is_admin_or_professor()
    );

-- Users can insert their own logs
CREATE POLICY "chat_logs_insert_policy" ON public.chat_logs
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- Users can update their own logs (for feedback) + admin/professor can update all
CREATE POLICY "chat_logs_update_policy" ON public.chat_logs
    FOR UPDATE USING (
        auth.uid() = user_id OR public.is_admin_or_professor()
    )
    WITH CHECK (
        auth.uid() = user_id OR public.is_admin_or_professor()
    );

-- Only admin can delete chat logs
CREATE POLICY "chat_logs_delete_policy" ON public.chat_logs
    FOR DELETE USING (
        public.is_admin()
    );

-- =====================================================
-- FEEDBACK_VALIDATIONS TABLE POLICIES
-- =====================================================

-- Admin/professor can view all + students can view validations of their own logs
CREATE POLICY "feedback_validations_select_policy" ON public.feedback_validations
    FOR SELECT USING (
        public.is_admin_or_professor() OR
        EXISTS (
            SELECT 1 FROM public.chat_logs 
            WHERE id = feedback_validations.log_id 
            AND user_id = auth.uid()
        )
    );

-- Only admin/professor can insert feedback validations
CREATE POLICY "feedback_validations_insert_policy" ON public.feedback_validations
    FOR INSERT WITH CHECK (
        public.is_admin_or_professor()
    );

-- Only admin/professor can update feedback validations
CREATE POLICY "feedback_validations_update_policy" ON public.feedback_validations
    FOR UPDATE USING (
        public.is_admin_or_professor()
    )
    WITH CHECK (
        public.is_admin_or_professor()
    );

-- Only admin can delete feedback validations
CREATE POLICY "feedback_validations_delete_policy" ON public.feedback_validations
    FOR DELETE USING (
        public.is_admin()
    );

-- =====================================================
-- COMPARATIVE_CHAT_LOGS TABLE POLICIES
-- =====================================================

-- Users can view their own comparative logs + admin/professor can view all
CREATE POLICY "comparative_chat_logs_select_policy" ON public.comparative_chat_logs
    FOR SELECT USING (
        auth.uid() = user_id OR public.is_admin_or_professor()
    );

-- Users can insert their own comparative logs
CREATE POLICY "comparative_chat_logs_insert_policy" ON public.comparative_chat_logs
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- Users can update their own comparative logs + admin/professor can update all
CREATE POLICY "comparative_chat_logs_update_policy" ON public.comparative_chat_logs
    FOR UPDATE USING (
        auth.uid() = user_id OR public.is_admin_or_professor()
    )
    WITH CHECK (
        auth.uid() = user_id OR public.is_admin_or_professor()
    );

-- Only admin can delete comparative chat logs
CREATE POLICY "comparative_chat_logs_delete_policy" ON public.comparative_chat_logs
    FOR DELETE USING (
        public.is_admin()
    );

-- =====================================================
-- DISEASES TABLE POLICIES
-- =====================================================

-- All authenticated users can view diseases
CREATE POLICY "diseases_select_policy" ON public.diseases
    FOR SELECT USING (
        auth.uid() IS NOT NULL
    );

-- Only admin can insert diseases
CREATE POLICY "diseases_insert_policy" ON public.diseases
    FOR INSERT WITH CHECK (
        public.is_admin()
    );

-- Only admin can update diseases
CREATE POLICY "diseases_update_policy" ON public.diseases
    FOR UPDATE USING (
        public.is_admin()
    )
    WITH CHECK (
        public.is_admin()
    );

-- Only admin can delete diseases
CREATE POLICY "diseases_delete_policy" ON public.diseases
    FOR DELETE USING (
        public.is_admin()
    );

-- =====================================================
-- 4. ENSURE RLS IS ENABLED ON ALL TABLES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparative_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diseases ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. GRANT PERMISSIONS FOR HELPER FUNCTIONS
-- =====================================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_professor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_professor() TO authenticated;

-- =====================================================
-- 6. CREATE MISSING DATABASE FUNCTIONS (FROM PREVIOUS FIXES)
-- =====================================================

-- Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS get_student_analytics();
DROP FUNCTION IF EXISTS increment_team_points(INT, INT);

-- Function to get student analytics (for StudentAnalytics component)
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

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_student_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_team_points(INT, INT) TO authenticated;

-- =====================================================
-- 7. CREATE TEAMS IF THEY DON'T EXIST (1-30)
-- =====================================================

-- Insert teams 1-30 if they don't exist
INSERT INTO public.teams (team_name, points)
SELECT 'Grupo ' || i, 0
FROM generate_series(1, 30) AS i
ON CONFLICT (team_name) DO NOTHING;

-- =====================================================
-- SCRIPT COMPLETED SUCCESSFULLY
-- =====================================================
-- If this script runs without errors, the infinite recursion
-- problem should be resolved. Test by accessing:
-- 1. Team Management (Gestão de Grupos) page
-- 2. Student feedback submission
-- 3. All backoffice functionality
-- =====================================================
