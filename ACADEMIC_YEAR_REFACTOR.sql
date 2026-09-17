-- Academic year refactor — proper archival instead of the destructive NEW_YEAR_RESET.sql /
-- reset_academic_year() reset-in-place approach. See the approved plan for full context.
--
-- Applied incrementally, phase by phase, against Supabase Cloud production
-- (project bqdirpftoebxrsulwcgu). Each phase is a separate statement batch — run them in
-- order, verifying between phases per the plan.

-- =============================================================================
-- PHASE 1 — additive schema only. Zero app-code changes required; provably no
-- behavior change (every existing row just gets tagged with the one seeded year).
-- =============================================================================

-- 1a. The academic_years table itself.
CREATE TABLE public.academic_years (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL UNIQUE,               -- e.g. '2026/2027'
    is_current BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_current_academic_year ON public.academic_years (is_current) WHERE is_current = true;

CREATE OR REPLACE FUNCTION public.current_academic_year_id()
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_academic_year_id() TO authenticated, anon;

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academic_years_select_all" ON public.academic_years FOR SELECT USING (true);
-- Deliberately no INSERT/UPDATE/DELETE grant to authenticated/anon — all writes go through
-- start_new_academic_year() (Phase 5), a SECURITY DEFINER RPC.

-- 1b. Seed the current, already-in-progress year.
INSERT INTO public.academic_years (label, is_current) VALUES ('2025/2026', true);

-- 1c. Add academic_year_id to the 5 tables where a DEFAULT can populate it automatically —
-- no insert call site anywhere in src/ needs to change.
ALTER TABLE public.teams                 ADD COLUMN academic_year_id INT REFERENCES public.academic_years(id) DEFAULT public.current_academic_year_id();
ALTER TABLE public.diseases              ADD COLUMN academic_year_id INT REFERENCES public.academic_years(id) DEFAULT public.current_academic_year_id();
ALTER TABLE public.chat_logs             ADD COLUMN academic_year_id INT REFERENCES public.academic_years(id) DEFAULT public.current_academic_year_id();
ALTER TABLE public.comparative_chat_logs ADD COLUMN academic_year_id INT REFERENCES public.academic_years(id) DEFAULT public.current_academic_year_id();
ALTER TABLE public.feedback_quotas       ADD COLUMN academic_year_id INT REFERENCES public.academic_years(id) DEFAULT public.current_academic_year_id();

-- 1d. profiles: nullable, no default (NULL for professors/admins — they aren't year-scoped).
-- A plain column DEFAULT can't be conditional on role, so a trigger handles students only.
ALTER TABLE public.profiles ADD COLUMN academic_year_id INT REFERENCES public.academic_years(id);

CREATE OR REPLACE FUNCTION public.set_profile_academic_year() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.academic_year_id IS NULL THEN
    NEW.academic_year_id := public.current_academic_year_id();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trigger_set_profile_academic_year BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_academic_year();

-- 1e. Explicit backfill (belt-and-suspenders alongside the DEFAULTs above — harmless no-op
-- if the ALTER TABLE DEFAULT already populated everything, catches it if not).
UPDATE public.teams                 SET academic_year_id = public.current_academic_year_id() WHERE academic_year_id IS NULL;
UPDATE public.diseases              SET academic_year_id = public.current_academic_year_id() WHERE academic_year_id IS NULL;
UPDATE public.chat_logs             SET academic_year_id = public.current_academic_year_id() WHERE academic_year_id IS NULL;
UPDATE public.comparative_chat_logs SET academic_year_id = public.current_academic_year_id() WHERE academic_year_id IS NULL;
UPDATE public.feedback_quotas       SET academic_year_id = public.current_academic_year_id() WHERE academic_year_id IS NULL;
UPDATE public.profiles              SET academic_year_id = public.current_academic_year_id() WHERE role = 'student' AND academic_year_id IS NULL;

-- 1f. Fix the uniqueness landmine confirmed in Phase 0: teams.team_name and diseases.name
-- each have a live, undocumented UNIQUE CONSTRAINT (not a bare index — confirmed by the
-- "cannot drop index ... because constraint ... requires it" error on first attempt, so this
-- must go through DROP CONSTRAINT, which removes the backing index automatically). Left
-- as-is, the first bulk team/disease creation for year 2 would fail reusing names like
-- "Grupo 1".."Grupo 30" against year 1's still-present archived rows.
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_team_name_key;
CREATE UNIQUE INDEX teams_team_name_academic_year_key ON public.teams (team_name, academic_year_id);

ALTER TABLE public.diseases DROP CONSTRAINT IF EXISTS diseases_name_key;
CREATE UNIQUE INDEX diseases_name_academic_year_key ON public.diseases (name, academic_year_id);

-- =============================================================================
-- PHASE 1 VERIFICATION — run after the above, before moving to Phase 2
-- =============================================================================
-- Expect: one bucket per table, all pointing at the single seeded academic_years.id, zero NULLs.
SELECT 'teams' AS table_name, academic_year_id, count(*) FROM public.teams GROUP BY 2
UNION ALL
SELECT 'diseases', academic_year_id, count(*) FROM public.diseases GROUP BY 2
UNION ALL
SELECT 'chat_logs', academic_year_id, count(*) FROM public.chat_logs GROUP BY 2
UNION ALL
SELECT 'comparative_chat_logs', academic_year_id, count(*) FROM public.comparative_chat_logs GROUP BY 2
UNION ALL
SELECT 'feedback_quotas', academic_year_id, count(*) FROM public.feedback_quotas GROUP BY 2;

-- Expect: students all non-null (one bucket), professors/admins all NULL.
SELECT role, academic_year_id, count(*) FROM public.profiles GROUP BY 1, 2 ORDER BY 1, 2;

-- Confirm the new composite unique indexes exist and the old single-column ones are gone.
SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('teams','diseases');

-- =============================================================================
-- PHASE 2 — quota consolidation + RPC rewrite. Confirmed via Phase 0/2 diagnostics:
-- real constraint name feedback_quotas_user_id_bot_id_academic_year_key (on the old TEXT
-- academic_year column), user_feedback_quotas confirmed 0 rows.
-- =============================================================================

ALTER TABLE public.feedback_quotas ALTER COLUMN academic_year_id SET NOT NULL;
ALTER TABLE public.feedback_quotas DROP CONSTRAINT feedback_quotas_user_id_bot_id_academic_year_key;
ALTER TABLE public.feedback_quotas ADD CONSTRAINT feedback_quotas_user_bot_year_key UNIQUE (user_id, bot_id, academic_year_id);
ALTER TABLE public.feedback_quotas DROP COLUMN academic_year;

DROP TABLE public.user_feedback_quotas;

-- Rewritten read path: fixes two live bugs for free — the old version returned a single
-- JSON object (AuthContext.jsx expects an array with a used_count field, so this was always
-- silently falling back to defaults) and dropped bot_arena from its output entirely.
-- The return type is changing shape (JSON -> TABLE), which CREATE OR REPLACE can't do in
-- place — must DROP first.
DROP FUNCTION IF EXISTS public.get_user_feedback_quotas(uuid);
CREATE OR REPLACE FUNCTION public.get_user_feedback_quotas(p_user_id UUID)
RETURNS TABLE(bot_id TEXT, used_count INT, max_quota INT, remaining INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT b.bot_id, COALESCE(fq.feedback_count,0), 5, GREATEST(0, 5 - COALESCE(fq.feedback_count,0))
  FROM (VALUES ('bot_junior'), ('bot_senior'), ('bot_arena')) AS b(bot_id)
  LEFT JOIN public.feedback_quotas fq
    ON fq.user_id = p_user_id AND fq.bot_id = b.bot_id AND fq.academic_year_id = public.current_academic_year_id();
$$;
GRANT EXECUTE ON FUNCTION public.get_user_feedback_quotas(UUID) TO authenticated;

-- Rewritten write path: same NULL-guard already shipped today, now keyed on
-- academic_year_id instead of a hardcoded '2024-2025' string literal.
CREATE OR REPLACE FUNCTION public.check_and_update_feedback_quota(p_user_id UUID, p_bot_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_year_id INT := public.current_academic_year_id(); current_count INT; max_quota INT := 5;
BEGIN
  SELECT COALESCE(feedback_count,0) INTO current_count FROM public.feedback_quotas
    WHERE user_id=p_user_id AND bot_id=p_bot_id AND academic_year_id=v_year_id;
  current_count := COALESCE(current_count, 0);
  IF current_count >= max_quota THEN
    RETURN jsonb_build_object('success',false,'message','Quota de feedback esgotada para este bot. Limite: '||max_quota||' por ano letivo.','current_count',current_count,'remaining',0,'max_quota',max_quota);
  END IF;
  INSERT INTO public.feedback_quotas (user_id,bot_id,feedback_count,academic_year_id) VALUES (p_user_id,p_bot_id,1,v_year_id)
    ON CONFLICT (user_id,bot_id,academic_year_id) DO UPDATE SET feedback_count = feedback_quotas.feedback_count+1, updated_at=now();
  current_count := current_count+1;
  RETURN jsonb_build_object('success',true,'message','Feedback registado com sucesso.','current_count',current_count,'remaining',max_quota-current_count,'max_quota',max_quota);
END; $$;
GRANT EXECUTE ON FUNCTION public.check_and_update_feedback_quota(UUID, TEXT) TO authenticated;

-- =============================================================================
-- PHASE 2 VERIFICATION
-- =============================================================================
-- Confirm the schema change landed cleanly.
SELECT column_name FROM information_schema.columns WHERE table_name = 'feedback_quotas' ORDER BY ordinal_position;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.feedback_quotas'::regclass;
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_feedback_quotas') AS user_feedback_quotas_still_exists;

-- Functional check: pick any one real student id from your data and confirm real numbers
-- come back (previously always defaults, since the old read path hit an always-empty table).
-- Replace the uuid below with a real student profiles.id.
-- SELECT * FROM public.get_user_feedback_quotas('00000000-0000-0000-0000-000000000000');

-- =============================================================================
-- PHASE 3 — one targeted RLS fix. Confirmed via Phase 0's full pg_policies dump: only
-- "Professors can update teams" (admin+professor, no year condition) needs replacing.
-- diseases/profiles need no policy changes (see plan for reasoning).
-- =============================================================================

DROP POLICY "Professors can update teams" ON public.teams;
CREATE POLICY "professors_update_current_year_teams" ON public.teams
  FOR UPDATE
  USING (get_user_role(auth.uid()) = 'professor' AND academic_year_id = public.current_academic_year_id())
  WITH CHECK (get_user_role(auth.uid()) = 'professor' AND academic_year_id = public.current_academic_year_id());

-- =============================================================================
-- PHASE 3 VERIFICATION
-- =============================================================================
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'teams' AND cmd = 'UPDATE';

-- Phases 4-7 below were designed and verified against a full self-hosted copy of
-- production data (schema + public-schema data restored via pg_dump/psql, session
-- pooler port 5432, session_replication_role=replica to sidestep the circular FKs on
-- teams/profiles) before being applied to Supabase Cloud production. All confirmed live
-- on both as of 2026-09-17.

-- =============================================================================
-- PHASE 4 — critical RLS fix + smaller cleanup. Drops only; nothing new to break.
-- Confirmed live 2026-07-25 (see docs/ARCHITECTURE.md §2.4/§5#1): three leftover policies
-- from RLS_RECURSION_FIX.sql:148-158 let any authenticated student read/insert/update
-- *any* feedback_validations row (condition was just "logged in"), including
-- points_awarded, which moves the leaderboard via trigger_update_team_points. The
-- correctly-scoped policies (feedback_validations_select_policy/..._insert_policy/
-- ..._update_policy, gated on is_admin_or_professor() or "own row via parent chat_logs")
-- already coexist, so this is a pure tightening, not a behavior redesign.
-- =============================================================================

DROP POLICY IF EXISTS "feedback_validations_select_all" ON public.feedback_validations;
DROP POLICY IF EXISTS "feedback_validations_insert_all" ON public.feedback_validations;
DROP POLICY IF EXISTS "feedback_validations_update_all" ON public.feedback_validations;

-- Same reasoning, smaller stakes (superseded, never used by app code):
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles; -- didn't restrict id to auth.uid()
DROP POLICY IF EXISTS "Everyone can view diseases" ON public.diseases; -- qual: true, roles: public
DROP POLICY IF EXISTS "Everyone can view teams" ON public.teams;      -- qual: true, roles: public

-- =============================================================================
-- PHASE 4 VERIFICATION
-- =============================================================================
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('feedback_validations','profiles','diseases','teams')
ORDER BY tablename, cmd;
-- Expect: none of the six dropped names present; feedback_validations still has working
-- SELECT/INSERT/UPDATE/DELETE policies. diseases_select_all/teams_select_all
-- (auth.uid() IS NOT NULL) may still show up on both environments — confirmed harmless,
-- matches the already-intended "any authenticated user" design, not the same issue as the
-- qual:true/roles:public policies actually dropped above.

-- =============================================================================
-- PHASE 5 — additive "start new year" RPC, replaces the destructive
-- NewYearReset.jsx/reset_academic_year() reset-in-place approach. Does nothing
-- destructive — only flips which academic_years row is_current. Every table with an
-- academic_year_id DEFAULT current_academic_year_id() (teams, diseases, chat_logs,
-- comparative_chat_logs, feedback_quotas) automatically starts tagging new rows with the
-- new year the instant this runs; old rows keep their old year and become "historic"
-- simply by no longer being current.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.start_new_academic_year(p_label TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_id INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Apenas administradores podem iniciar um novo ano letivo.');
  END IF;
  UPDATE public.academic_years SET is_current = false WHERE is_current = true;
  INSERT INTO public.academic_years (label, is_current) VALUES (p_label, true) RETURNING id INTO v_new_id;
  RETURN jsonb_build_object('success', true, 'message', 'Ano letivo ' || p_label || ' iniciado.', 'academic_year_id', v_new_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.start_new_academic_year(TEXT) TO authenticated;

-- =============================================================================
-- PHASE 5 VERIFICATION
-- =============================================================================
-- Do NOT invoke this against Cloud production casually — it's the one genuinely one-way
-- action in this whole migration (flips which year is current for the entire live app).
-- Confirm it exists and Cloud's academic_years is unchanged instead:
SELECT proname FROM pg_proc WHERE proname = 'start_new_academic_year';
SELECT * FROM public.academic_years ORDER BY id;
-- Actually calling it (SELECT public.start_new_academic_year('2026/2027');) was only ever
-- done against the self-hosted test copy, deliberately, and confirmed working correctly
-- there (guard correctly refused a call with no admin JWT context; succeeded and flipped
-- academic_years correctly once simulated via `SET LOCAL request.jwt.claims`).

-- =============================================================================
-- PHASE 6 — year-scope get_feedback_validation_logs (ADD_FEEDBACK_VALIDATION_PAGINATION_RPC.sql).
-- Was filtering on cl.is_archived = false, a dead flag (always inserted false, nothing
-- anywhere ever sets it true, and it predates academic_year_id entirely, added 2025-08-26
-- per git blame). feedback_validations itself never got an academic_year_id column
-- (Phase 1 only added it to teams/diseases/chat_logs/comparative_chat_logs/
-- feedback_quotas/profiles) — every feedback_validations row here is already reached
-- through chat_logs, so scoping chat_logs to the current year is sufficient; the
-- join-level is_archived check is dropped outright rather than replaced.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_feedback_validation_logs(
  p_team_id INT DEFAULT NULL,
  p_disease TEXT DEFAULT NULL,
  p_validation_status TEXT DEFAULT 'all',
  p_keyword TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT, created_at TIMESTAMPTZ, user_id UUID, team_id INT, question TEXT, answer TEXT,
  feedback SMALLINT, bot_id TEXT, disease_classification TEXT,
  positive_feedback_details JSONB, negative_feedback_details JSONB, error_details JSONB,
  student_name TEXT, team_name TEXT, validation_id BIGINT, validation_comment TEXT,
  validation_points_awarded INT, validation_is_validated BOOLEAN, validation_professor_id UUID,
  validation_professor_name TEXT, validation_created_at TIMESTAMPTZ, total_count BIGINT
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
    LEFT JOIN feedback_validations fv ON fv.log_id = cl.id
    LEFT JOIN profiles prof ON prof.id = fv.professor_id
    WHERE cl.feedback IS NOT NULL
      AND cl.academic_year_id = public.current_academic_year_id()
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

-- =============================================================================
-- PHASE 6 VERIFICATION
-- =============================================================================
SELECT total_count FROM get_feedback_validation_logs() LIMIT 1;
SELECT count(*) FROM chat_logs WHERE feedback IS NOT NULL AND academic_year_id = public.current_academic_year_id();
-- Expect these two numbers identical. Confirmed on self-hosted (0 vs 0, current year
-- flipped to empty 2026/2027 there) and Cloud (939 vs 939, still on 2025/2026).

-- =============================================================================
-- PHASE 7 — year-scope get_student_analytics (FINAL_RLS_OVERHAUL_SIMPLIFIED.sql:332-392).
-- Pre-dates the whole academic-year concept; had zero year scoping. Students are tagged to
-- their year via profiles.academic_year_id (set once at registration by Phase 1's
-- trigger_set_profile_academic_year) — not team_id, which isn't itself year-versioned.
-- Adding a parameter changes the signature, so the old zero-arg version needs dropping
-- first (same reasoning as Phase 2's get_user_feedback_quotas rewrite). Note: still doesn't
-- count Arena/comparative_chat_logs feedback in its totals — a pre-existing gap in the
-- original function, left alone here since it wasn't part of what was asked for.
-- =============================================================================

DROP FUNCTION IF EXISTS get_student_analytics();

CREATE OR REPLACE FUNCTION get_student_analytics(p_academic_year_id INT DEFAULT NULL)
RETURNS TABLE (
    student_id UUID,
    full_name TEXT,
    student_number TEXT,
    team_id INT,
    team_name TEXT,
    assigned_disease_id INT,
    assigned_disease_name TEXT,
    red_team_1_disease TEXT,
    red_team_2_disease TEXT,
    total_feedbacks BIGINT,
    approved_feedbacks BIGINT,
    total_points BIGINT,
    average_points_per_feedback NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year_id INT := COALESCE(p_academic_year_id, public.current_academic_year_id());
BEGIN
    RETURN QUERY
    SELECT
        p.id as student_id,
        p.full_name,
        p.student_number,
        p.team_id,
        t.team_name,
        t.assigned_disease_id,
        d.name as assigned_disease_name,
        d1.name as red_team_1_disease,
        d2.name as red_team_2_disease,
        COALESCE(feedback_stats.total_feedbacks, 0) as total_feedbacks,
        COALESCE(feedback_stats.approved_feedbacks, 0) as approved_feedbacks,
        COALESCE(feedback_stats.total_points, 0) as total_points,
        CASE
            WHEN COALESCE(feedback_stats.approved_feedbacks, 0) > 0
            THEN ROUND(COALESCE(feedback_stats.total_points, 0)::NUMERIC / feedback_stats.approved_feedbacks, 2)
            ELSE 0
        END as average_points_per_feedback
    FROM public.profiles p
    LEFT JOIN public.teams t ON p.team_id = t.id
    LEFT JOIN public.diseases d ON t.assigned_disease_id = d.id
    LEFT JOIN public.teams rt1 ON t.red_team_1_target_id = rt1.id
    LEFT JOIN public.diseases d1 ON rt1.assigned_disease_id = d1.id
    LEFT JOIN public.teams rt2 ON t.red_team_2_target_id = rt2.id
    LEFT JOIN public.diseases d2 ON rt2.assigned_disease_id = d2.id
    LEFT JOIN (
        SELECT
            cl.user_id,
            COUNT(*) as total_feedbacks,
            COUNT(fv.id) FILTER (WHERE fv.is_validated = true) as approved_feedbacks,
            COALESCE(SUM(fv.points_awarded) FILTER (WHERE fv.is_validated = true), 0) as total_points
        FROM public.chat_logs cl
        LEFT JOIN public.feedback_validations fv ON cl.id = fv.log_id
        WHERE cl.feedback IS NOT NULL
          AND cl.academic_year_id = v_year_id
        GROUP BY cl.user_id
    ) feedback_stats ON p.id = feedback_stats.user_id
    WHERE p.role = 'student'
      AND p.academic_year_id = v_year_id
    ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_student_analytics(INT) TO authenticated;

-- =============================================================================
-- PHASE 7 VERIFICATION
-- =============================================================================
SELECT count(*) FROM get_student_analytics();      -- defaults to current year
SELECT count(*) FROM get_student_analytics(1);      -- explicit year 1 (2025/2026)
-- Confirmed: self-hosted 0/113 (current year flipped to empty 2026/2027 there, real
-- year-1 data intact), Cloud 113/113 (still on 2025/2026, both branches agree).

-- =============================================================================
-- PHASE 8 — restore anon SELECT on teams, scoped more precisely than what Phase 4 dropped.
-- Regression found immediately after the real production rollover to 2026/2027 (self-hosted):
-- PaginaRegisto.jsx's registration page queries `teams` while logged out (anon role), to
-- show real current-year teams instead of the old hardcoded "Grupo 1..30" list. Phase 4
-- dropped "Everyone can view teams" (qual: true, roles: public) as a cleanup, reasoning no
-- app code needed anon access — true for the *old* registration page, not the new one this
-- migration introduced. Fixed by granting anon SELECT specifically (not the broader
-- "public" role Phase 4's target covered), since `authenticated` already has its own
-- working policies (teams_select_policy / "Students can view teams").
-- =============================================================================

CREATE POLICY "anon_can_view_teams_for_registration" ON public.teams
  FOR SELECT
  TO anon
  USING (true);

-- =============================================================================
-- PHASE 8 VERIFICATION
-- =============================================================================
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'teams' AND cmd = 'SELECT';
-- Confirmed working 2026-09-17: registration page's team dropdown populates correctly
-- after this, on self-hosted (now production). Apply the same fix to Cloud for consistency
-- even though it's being retired, in case anyone still reaches that URL.

-- =============================================================================
-- STATUS as of 2026-09-17: Phases 1-8 confirmed live on self-hosted, now the real
-- production instance — real 2026/2027 rollover triggered for real via
-- start_new_academic_year (NewYearReset.jsx's "Iniciar Novo Ano Letivo"), new teams
-- created via TeamManagement's "Criar Grupos", registration confirmed working end-to-end
-- for new students. Cloud/Netlify is being retired, left on its own real (separately
-- triggered) 2026/2027 rollover rather than reconciled. Phases 1-7 (not yet Phase 8, as of
-- this writing) are also live on Cloud. See docs/ARCHITECTURE.md and CLAUDE.md for the
-- wider picture — both should be updated to reflect self-hosted Supabase
-- (supabase.fmv.ulisboa.pt) + the new app server (zoolio.fmv.ulisboa.pt) as the real
-- production stack, superseding their Netlify/Supabase Cloud descriptions.
-- =============================================================================
