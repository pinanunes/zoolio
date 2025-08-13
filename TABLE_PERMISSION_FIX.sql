-- =====================================================
-- TABLE PERMISSION FIX
-- =====================================================
-- This script grants the necessary SELECT permissions to authenticated users
-- on the teams and diseases tables to resolve 400 errors when fetching team data
-- =====================================================

-- Grant SELECT permission on teams table to all authenticated users
-- This allows students to view team information including their own team
GRANT SELECT ON TABLE public.teams TO authenticated;

-- Grant SELECT permission on diseases table to all authenticated users  
-- This allows the teams query to include disease information via JOIN
GRANT SELECT ON TABLE public.diseases TO authenticated;

-- Grant SELECT permission on profiles table to ensure user profile queries work
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- Grant INSERT permission on profiles table for user registration
GRANT INSERT ON TABLE public.profiles TO authenticated;

-- Grant UPDATE permission on profiles table for profile updates
GRANT UPDATE ON TABLE public.profiles TO authenticated;

-- Grant SELECT permission on chat_logs table for users to view their own logs
GRANT SELECT ON TABLE public.chat_logs TO authenticated;

-- Grant INSERT permission on chat_logs table for users to create chat logs
GRANT INSERT ON TABLE public.chat_logs TO authenticated;

-- Grant UPDATE permission on chat_logs table for feedback updates
GRANT UPDATE ON TABLE public.chat_logs TO authenticated;

-- Grant SELECT permission on feedback_validations table for viewing validations
GRANT SELECT ON TABLE public.feedback_validations TO authenticated;

-- Grant INSERT permission on feedback_validations table for professors
GRANT INSERT ON TABLE public.feedback_validations TO authenticated;

-- Grant UPDATE permission on feedback_validations table for professors
GRANT UPDATE ON TABLE public.feedback_validations TO authenticated;

-- Grant SELECT permission on comparative_chat_logs table
GRANT SELECT ON TABLE public.comparative_chat_logs TO authenticated;

-- Grant INSERT permission on comparative_chat_logs table
GRANT INSERT ON TABLE public.comparative_chat_logs TO authenticated;

-- Grant UPDATE permission on comparative_chat_logs table
GRANT UPDATE ON TABLE public.comparative_chat_logs TO authenticated;

-- Grant SELECT permission on user_feedback_quotas table
GRANT SELECT ON TABLE public.user_feedback_quotas TO authenticated;

-- Grant INSERT permission on user_feedback_quotas table
GRANT INSERT ON TABLE public.user_feedback_quotas TO authenticated;

-- Grant UPDATE permission on user_feedback_quotas table
GRANT UPDATE ON TABLE public.user_feedback_quotas TO authenticated;

-- =====================================================
-- GRANT USAGE ON SEQUENCES
-- =====================================================
-- Grant usage on sequences so users can insert records with auto-incrementing IDs

GRANT USAGE ON SEQUENCE public.teams_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.diseases_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.chat_logs_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.feedback_validations_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.comparative_chat_logs_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.user_feedback_quotas_id_seq TO authenticated;

-- =====================================================
-- SCRIPT COMPLETED
-- =====================================================
-- This should resolve the 400 errors by ensuring authenticated users
-- have the necessary table-level permissions to complement the RLS policies
-- =====================================================
