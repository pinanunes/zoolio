-- Adds get_feedback_validation_logs: server-side filtered + paginated query backing
-- FeedbackValidation.jsx's "Bot Junior & Senior" tab.
--
-- Replaces the previous approach (fetch the 100 most recent chat_logs, then filter by
-- validation status client-side), which silently hid pending items older than the 100 most
-- recent feedback entries. "Pending" here means "no feedback_validations row exists with
-- is_validated = true", matching the app's existing insert path (a validation row is only ever
-- created at the moment of validation, always with is_validated: true).

CREATE OR REPLACE FUNCTION get_feedback_validation_logs(
  p_team_id INT DEFAULT NULL,
  p_disease TEXT DEFAULT NULL,
  p_validation_status TEXT DEFAULT 'all', -- 'all' | 'pending' | 'validated'
  p_keyword TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  team_id INT,
  question TEXT,
  answer TEXT,
  feedback SMALLINT,
  bot_id TEXT,
  disease_classification TEXT,
  positive_feedback_details JSONB,
  negative_feedback_details JSONB,
  error_details JSONB,
  student_name TEXT,
  team_name TEXT,
  validation_id BIGINT,
  validation_comment TEXT,
  validation_points_awarded INT,
  validation_is_validated BOOLEAN,
  validation_professor_id UUID,
  validation_professor_name TEXT,
  validation_created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS MATERIALIZED (
    SELECT
      cl.id, cl.created_at, cl.user_id, cl.team_id, cl.question, cl.answer,
      cl.feedback, cl.bot_id, cl.disease_classification,
      cl.positive_feedback_details, cl.negative_feedback_details, cl.error_details,
      p.full_name AS student_name,
      t.team_name,
      fv.id AS validation_id,
      fv.comment AS validation_comment,
      fv.points_awarded AS validation_points_awarded,
      fv.is_validated AS validation_is_validated,
      fv.professor_id AS validation_professor_id,
      prof.full_name AS validation_professor_name,
      fv.validation_date AS validation_created_at
    FROM chat_logs cl
    LEFT JOIN profiles p ON p.id = cl.user_id
    LEFT JOIN teams t ON t.id = cl.team_id
    LEFT JOIN feedback_validations fv ON fv.log_id = cl.id AND fv.is_archived = false
    LEFT JOIN profiles prof ON prof.id = fv.professor_id
    WHERE cl.feedback IS NOT NULL
      AND cl.is_archived = false
      AND (p_team_id IS NULL OR cl.team_id = p_team_id)
      AND (p_disease IS NULL OR p_disease = '' OR cl.disease_classification = p_disease)
      AND (
        p_validation_status = 'all'
        OR (p_validation_status = 'validated' AND fv.is_validated = true)
        OR (p_validation_status = 'pending' AND COALESCE(fv.is_validated, false) = false)
      )
      AND (
        p_keyword IS NULL OR p_keyword = ''
        OR cl.question ILIKE '%' || p_keyword || '%'
        OR cl.answer ILIKE '%' || p_keyword || '%'
      )
  )
  SELECT filtered.*, (SELECT count(*) FROM filtered) AS total_count
  FROM filtered
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION get_feedback_validation_logs(INT, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
