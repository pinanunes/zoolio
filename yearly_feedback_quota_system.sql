-- Yearly Feedback Quota System (Corrected)
-- This replaces the daily quota system with a yearly total quota system

-- Drop existing functions and recreate with correct logic
DROP FUNCTION IF EXISTS check_and_update_feedback_quota(UUID, TEXT);
DROP FUNCTION IF EXISTS get_user_feedback_quotas(UUID);
DROP FUNCTION IF EXISTS reset_daily_quotas();

-- Update the feedback_quotas table structure to remove daily reset logic
-- We'll keep the same table but change the logic to be yearly totals
ALTER TABLE feedback_quotas 
DROP COLUMN IF EXISTS last_reset_date;

-- Add a column to track the academic year if not exists
ALTER TABLE feedback_quotas 
ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2024-2025';

-- Function to get user feedback quotas (yearly totals)
CREATE OR REPLACE FUNCTION get_user_feedback_quotas(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    quota_data JSONB;
    current_academic_year TEXT := '2024-2025'; -- This should be configurable
BEGIN
    -- Get current quotas for the academic year
    WITH quota_summary AS (
        SELECT 
            bot_id,
            COALESCE(feedback_count, 0) as used,
            CASE 
                WHEN bot_id = 'bot_junior' THEN 5
                WHEN bot_id = 'bot_senior' THEN 5
                WHEN bot_id = 'bot_arena' THEN 5
                ELSE 5
            END as max_quota
        FROM (
            SELECT 'bot_junior' as bot_id
            UNION ALL
            SELECT 'bot_senior' as bot_id
            UNION ALL
            SELECT 'bot_arena' as bot_id
        ) bots
        LEFT JOIN feedback_quotas fq ON fq.user_id = p_user_id 
            AND fq.bot_id = bots.bot_id 
            AND fq.academic_year = current_academic_year
    )
    SELECT jsonb_object_agg(
        bot_id,
        jsonb_build_object(
            'used', used,
            'remaining', GREATEST(0, max_quota - used),
            'max', max_quota
        )
    ) INTO quota_data
    FROM quota_summary;
    
    RETURN COALESCE(quota_data, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to check and update feedback quota (yearly system)
CREATE OR REPLACE FUNCTION check_and_update_feedback_quota(
    p_user_id UUID,
    p_bot_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    current_count INTEGER := 0;
    max_quota INTEGER := 5;
    current_academic_year TEXT := '2024-2025'; -- This should be configurable
    result JSONB;
BEGIN
    -- Get current feedback count for this bot and academic year
    SELECT COALESCE(feedback_count, 0) 
    INTO current_count
    FROM feedback_quotas 
    WHERE user_id = p_user_id 
        AND bot_id = p_bot_id 
        AND academic_year = current_academic_year;
    
    -- Check if quota is exceeded
    IF current_count >= max_quota THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Quota de feedback esgotada para este bot. Limite: ' || max_quota || ' por ano letivo.',
            'current_count', current_count,
            'remaining', 0,
            'max_quota', max_quota
        );
    END IF;
    
    -- Update or insert quota record
    INSERT INTO feedback_quotas (user_id, bot_id, feedback_count, academic_year)
    VALUES (p_user_id, p_bot_id, 1, current_academic_year)
    ON CONFLICT (user_id, bot_id, academic_year) 
    DO UPDATE SET 
        feedback_count = feedback_quotas.feedback_count + 1,
        updated_at = NOW();
    
    -- Get updated count
    current_count := current_count + 1;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Feedback registado com sucesso.',
        'current_count', current_count,
        'remaining', max_quota - current_count,
        'max_quota', max_quota
    );
END;
$$ LANGUAGE plpgsql;

-- Function to reset quotas for new academic year (manual operation)
CREATE OR REPLACE FUNCTION reset_academic_year_quotas(new_academic_year TEXT)
RETURNS TEXT AS $$
BEGIN
    -- This function should be called manually when starting a new academic year
    -- It doesn't delete old records, just creates new ones for the new year
    
    INSERT INTO feedback_quotas (user_id, bot_id, feedback_count, academic_year)
    SELECT DISTINCT 
        p.id as user_id,
        bot_ids.bot_id,
        0 as feedback_count,
        new_academic_year
    FROM profiles p
    CROSS JOIN (
        SELECT 'bot_junior' as bot_id
        UNION ALL
        SELECT 'bot_senior' as bot_id
        UNION ALL
        SELECT 'bot_arena' as bot_id
    ) bot_ids
    WHERE p.role = 'student'
    ON CONFLICT (user_id, bot_id, academic_year) DO NOTHING;
    
    RETURN 'Academic year quotas reset for: ' || new_academic_year;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_feedback_quotas(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_update_feedback_quota(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_academic_year_quotas(TEXT) TO service_role;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_quotas_user_bot_year 
ON feedback_quotas(user_id, bot_id, academic_year);

-- Insert some test data to ensure the system works
-- This will create initial quota records for existing users
DO $$
DECLARE
    current_academic_year TEXT := '2024-2025';
BEGIN
    INSERT INTO feedback_quotas (user_id, bot_id, feedback_count, academic_year)
    SELECT DISTINCT 
        p.id as user_id,
        bot_ids.bot_id,
        0 as feedback_count,
        current_academic_year
    FROM profiles p
    CROSS JOIN (
        SELECT 'bot_junior' as bot_id
        UNION ALL
        SELECT 'bot_senior' as bot_id
        UNION ALL
        SELECT 'bot_arena' as bot_id
    ) bot_ids
    WHERE p.role = 'student'
    ON CONFLICT (user_id, bot_id, academic_year) DO NOTHING;
END $$;
