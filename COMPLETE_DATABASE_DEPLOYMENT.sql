-- =====================================================
-- ZOOLIO DATABASE COMPLETE DEPLOYMENT SCRIPT
-- =====================================================
-- This script contains all necessary database updates for the Zoolio application
-- Execute this in the Supabase SQL Editor to complete the database setup
-- 
-- Order of execution:
-- 1. Team Management Updates
-- 2. Yearly Feedback Quota System
-- 3. Positive Feedback Structure Updates
-- 4. Foreign Key Fixes (if needed)
-- =====================================================

-- =====================================================
-- 1. TEAM MANAGEMENT UPDATES
-- =====================================================

-- Add new columns to the teams table for Red Teams and submission tracking
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS red_team_1_target_id INT REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS red_team_2_target_id INT REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS has_submitted_sheet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_submitted_review BOOLEAN DEFAULT FALSE;

-- Add comments to document the new columns
COMMENT ON COLUMN public.teams.red_team_1_target_id IS 'ID of the first Red Team that will test this team''s bot';
COMMENT ON COLUMN public.teams.red_team_2_target_id IS 'ID of the second Red Team that will test this team''s bot';
COMMENT ON COLUMN public.teams.has_submitted_sheet IS 'Whether the team has submitted their initial information sheet';
COMMENT ON COLUMN public.teams.has_submitted_review IS 'Whether the team has submitted their Blue Team review';

-- Create indexes for better performance on the new foreign key columns
CREATE INDEX IF NOT EXISTS idx_teams_red_team_1 ON public.teams(red_team_1_target_id);
CREATE INDEX IF NOT EXISTS idx_teams_red_team_2 ON public.teams(red_team_2_target_id);

-- Update existing teams to have default values
UPDATE public.teams 
SET has_submitted_sheet = FALSE, has_submitted_review = FALSE 
WHERE has_submitted_sheet IS NULL OR has_submitted_review IS NULL;

-- =====================================================
-- 2. YEARLY FEEDBACK QUOTA SYSTEM
-- =====================================================

-- Create feedback_quotas table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.feedback_quotas (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bot_id TEXT NOT NULL,
    feedback_count INTEGER DEFAULT 0,
    academic_year TEXT DEFAULT '2024-2025',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, bot_id, academic_year)
);

-- Drop existing functions and recreate with correct logic
DROP FUNCTION IF EXISTS check_and_update_feedback_quota(UUID, TEXT);
DROP FUNCTION IF EXISTS get_user_feedback_quotas(UUID);
DROP FUNCTION IF EXISTS reset_daily_quotas();

-- Update the feedback_quotas table structure to remove daily reset logic
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
                ELSE 5
            END as max_quota
        FROM (
            SELECT 'bot_junior' as bot_id
            UNION ALL
            SELECT 'bot_senior' as bot_id
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

-- =====================================================
-- 3. POSITIVE FEEDBACK STRUCTURE UPDATES
-- =====================================================

-- Add column for positive feedback details
ALTER TABLE chat_logs 
ADD COLUMN IF NOT EXISTS positive_feedback_details JSONB;

-- Create index for better performance on positive feedback queries
CREATE INDEX IF NOT EXISTS idx_chat_logs_positive_feedback 
ON chat_logs USING GIN (positive_feedback_details) 
WHERE positive_feedback_details IS NOT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN chat_logs.positive_feedback_details IS 
'Stores structured positive feedback data including selected options and comments';

-- Grant necessary permissions
GRANT SELECT, UPDATE ON chat_logs TO authenticated;

-- Create a view for easier analysis of positive feedback
CREATE OR REPLACE VIEW positive_feedback_analysis AS
SELECT 
    cl.id,
    cl.created_at,
    cl.user_id,
    cl.team_id,
    cl.bot_id,
    cl.question,
    cl.answer,
    cl.positive_feedback_details,
    -- Extract individual options for easier querying
    (cl.positive_feedback_details->>'options')::jsonb->'informacaoCorreta' as informacao_correta,
    (cl.positive_feedback_details->>'options')::jsonb->'informacaoCompleta' as informacao_completa,
    (cl.positive_feedback_details->>'options')::jsonb->'aprendiAlgo' as aprendi_algo,
    cl.positive_feedback_details->>'comment' as feedback_comment,
    p.full_name as user_name,
    t.team_name
FROM chat_logs cl
LEFT JOIN profiles p ON cl.user_id = p.id
LEFT JOIN teams t ON cl.team_id = t.id
WHERE cl.feedback = 1 
  AND cl.positive_feedback_details IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON positive_feedback_analysis TO authenticated;

-- Function to get positive feedback statistics
CREATE OR REPLACE FUNCTION get_positive_feedback_stats(
    p_bot_id TEXT DEFAULT NULL,
    p_team_id INT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH feedback_stats AS (
        SELECT 
            COUNT(*) as total_positive_feedback,
            COUNT(CASE WHEN (positive_feedback_details->>'options')::jsonb->'informacaoCorreta' = 'true' THEN 1 END) as informacao_correta_count,
            COUNT(CASE WHEN (positive_feedback_details->>'options')::jsonb->'informacaoCompleta' = 'true' THEN 1 END) as informacao_completa_count,
            COUNT(CASE WHEN (positive_feedback_details->>'options')::jsonb->'aprendiAlgo' = 'true' THEN 1 END) as aprendi_algo_count,
            COUNT(CASE WHEN positive_feedback_details->>'comment' IS NOT NULL AND positive_feedback_details->>'comment' != '' THEN 1 END) as with_comments_count
        FROM chat_logs
        WHERE feedback = 1 
          AND positive_feedback_details IS NOT NULL
          AND (p_bot_id IS NULL OR bot_id = p_bot_id)
          AND (p_team_id IS NULL OR team_id = p_team_id)
          AND (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
    )
    SELECT jsonb_build_object(
        'total_positive_feedback', total_positive_feedback,
        'informacao_correta_count', informacao_correta_count,
        'informacao_completa_count', informacao_completa_count,
        'aprendi_algo_count', aprendi_algo_count,
        'with_comments_count', with_comments_count,
        'informacao_correta_percentage', 
            CASE WHEN total_positive_feedback > 0 
                 THEN ROUND((informacao_correta_count::DECIMAL / total_positive_feedback) * 100, 2)
                 ELSE 0 
            END,
        'informacao_completa_percentage', 
            CASE WHEN total_positive_feedback > 0 
                 THEN ROUND((informacao_completa_count::DECIMAL / total_positive_feedback) * 100, 2)
                 ELSE 0 
            END,
        'aprendi_algo_percentage', 
            CASE WHEN total_positive_feedback > 0 
                 THEN ROUND((aprendi_algo_count::DECIMAL / total_positive_feedback) * 100, 2)
                 ELSE 0 
            END
    ) INTO result
    FROM feedback_stats;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_positive_feedback_stats(TEXT, INT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- =====================================================
-- 4. INITIALIZE DATA FOR EXISTING USERS
-- =====================================================

-- Insert initial quota records for existing users
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
    ) bot_ids
    WHERE p.role = 'student'
    ON CONFLICT (user_id, bot_id, academic_year) DO NOTHING;
END $$;

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on feedback_quotas table
ALTER TABLE feedback_quotas ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own quotas
CREATE POLICY "Users can view own quotas" ON feedback_quotas
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to update their own quotas (through functions)
CREATE POLICY "Users can update own quotas" ON feedback_quotas
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for inserting quotas (through functions)
CREATE POLICY "Users can insert own quotas" ON feedback_quotas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for admins to see all quotas
CREATE POLICY "Admins can view all quotas" ON feedback_quotas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'professor')
        )
    );

-- =====================================================
-- DEPLOYMENT COMPLETE
-- =====================================================

-- Verify deployment by checking if key functions exist
DO $$
BEGIN
    -- Check if functions were created successfully
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_feedback_quotas') THEN
        RAISE EXCEPTION 'Function get_user_feedback_quotas was not created successfully';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_and_update_feedback_quota') THEN
        RAISE EXCEPTION 'Function check_and_update_feedback_quota was not created successfully';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_positive_feedback_stats') THEN
        RAISE EXCEPTION 'Function get_positive_feedback_stats was not created successfully';
    END IF;
    
    -- Check if tables have required columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'has_submitted_sheet') THEN
        RAISE EXCEPTION 'Column has_submitted_sheet was not added to teams table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_logs' AND column_name = 'positive_feedback_details') THEN
        RAISE EXCEPTION 'Column positive_feedback_details was not added to chat_logs table';
    END IF;
    
    RAISE NOTICE 'Database deployment completed successfully!';
    RAISE NOTICE 'All functions, tables, and policies have been created.';
    RAISE NOTICE 'The Zoolio application is now ready to use.';
END $$;
