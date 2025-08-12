-- Add structured positive feedback support to chat_logs table
-- This update adds a column to store detailed positive feedback information

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

-- Example of the JSON structure that will be stored:
-- {
--   "options": {
--     "informacaoCorreta": true,
--     "informacaoCompleta": false,
--     "aprendiAlgo": true
--   },
--   "comment": "A resposta foi muito clara e ajudou-me a entender o conceito."
-- }

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
