-- =====================================================
-- NEW YEAR RESET SCRIPT
-- =====================================================
-- This script performs a complete "new year" reset of the Zoolio database
-- KEEPS: Users, profiles (basic info), diseases, team structure
-- DELETES: All activity data (chats, feedback, quotas, validations)
-- RESETS: Team assignments, points, progress flags
-- =====================================================

-- WARNING: THIS IS A DESTRUCTIVE OPERATION
-- All activity data will be permanently deleted
-- Make sure you have a backup if needed

-- =====================================================
-- STEP 1: DELETE ALL ACTIVITY DATA
-- =====================================================

-- Delete all chat logs (main bot conversations)
TRUNCATE TABLE public.chat_logs RESTART IDENTITY CASCADE;

-- Delete all comparative chat logs (bot arena votes)
TRUNCATE TABLE public.comparative_chat_logs RESTART IDENTITY CASCADE;

-- Delete all feedback validations (professor comments)
TRUNCATE TABLE public.feedback_validations RESTART IDENTITY CASCADE;

-- Delete all user feedback quotas (reset quota tracking)
TRUNCATE TABLE public.user_feedback_quotas RESTART IDENTITY CASCADE;

-- =====================================================
-- STEP 2: RESET ALL TEAMS TO DEFAULT STATE
-- =====================================================

-- Reset all team data to starting state
UPDATE public.teams SET
    assigned_disease_id = NULL,
    supervisor_id = NULL,
    blue_team_review_target_id = NULL,
    points = 0,
    ficha_entregue = FALSE,
    revisao_entregue = FALSE;

-- =====================================================
-- STEP 3: RESET ALL USER PROFILES
-- =====================================================

-- Remove all students from teams and reset personal points
UPDATE public.profiles SET
    team_id = NULL,
    personal_points = 0;

-- Note: We keep the following unchanged:
-- - id, full_name, email, role, student_number, is_approved
-- - This preserves user accounts and basic profile information

-- =====================================================
-- VERIFICATION QUERIES (for manual checking after reset)
-- =====================================================

-- Uncomment these to verify the reset worked:
-- SELECT COUNT(*) as chat_logs_count FROM public.chat_logs;
-- SELECT COUNT(*) as comparative_logs_count FROM public.comparative_chat_logs;
-- SELECT COUNT(*) as feedback_validations_count FROM public.feedback_validations;
-- SELECT COUNT(*) as feedback_quotas_count FROM public.user_feedback_quotas;
-- SELECT COUNT(*) as teams_with_assignments FROM public.teams WHERE assigned_disease_id IS NOT NULL;
-- SELECT COUNT(*) as students_in_teams FROM public.profiles WHERE team_id IS NOT NULL;
-- SELECT SUM(points) as total_team_points FROM public.teams;
-- SELECT SUM(personal_points) as total_personal_points FROM public.profiles;

-- =====================================================
-- RESET COMPLETED
-- =====================================================
-- The database is now in a "new year" state:
-- ✅ All users and their basic profiles are preserved
-- ✅ All 30 teams exist but are unassigned and reset
-- ✅ All diseases are preserved for future assignment
-- ✅ All activity data has been cleared
-- ✅ All points and progress flags are reset to zero/false
-- ✅ Students are not assigned to any teams
-- 
-- Ready for a new academic year!
-- =====================================================
