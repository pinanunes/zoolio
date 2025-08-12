-- Team Management System - Database Updates
-- This script adds the necessary columns to support comprehensive team management

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
