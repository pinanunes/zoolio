-- Foreign Key Fix for Team-Disease Relationship
-- This script adds the missing foreign key constraint between teams and diseases tables

-- Add the foreign key constraint that was missing from the original schema
ALTER TABLE public.teams
ADD CONSTRAINT teams_assigned_disease_id_fkey
FOREIGN KEY (assigned_disease_id) REFERENCES public.diseases(id);

-- Optional: Add a comment to document this relationship
COMMENT ON CONSTRAINT teams_assigned_disease_id_fkey ON public.teams 
IS 'Foreign key linking teams to their assigned diseases';
