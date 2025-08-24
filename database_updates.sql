-- Enhanced Feedback System Database Updates
-- Run this SQL script in your Supabase SQL editor to add the new feedback columns

-- Add new columns to feedback_validations table to support detailed negative feedback
ALTER TABLE public.feedback_validations 
ADD COLUMN IF NOT EXISTS feedback_type TEXT CHECK (feedback_type IN ('positive', 'negative')),
ADD COLUMN IF NOT EXISTS negative_reason TEXT CHECK (negative_reason IN ('Resposta errada', 'Resposta incompleta', 'Resposta desatualizada')),
ADD COLUMN IF NOT EXISTS student_justification TEXT,
ADD COLUMN IF NOT EXISTS validation_date TIMESTAMPTZ DEFAULT NOW();

-- Update column comments for clarity
COMMENT ON COLUMN public.feedback_validations.comment IS 'Professor comment on student feedback';
COMMENT ON COLUMN public.feedback_validations.student_justification IS 'Student written justification for negative feedback';
COMMENT ON COLUMN public.feedback_validations.negative_reason IS 'Reason selected by student for negative feedback';
COMMENT ON COLUMN public.feedback_validations.feedback_type IS 'Type of feedback: positive or negative';

-- Create an index for better performance when querying unvalidated feedback
CREATE INDEX IF NOT EXISTS idx_feedback_validations_unvalidated 
ON public.feedback_validations(is_validated) 
WHERE is_validated IS NULL;

-- Create an index for feedback type queries
CREATE INDEX IF NOT EXISTS idx_feedback_validations_type 
ON public.feedback_validations(feedback_type);

-- Create a function to automatically update team points when professor awards points
CREATE OR REPLACE FUNCTION update_team_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if points_awarded has changed and we have a log_id
    IF NEW.points_awarded != OLD.points_awarded AND NEW.log_id IS NOT NULL THEN
        -- Get the team_id from the chat_logs table
        UPDATE public.teams 
        SET points = points + (NEW.points_awarded - OLD.points_awarded)
        WHERE id = (
            SELECT team_id 
            FROM public.chat_logs 
            WHERE id = NEW.log_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update team points
DROP TRIGGER IF EXISTS trigger_update_team_points ON public.feedback_validations;
CREATE TRIGGER trigger_update_team_points
    AFTER UPDATE ON public.feedback_validations
    FOR EACH ROW
    EXECUTE FUNCTION update_team_points();

-- Create a view for easier querying of feedback with related data
CREATE OR REPLACE VIEW feedback_with_details AS
SELECT 
    fv.id as feedback_id,
    fv.feedback_type,
    fv.negative_reason,
    fv.student_justification,
    fv.comment as professor_comment,
    fv.is_validated,
    fv.points_awarded,
    fv.validation_date as feedback_created_at,
    cl.question,
    cl.answer,
    cl.feedback as chat_feedback,
    cl.created_at as chat_created_at,
    p.full_name as student_name,
    p.email as student_email,
    t.team_name,
    prof.full_name as professor_name
FROM public.feedback_validations fv
JOIN public.chat_logs cl ON fv.log_id = cl.id
JOIN public.profiles p ON cl.user_id = p.id
LEFT JOIN public.teams t ON p.team_id = t.id
LEFT JOIN public.profiles prof ON fv.professor_id = prof.id
ORDER BY fv.validation_date DESC;

-- Grant necessary permissions
GRANT SELECT ON feedback_with_details TO authenticated;
GRANT ALL ON public.feedback_validations TO authenticated;

-- Insert some sample diseases if the table is empty
INSERT INTO public.diseases (name) 
SELECT * FROM (VALUES 
    ('Parvovirose Canina'),
    ('Cinomose'),
    ('Leishmaniose'),
    ('Babesiose'),
    ('Ehrlichiose'),
    ('Doença de Lyme'),
    ('Hepatite Infecciosa Canina'),
    ('Traqueobronquite Infecciosa'),
    ('Leptospirose'),
    ('Raiva')
) AS diseases(name)
WHERE NOT EXISTS (SELECT 1 FROM public.diseases LIMIT 1);

-- Create teams 1-30 if they don't exist
INSERT INTO public.teams (team_name)
SELECT 'Grupo ' || generate_series(1, 30)
WHERE NOT EXISTS (SELECT 1 FROM public.teams LIMIT 1);

COMMIT;
