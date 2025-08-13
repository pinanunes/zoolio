-- =====================================================
-- ADD MISSING TEAM COLUMNS FIX
-- =====================================================
-- This script adds the missing columns to the teams table
-- that the frontend application expects for tracking submissions
-- =====================================================

-- Add missing columns to the teams table for tracking submissions
-- Using IF NOT EXISTS to make this script safe to run multiple times
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS ficha_entregue BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS revisao_entregue BOOLEAN DEFAULT FALSE;

-- =====================================================
-- EXPLANATION OF COLUMNS
-- =====================================================
-- ficha_entregue: Boolean flag indicating if the team has submitted their information sheet
-- revisao_entregue: Boolean flag indicating if the team has submitted their review
-- Both default to FALSE, meaning teams start with nothing submitted
-- =====================================================

-- =====================================================
-- SCRIPT COMPLETED
-- =====================================================
-- This should resolve the 400 error:
-- "column teams.ficha_entregue does not exist"
-- "column teams.revisao_entregue does not exist"
-- =====================================================
