-- =====================================================
-- TEAM MANAGEMENT MISSING COLUMNS FIX
-- =====================================================
-- This script adds the missing columns that the TeamManagement component needs
-- Execute this in Supabase SQL Editor to fix the save functionality
-- =====================================================

-- Add missing columns to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS red_team_1_target_id INT REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS red_team_2_target_id INT REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS has_submitted_sheet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_submitted_review BOOLEAN DEFAULT FALSE;

-- Add comments to document the columns
COMMENT ON COLUMN public.teams.red_team_1_target_id IS 'ID of the first Red Team that will test this team''s bot';
COMMENT ON COLUMN public.teams.red_team_2_target_id IS 'ID of the second Red Team that will test this team''s bot';
COMMENT ON COLUMN public.teams.has_submitted_sheet IS 'Whether the team has submitted their initial information sheet';
COMMENT ON COLUMN public.teams.has_submitted_review IS 'Whether the team has submitted their Blue Team review';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_red_team_1 ON public.teams(red_team_1_target_id);
CREATE INDEX IF NOT EXISTS idx_teams_red_team_2 ON public.teams(red_team_2_target_id);

-- Initialize existing teams with default values
UPDATE public.teams 
SET 
    has_submitted_sheet = COALESCE(has_submitted_sheet, FALSE),
    has_submitted_review = COALESCE(has_submitted_review, FALSE)
WHERE has_submitted_sheet IS NULL OR has_submitted_review IS NULL;

-- Verify the columns were added successfully
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    -- Check if all required columns exist
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND table_schema = 'public'
    AND column_name IN ('red_team_1_target_id', 'red_team_2_target_id', 'has_submitted_sheet', 'has_submitted_review');
    
    IF column_count = 4 THEN
        RAISE NOTICE '✅ SUCCESS: All required columns have been added to the teams table!';
        RAISE NOTICE '';
        RAISE NOTICE 'The following columns are now available:';
        RAISE NOTICE '  - red_team_1_target_id (INT, references teams.id)';
        RAISE NOTICE '  - red_team_2_target_id (INT, references teams.id)';
        RAISE NOTICE '  - has_submitted_sheet (BOOLEAN, default FALSE)';
        RAISE NOTICE '  - has_submitted_review (BOOLEAN, default FALSE)';
        RAISE NOTICE '';
        RAISE NOTICE 'The Team Management page should now save changes correctly!';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Refresh the Team Management page';
        RAISE NOTICE '2. Try making changes to team assignments';
        RAISE NOTICE '3. Changes should now save successfully';
    ELSE
        RAISE WARNING 'Only % out of 4 required columns were found. Please check for errors.', column_count;
    END IF;
END $$;
