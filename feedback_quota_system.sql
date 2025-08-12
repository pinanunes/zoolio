-- Feedback Quota System Implementation
-- This script adds the necessary columns and logic for managing feedback quotas per student

-- 1. Add personal points and feedback quotas to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS personal_points INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS feedback_junior_quota INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS feedback_senior_quota INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS feedback_arena_quota INT DEFAULT 5;

-- 2. Add source_bot column to chat_logs to track which bot the feedback is for
ALTER TABLE public.chat_logs 
ADD COLUMN IF NOT EXISTS source_bot TEXT DEFAULT 'bot_junior',
ADD COLUMN IF NOT EXISTS points_eligible BOOLEAN DEFAULT TRUE;

-- 3. Add source_bot column to comparative_chat_logs for arena feedback tracking
ALTER TABLE public.comparative_chat_logs 
ADD COLUMN IF NOT EXISTS points_eligible BOOLEAN DEFAULT TRUE;

-- 4. Create an index for better performance on feedback queries
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_source_bot ON public.chat_logs(user_id, source_bot);
CREATE INDEX IF NOT EXISTS idx_chat_logs_points_eligible ON public.chat_logs(points_eligible);

-- 5. Create a function to check and update feedback quotas
CREATE OR REPLACE FUNCTION check_and_update_feedback_quota(
    p_user_id UUID,
    p_source_bot TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    current_quota INT;
    quota_column TEXT;
BEGIN
    -- Determine which quota column to check based on source_bot
    CASE p_source_bot
        WHEN 'bot_junior' THEN quota_column := 'feedback_junior_quota';
        WHEN 'bot_senior' THEN quota_column := 'feedback_senior_quota';
        WHEN 'bot_arena' THEN quota_column := 'feedback_arena_quota';
        ELSE RETURN FALSE; -- Invalid bot type
    END CASE;
    
    -- Get current quota using dynamic SQL
    EXECUTE format('SELECT %I FROM public.profiles WHERE id = $1', quota_column)
    INTO current_quota
    USING p_user_id;
    
    -- Check if quota is available
    IF current_quota > 0 THEN
        -- Decrement quota
        EXECUTE format('UPDATE public.profiles SET %I = %I - 1 WHERE id = $1', quota_column, quota_column)
        USING p_user_id;
        
        RETURN TRUE; -- Points eligible
    ELSE
        RETURN FALSE; -- No quota remaining, not points eligible
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a function to reset feedback quotas (for admin use)
CREATE OR REPLACE FUNCTION reset_feedback_quotas(
    p_junior_quota INT DEFAULT 5,
    p_senior_quota INT DEFAULT 5,
    p_arena_quota INT DEFAULT 5
) RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        feedback_junior_quota = p_junior_quota,
        feedback_senior_quota = p_senior_quota,
        feedback_arena_quota = p_arena_quota;
END;
$$ LANGUAGE plpgsql;

-- 7. Create a view for easy quota monitoring
CREATE OR REPLACE VIEW feedback_quota_status AS
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.team_id,
    p.personal_points,
    p.feedback_junior_quota,
    p.feedback_senior_quota,
    p.feedback_arena_quota,
    (
        SELECT COUNT(*) 
        FROM public.chat_logs cl 
        WHERE cl.user_id = p.id 
        AND cl.source_bot = 'bot_junior' 
        AND cl.points_eligible = TRUE
    ) as junior_feedbacks_given,
    (
        SELECT COUNT(*) 
        FROM public.chat_logs cl 
        WHERE cl.user_id = p.id 
        AND cl.source_bot = 'bot_senior' 
        AND cl.points_eligible = TRUE
    ) as senior_feedbacks_given,
    (
        SELECT COUNT(*) 
        FROM public.comparative_chat_logs ccl 
        WHERE ccl.user_id = p.id 
        AND ccl.points_eligible = TRUE
    ) as arena_feedbacks_given
FROM public.profiles p
WHERE p.role = 'student';

-- 8. Add comments for documentation
COMMENT ON COLUMN public.profiles.personal_points IS 'Individual student points separate from team points';
COMMENT ON COLUMN public.profiles.feedback_junior_quota IS 'Remaining point-eligible feedbacks for Bot Junior (default: 5)';
COMMENT ON COLUMN public.profiles.feedback_senior_quota IS 'Remaining point-eligible feedbacks for Bot Senior (default: 5)';
COMMENT ON COLUMN public.profiles.feedback_arena_quota IS 'Remaining point-eligible feedbacks for Bot Arena (default: 5)';
COMMENT ON COLUMN public.chat_logs.source_bot IS 'Which bot this feedback is for (bot_junior, bot_senior, etc.)';
COMMENT ON COLUMN public.chat_logs.points_eligible IS 'Whether this feedback counts towards points (based on quota)';
COMMENT ON FUNCTION check_and_update_feedback_quota IS 'Checks if user has quota remaining and decrements it if available';
COMMENT ON VIEW feedback_quota_status IS 'Comprehensive view of student feedback quotas and usage';
