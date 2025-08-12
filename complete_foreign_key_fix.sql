-- Complete Foreign Key Fix for Zoolio Database
-- This script adds all missing foreign key constraints

-- 1. Add the missing foreign key for teams.supervisor_id -> profiles.id
ALTER TABLE public.teams
ADD CONSTRAINT teams_supervisor_id_fkey
FOREIGN KEY (supervisor_id) REFERENCES public.profiles(id);

-- 2. Add comments to document the relationships
COMMENT ON CONSTRAINT teams_supervisor_id_fkey ON public.teams 
IS 'Foreign key linking teams to their supervisor (professor)';

-- 3. Verify all foreign keys are in place (optional check)
-- You can run this query to see all foreign keys on the teams table:
-- SELECT 
--     tc.constraint_name, 
--     tc.table_name, 
--     kcu.column_name, 
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name 
-- FROM 
--     information_schema.table_constraints AS tc 
--     JOIN information_schema.key_column_usage AS kcu
--       ON tc.constraint_name = kcu.constraint_name
--     JOIN information_schema.constraint_column_usage AS ccu
--       ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' 
--   AND tc.table_name='teams';
