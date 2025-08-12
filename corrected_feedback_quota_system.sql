-- Corrected Feedback Quota System
-- 5 feedbacks per bot per curricular year (not daily)

-- Create the new feedback_quotas table
CREATE TABLE IF NOT EXISTS public.feedback_quotas (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bot_id TEXT NOT NULL, -- e.g., 'bot_junior', 'bot_senior'
    curricular_year TEXT NOT NULL, -- e.g., '2024/2025'
    feedback_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_bot_year UNIQUE (user_id, bot_id, curricular_year)
);

-- Add RLS policies for the feedback_quotas table
ALTER TABLE public.feedback_quotas ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own quota records
CREATE POLICY "Users can view own feedback quotas" ON public.feedback_quotas
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own quota records
CREATE POLICY "Users can insert own feedback quotas" ON public.feedback_quotas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own quota records
CREATE POLICY "Users can update own feedback quotas" ON public.feedback_quotas
    FOR UPDATE USING (auth.uid() = user_id);

-- Remove the old daily quota columns from profiles table
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS daily_feedback_count,
DROP COLUMN IF EXISTS last_feedback_date;

-- Function to get current curricular year
CREATE OR REPLACE FUNCTION get_current_curricular_year()
RETURNS TEXT AS $$
BEGIN
    -- Curricular year starts in September
    -- If current month is September or later, year is current/next
    -- If current month is before September, year is previous/current
    IF EXTRACT(MONTH FROM NOW()) >= 9 THEN
        RETURN EXTRACT(YEAR FROM NOW())::TEXT || '/' || (EXTRACT(YEAR FROM NOW()) + 1)::TEXT;
    ELSE
        RETURN (EXTRACT(YEAR FROM NOW()) - 1)::TEXT || '/' || EXTRACT(YEAR FROM NOW())::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update feedback quota
CREATE OR REPLACE FUNCTION check_and_update_feedback_quota(
    p_user_id UUID,
    p_bot_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    current_year TEXT;
    current_count INT;
    max_quota INT := 5; -- 5 feedbacks per bot per year
BEGIN
    -- Get current curricular year
    current_year := get_current_curricular_year();
    
    -- Get current feedback count for this user, bot, and year
    SELECT COALESCE(feedback_count, 0) INTO current_count
    FROM public.feedback_quotas
    WHERE user_id = p_user_id 
    AND bot_id = p_bot_id 
    AND curricular_year = current_year;
    
    -- If no record exists, current_count will be NULL, so we treat it as 0
    IF current_count IS NULL THEN
        current_count := 0;
    END IF;
    
    -- Check if quota is exceeded
    IF current_count >= max_quota THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Quota de feedback excedida para este bot neste ano curricular',
            'current_count', current_count,
            'max_quota', max_quota,
            'remaining', 0
        );
    END IF;
    
    -- Update or insert quota record
    INSERT INTO public.feedback_quotas (user_id, bot_id, curricular_year, feedback_count)
    VALUES (p_user_id, p_bot_id, current_year, 1)
    ON CONFLICT (user_id, bot_id, curricular_year)
    DO UPDATE SET 
        feedback_count = feedback_quotas.feedback_count + 1,
        updated_at = NOW();
    
    -- Return success with updated counts
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Feedback registado com sucesso',
        'current_count', current_count + 1,
        'max_quota', max_quota,
        'remaining', max_quota - (current_count + 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current quota status for all bots
CREATE OR REPLACE FUNCTION get_user_feedback_quotas(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    current_year TEXT;
    result JSONB := '{}';
    bot_record RECORD;
    quota_count INT;
    max_quota INT := 5;
BEGIN
    current_year := get_current_curricular_year();
    
    -- Get quota for each bot
    FOR bot_record IN 
        SELECT DISTINCT unnest(ARRAY['bot_junior', 'bot_senior']) as bot_id
    LOOP
        SELECT COALESCE(feedback_count, 0) INTO quota_count
        FROM public.feedback_quotas
        WHERE user_id = p_user_id 
        AND bot_id = bot_record.bot_id 
        AND curricular_year = current_year;
        
        IF quota_count IS NULL THEN
            quota_count := 0;
        END IF;
        
        result := result || jsonb_build_object(
            bot_record.bot_id, jsonb_build_object(
                'used', quota_count,
                'remaining', max_quota - quota_count,
                'max', max_quota
            )
        );
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.feedback_quotas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.feedback_quotas_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_curricular_year() TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_update_feedback_quota(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_feedback_quotas(UUID) TO authenticated;

-- Insert some test data for existing users (optional)
-- This will create initial quota records for users who might already exist
INSERT INTO public.feedback_quotas (user_id, bot_id, curricular_year, feedback_count)
SELECT 
    p.id as user_id,
    bot.bot_id,
    get_current_curricular_year() as curricular_year,
    0 as feedback_count
FROM public.profiles p
CROSS JOIN (
    SELECT unnest(ARRAY['bot_junior', 'bot_senior']) as bot_id
) bot
WHERE p.role = 'student'
ON CONFLICT (user_id, bot_id, curricular_year) DO NOTHING;
