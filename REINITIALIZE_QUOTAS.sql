-- =====================================================
-- REINITIALIZE FEEDBACK QUOTAS SCRIPT
-- =====================================================
-- This script repopulates the user_feedback_quotas table
-- for all existing students after the new year reset
-- =====================================================

-- WARNING: This script should be run AFTER the NEW_YEAR_RESET.sql
-- It assumes the user_feedback_quotas table has been truncated

-- =====================================================
-- STEP 1: REINITIALIZE QUOTAS FOR ALL STUDENTS
-- =====================================================

-- Insert fresh quota records for all students
-- Each student gets quotas for all three bot types
INSERT INTO public.user_feedback_quotas (
    user_id,
    bot_id,
    quota_year,
    created_at
)
SELECT 
    p.id as user_id,
    bot_ids.bot_id,
    EXTRACT(YEAR FROM NOW()) as quota_year,
    NOW() as created_at
FROM 
    public.profiles p
CROSS JOIN (
    VALUES 
        ('bot_junior'),
        ('bot_senior'),
        ('bot_arena')
) AS bot_ids(bot_id)
WHERE 
    p.role = 'student'
    AND p.is_approved = TRUE;

-- =====================================================
-- VERIFICATION QUERY (for manual checking after reset)
-- =====================================================

-- Uncomment this to verify the quotas were created correctly:
-- SELECT 
--     COUNT(*) as total_quota_records,
--     COUNT(DISTINCT user_id) as students_with_quotas,
--     bot_type,
--     SUM(quota_used) as total_usage
-- FROM public.user_feedback_quotas 
-- GROUP BY bot_type
-- ORDER BY bot_type;

-- Expected results:
-- - total_quota_records should be (number of students × 3)
-- - students_with_quotas should equal number of approved students
-- - total_usage should be 0 for all bot types

-- =====================================================
-- QUOTA REINITIALIZATION COMPLETED
-- =====================================================
-- All existing students now have fresh feedback quotas:
-- ✅ bot_junior: Fresh quota with 0 usage
-- ✅ bot_senior: Fresh quota with 0 usage  
-- ✅ bot_arena: Fresh quota with 0 usage
-- ✅ last_reset_at: Set to current timestamp
-- 
-- Students can now provide feedback without quota errors
-- =====================================================
