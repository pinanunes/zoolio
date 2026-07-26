# Zoolio (zoolio-app) — Architecture

This document is a from-the-repo technical reference: stack and build pipeline, every
Supabase usage grouped by capability, the reconstructed data model, client state lifecycle,
and a ranked list of fragile/dead/duplicated/inconsistent code. Most of it was produced by
static analysis — reading source files, SQL scripts, config, and `git log` — with no access
to the live Supabase project; anywhere that couldn't settle something, it says so rather than
guessing. §2.4 and parts of §3/§5/§6 have since been updated with **live-confirmed data**
(marked with the date 2026-07-25) after you ran a `pg_policies` query and answered the
original open questions — those parts reflect the actual database, not just the tracked SQL
scripts. For a short, practical version of this (how to run/build/deploy, conventions), see
[../CLAUDE.md](../CLAUDE.md).

**Repo history context**: first commit `2688279` on 2025-08-07 ("Initial commit: MarIA
Supabase frontend with role-based authentication" — hence the "MarIA" name still in
`README.md`). Current `HEAD` is `e8c6045` on 2026-04-12 ("changed the webhooks endpoints"),
45 commits total, on branch `refactor`. `origin/new_zoolio` also exists as a remote branch
but is code-identical to `main`/`refactor` — not a different codebase.

---

## 1. Stack, entry points, dev & build setup

### 1.1 Stack

| Layer | Choice | Source |
|---|---|---|
| Language | JavaScript/JSX only — **no TypeScript** anywhere in `src/` | confirmed by file tree |
| Frontend | React 19.1.0 | `package.json:21-22` |
| Build tool | Vite 7.0.4, via `@vitejs/plugin-react-swc` 3.10.2 (SWC, not Babel) | `package.json:32,37` |
| Styling | Tailwind CSS 4.1.11, via `@tailwindcss/vite` + `@tailwindcss/postcss` | `package.json:14-15,26` |
| Routing | react-router-dom 7.7.1 | `package.json:25` |
| Backend-as-a-service | `@supabase/supabase-js` 2.53.0 | `package.json:13` |
| HTTP client (for n8n webhooks) | axios 1.11.0 | `package.json:17` |
| Misc | jwt-decode, marked, react-markdown, react-hot-toast | `package.json:18-19,23-24` |
| Lint | ESLint 9.30.1 flat config, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | `eslint.config.js` |

`package.json:2-4` still reads `"name": "react-frontend"`, `"version": "0.0.0"` — unedited
Vite template defaults.

### 1.2 Entry point chain

1. `index.html:11` — `<script type="module" src="/src/main.jsx">`, root div at line 10.
2. `src/main.jsx` (17 lines, full file) — `createRoot(...).render(<StrictMode><BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter></StrictMode>)`. No other providers exist at this level.
3. `src/App.jsx` — defines `PrivateRoute` (`:12-22`) and `AdminRoute` (`:24-56`), then the route table (`:90-123`): `/login`, `/register`, `/forgot-password`, `/update-password` are public; `/` (→ `FrontOffice`) and `/chat` (→ immediately `<Navigate to="/" />`, see §5) are behind `PrivateRoute`; `/backoffice/*` (→ `BackOffice`) is behind `AdminRoute`.
4. `src/pages/FrontOffice.jsx` — the main authenticated shell: renders `Header`/`Footer` plus a tab switcher (`renderTabContent`, `:98-125`) that mounts one of `BotJuniorChat` / `BotSeniorChat` / `BotArena` / `ProgressLeaderboard` / `MyFeedback` depending on `activeTab` state (`:17`). Tab availability is gated by `user.team.has_submitted_sheet`/`has_submitted_review` (`:25-26`), with professors/admins always bypassing the gate (`:21,36,47,115,117`).

### 1.3 Vite configuration — correcting a premise

You asked me to note that Vite is configured inside `createViteServer` in `server.ts`,
production running under PM2. **Neither of those exists in this repo.** I confirmed by
direct read:

- There is no `server.ts` (or any custom Node/Express server) anywhere in this codebase.
- There is no PM2 config (`ecosystem.config.*`) anywhere in this codebase.
- All Vite configuration lives in the standard `vite.config.js` at the repo root (full file, 19 lines):

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: { assetFileNames: 'assets/[name]-[hash][extname]' }
    }
  }
});
```

No `server:` block, no `middlewareMode`, no programmatic `createServer`/`createViteServer`
call anywhere. Vite runs purely via its standard CLI (`vite`, `vite build`, `vite preview`).
Production is not a running Node process at all — it's a static `dist/` build served from
Netlify's CDN (§1.6). If you have another Zoolio-related project in mind that does use
`server.ts`/`createViteServer`/PM2, it is not this one — see the note at the end of this doc
about a separate `zoolio_fmv` codebase found during investigation, which does match that
description but is an unrelated Express+Prisma project on a different GitHub account.

### 1.4 npm scripts

`package.json:6-11`:

| Script | Command | Notes |
|---|---|---|
| `npm run dev` | `vite` | Dev server, Vite default port 5173. Note: `supabase/config.toml:19` CORS-allowlists port 5178 instead — a latent mismatch if you run local Supabase services. |
| `npm run build` | `vite build` | Outputs to `dist/` (Vite default, no `outDir` override in `vite.config.js`) |
| `npm run lint` | `eslint .` | Flat config, see §"Conventions" in CLAUDE.md |
| `npm run preview` | `vite preview` | Serves the built `dist/` locally |

There is no `start` script — there is no long-running server process for this app in any
environment, dev or prod.

### 1.5 Build setup

Single build step (`vite build`); no separate server bundle (there is no server), no `tsc`
compile step (plain JS/JSX). SWC (via `@vitejs/plugin-react-swc`) handles JSX transform and
Fast Refresh only, not a separate build phase. Output directory `dist/`, confirmed by
`netlify.toml:2` (`publish = "dist"`).

### 1.6 Deploy pipeline

Static hosting on Netlify, driven by `netlify.toml` (full file, 19 lines):

```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[context.production.environment]
  VITE_SUPABASE_URL = "https://bqdirpftoebxrsulwcgu.supabase.co"
  # VITE_SUPABASE_ANON_KEY will be set in Netlify dashboard for security

[context.deploy-preview.environment]
  VITE_SUPABASE_URL = "https://bqdirpftoebxrsulwcgu.supabase.co"
  # VITE_SUPABASE_ANON_KEY will be set in Netlify dashboard for security
```

The SPA-fallback redirect (`/* → /index.html`) is what makes client-side routing work on
Netlify. `VITE_SUPABASE_ANON_KEY` is deliberately kept out of the repo and set directly in
the Netlify dashboard. There is no `.github/workflows` directory — no CI/CD beyond Netlify's
own build-on-push. No Dockerfile, no PM2.

`DEPLOYMENT_GUIDE.md` (152 lines) documents connecting the `pinanunes/zoolio` GitHub repo to
Netlify and lists a manual run order for 5 SQL scripts against Supabase's SQL Editor:
`database_updates.sql`, `feedback_quota_system.sql`, `yearly_feedback_quota_system.sql`,
`positive_feedback_structure_update.sql`, `team_management_updates.sql`. It does not account
for the other 18 root-level SQL scripts (§3.4) — I could not determine from the repo whether
those were applied via a different, undocumented process or represent abandoned attempts.
`BACKOFFICE_DEPLOYMENT_GUIDE.md` and `FINAL_DEPLOYMENT_SUMMARY.md` exist alongside it (not
read in full for this doc).

### 1.7 Environment variables

No `.env.example` exists. `.env` and `.env.local` both exist at the repo root (values not
reproduced here). Both define exactly two variables, and these are the only two referenced
anywhere in source:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

No env-validation module exists (no zod/envalid/etc.) — see §5 for the fallback-value risk
this creates.

---

## 2. Supabase usage, grouped by capability

### 2.1 Client instantiation

Exactly one Supabase client exists in the whole codebase: `src/supabaseClient.js` (full
file, 17 lines):

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bhpelimxagpohziqcufh.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGci...' // anon key, truncated here

const options = {
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
```

Imported everywhere else as `import { supabase } from '../supabaseClient'` (or
`'../../supabaseClient'`). Uses the anon key only — no `service_role` key appears anywhere
in client-reachable code (confirmed by repo-wide search; the only hits are `GRANT ... TO
service_role` statements inside server-side SQL scripts, which is normal and not a leak).
Every request globally carries cache-busting headers (`:6-14`) — the app's only defence
against stale reads, used in place of any real cache-invalidation strategy (see §4).

### 2.2 Database queries

All files that call `.from()` and/or `.rpc()`, confirmed by direct grep (`\.from\(` /
`\.rpc\(` across `src/`):

| File | Tables / RPCs touched | Purpose |
|---|---|---|
| `src/context/AuthContext.jsx` | `profiles` (select `:24`, insert `:209`), `teams` w/ `diseases` join (`:92`), RPC `get_user_feedback_quotas` (`:48`), RPC `check_and_update_feedback_quota` (`:269`) | Central auth/profile hydration, registration, quota tracking |
| `src/pages/BackOffice.jsx` | RPC `get_dashboard_stats` (`:108`) | Admin dashboard summary widget |
| `src/pages/MyFeedback.jsx` | `profiles` (`:25`), `chat_logs` w/ `profiles`+`feedback_validations` join (`:38`), `comparative_chat_logs` w/ `profiles` join (`:57`) | Student's own feedback history |
| `src/components/ZoolioChat.jsx` | `profiles`, `chat_logs`, `feedback_validations` | **Dead/unreachable** — see §5 |
| `src/components/BotSeniorChat.jsx` | `diseases` w/ `teams` join (`:54`), `chat_logs` insert/select/update (`:187,247,281`) | Bot Senior chat UI + disease-status panel |
| `src/components/BotJuniorChat.jsx` | `chat_logs` insert/select/update (`:94,154,189`) | Bot Junior chat UI (intentionally injects errors for teaching) |
| `src/components/BotArena.jsx` | `comparative_chat_logs` insert ×2 (`:149,180`) | Fans a question to 3 bots in parallel, logs all answers + the student's vote |
| `src/components/ProgressLeaderboard.jsx` | `teams` (`:26`), `chat_logs` count (`:45`), `comparative_chat_logs` count (`:53`) | Team leaderboard by points |
| `src/components/backoffice/ArenaFeedbackValidation.jsx` | `teams` (`:33`), `comparative_chat_logs` w/ nested `profiles→teams` join (`:50,113`), `profiles` (`:62`), RPC `increment_team_points` (`:130`) | Professor validates Bot Arena votes, awards points |
| `src/components/backoffice/FeedbackValidation.jsx` | `teams` (`:43`), `chat_logs` 3-way join (`:66,113`), `comparative_chat_logs` (`:73,87,206`), `feedback_validations` (`:80,240,252`), `profiles` (`:149`), RPC `get_unique_disease_classifications` (`:44`), RPC `increment_team_points` (`:221,267`) | Professor validates student feedback, awards points |
| `src/components/backoffice/StudentAnalytics.jsx` | RPC `get_student_analytics` (`:52`), `teams` (`:83`), `profiles` update (`:101`) | Per-student report + team reassignment |
| `src/components/backoffice/DiseaseManagement.jsx` | `diseases` select/insert/update/delete w/ `teams` join (`:22,56,92,124`) | Admin CRUD for diseases |
| `src/components/backoffice/UserApprovals.jsx` | `profiles` select/update/delete (`:19,37,65`) | Approve/reject pending professor registrations |
| `src/components/backoffice/TeamManagement.jsx` | `teams` w/ 5 nested FK joins (`:29`), `diseases` (`:44`), `profiles` (`:52`), `teams` update (`:94`) | Admin team roster/assignment management |
| `src/components/backoffice/UsageMonitoring.jsx` | `chat_logs`/`comparative_chat_logs`/`teams` counts + paginated joined lists (`:165-186`), RPC `get_unique_disease_classifications` (`:168`) | Admin usage/volume dashboard |
| `src/components/backoffice/NewYearReset.jsx` | RPC `reset_academic_year` (`:21`) | Admin-only, destructive academic-year reset |
| `src/pages/FrontOffice.jsx` | *(imports `supabase` at `:4`, never calls it)* | Dead import — see §5 |

**Tables**: `profiles`, `teams`, `diseases`, `chat_logs`, `comparative_chat_logs`,
`feedback_validations` (queried directly), plus `user_feedback_quotas` (touched only via
RPC, never a direct `.from()`).

**RPCs called from the client** (7, confirmed by grep): `get_dashboard_stats`,
`get_user_feedback_quotas`, `check_and_update_feedback_quota`, `increment_team_points`,
`get_unique_disease_classifications`, `reset_academic_year`, `get_student_analytics`. Three
of these — `get_dashboard_stats`, `get_unique_disease_classifications`, and
`reset_academic_year` — have **no `CREATE FUNCTION` anywhere in the repo's 23 SQL scripts**;
they only exist in the live database. (`reset_academic_year` is additionally suspicious: the
only reset-shaped function actually defined in-repo is named `reset_academic_year_quotas`
and takes a year-string argument — see §3.2 — a different name and signature from what
`NewYearReset.jsx:21` calls with no arguments. I can't tell from the repo whether these are
the same function under two names, wrappers of each other, or a real mismatch.)

### 2.3 Authentication & session handling

- **`src/context/AuthContext.jsx`** is the single, central auth/session manager, mounted via
  `AuthProvider` in `src/main.jsx:11`. It runs a two-stage hydration (detailed in §4):
  Stage 1 (`:128-148`) listens to `onAuthStateChange` and sets the raw Supabase auth user;
  Stage 2 (`:151-167`) detects an un-hydrated user (`!user.name`) and fetches the full
  `profiles` row, quota data, and team via `fetchUserProfile()` (`:19-123`).
  - `login()` (`:171-176`) — `signInWithPassword`
  - `register()` (`:178-235`) — `signUp`, then a manual `profiles` insert (`:208-210`) since
    Supabase Auth doesn't store the app's custom fields
  - `logout()` (`:249-253`) — `signOut`; an earlier implementation is left dead and
    commented out just above it (`:237-248`)
  - `refreshUserProfile()` (`:254-262`) — calls `supabase.auth.getUser()` directly,
    bypassing the context's own hydration flow (see §4.5)
  - `updateFeedbackQuota()` (`:264-302`) — RPC `check_and_update_feedback_quota`
- **`src/pages/PaginaEsqueciPassword.jsx:24`** — `resetPasswordForEmail(...)`
- **`src/pages/PaginaUpdatePassword.jsx`** — its own, independent `getSession()` call
  (`:16`, redirects to `/login` if no session) and its own `onAuthStateChange` registration
  (`:28-32`) scoped to the `PASSWORD_RECOVERY` event, with a **local** `session` state
  separate from `AuthContext`. Cleaned up correctly (`:34`).
- **`src/services/api.js:17-28`** (`getUserData()`) — calls `supabase.auth.getSession()`
  independently on every chat/feedback send, reading `session.user.user_metadata.role`
  rather than the hydrated `AuthContext.user.role`. These two can disagree: `user_metadata`
  is seeded once at sign-up (`AuthContext.jsx:183-188`) and never updated if an admin later
  changes a user's role in `profiles` (see §5).
- **Route guards** — `src/App.jsx`'s `PrivateRoute` (`:12-22`) and `AdminRoute` (`:24-56`)
  redirect based on `AuthContext`'s `user`/`loading`. These are **UI convenience only**;
  they enforce nothing server-side. The real access boundary is RLS (§2.4).

Session persistence uses `supabase-js`'s default (localStorage-based); no custom storage
adapter is configured.

### 2.4 Row-level security (RLS)

There is no `docs/schema.sql` and no `supabase/migrations/` in this repo —
`supabase/config.toml:53` has `schema_paths = []`, confirming the CLI's migration-file
workflow was never adopted. RLS instead lives entirely in loose, hand-run SQL scripts at the
repo root (§3.4 has the full chronological list — 6 of the 23 files are full RLS rewrites).

**Latest-known helper functions** — `RLS_ROLE_MISMATCH_FIX_CORRECTED.sql` (verified by
direct read, 183 lines). Its own header explains why it exists: *"The RLS policies are
checking `auth.users.raw_user_meta_data->>'role'` but the actual role is stored in the
`profiles.role` column"* (`:4-6`) — i.e., every policy's role check had been silently broken
since the first RLS rewrite. It redefines, `SECURITY DEFINER`/`STABLE`:

- `public.is_admin()` (`:13-24`), `is_professor()` (`:27-38`), `is_student()` (`:41-52`),
  `is_admin_or_professor()` (`:55-66`) — all check `public.profiles.role` for `auth.uid()`.

**Per-table policies as *intended* by the last tracked rewrite** (from
`FINAL_RLS_OVERHAUL_SIMPLIFIED.sql`, 429 lines — the fullest tracked rewrite; not personally
re-verified line-by-line beyond spot checks, so treat exact line numbers as approximate).
**This table describes what the scripts intend, not what's live — see "Live RLS state"
below for the confirmed reality, which differs in important ways:**

| Table | Policy | Restriction |
|---|---|---|
| `profiles` | select (`:121`) | own row OR admin/professor |
| | update (`:127`) | own row OR admin |
| | insert (`:136`) | self only (`auth.uid() = id`) |
| `teams` | select (`:147`) | any authenticated user |
| | insert/update/delete (`:153,159,168`) | admin only |
| `chat_logs` | select (`:178`) | own rows OR admin/professor |
| | insert (`:184`) | `auth.uid() = user_id` |
| | update (`:190`) | own rows OR admin/professor |
| | delete (`:199`) | admin only |
| `feedback_validations` | select (`:209`) | admin/professor OR parent `chat_logs.user_id = auth.uid()` |
| | insert/update (`:220,226`) | admin/professor only |
| | delete (`:235`) | admin only |
| `comparative_chat_logs` | select/insert/update/delete (`:245,251,257,266`) | same pattern as `chat_logs` |
| `diseases` | select (`:276`) | any authenticated user |
| | insert/update/delete (`:282,288,297`) | admin only |

**`user_feedback_quotas`** RLS was added later, in `RLS_ROLE_MISMATCH_FIX_CORRECTED.sql`
(verified by direct read): select (`:150-153`) and insert (`:155-158`) and update
(`:160-166`) allow own row OR admin/professor; delete (`:168-171`) is admin only.
`TABLE_PERMISSION_FIX.sql` runs after this and adds plain `GRANT SELECT/INSERT/UPDATE ... TO
authenticated` statements — RLS policies are moot without the matching table grant, which
several earlier scripts apparently forgot.

**Background — why the table above isn't the whole story**: 6 total full-or-partial RLS
rewrites exist in-repo (`SECURITY_POLICIES_FIX.sql` → `RLS_RECURSION_FIX.sql` →
`BACKOFFICE_RLS_FIXES.sql` / `STUDENT_RLS_FIXES.sql` → `FINAL_RLS_OVERHAUL.sql` /
`FINAL_RLS_OVERHAUL_SIMPLIFIED.sql` → `COMPREHENSIVE_PERMISSION_AND_SCHEMA_FIX.sql` →
`RLS_ROLE_MISMATCH_FIX.sql` / `RLS_ROLE_MISMATCH_FIX_CORRECTED.sql`), most using
`CREATE POLICY` under **different policy names** without a matching `DROP POLICY` for those
specific names. Postgres allows multiple permissive policies per table/action to coexist
(they OR together) — so old policies don't get removed just because a newer script defines
a stricter-looking one.

#### Live RLS state — confirmed via `select * from pg_policies`, 2026-07-25

You ran this against the live project and shared the output. It confirms the concern above
was real: **policies from at least 4 different eras are simultaneously active on most
tables**, and on one table this creates a genuine, exploitable gap. Full breakdown:

**`feedback_validations` — the serious one.** Three leftover policies allow *any
authenticated user*, not just admins/professors, to touch *all* rows, not just their own:

| Live policy | Command | Condition |
|---|---|---|
| `feedback_validations_select_all` | SELECT | `auth.uid() IS NOT NULL` |
| `feedback_validations_insert_all` | INSERT | `auth.uid() IS NOT NULL` |
| `feedback_validations_update_all` | UPDATE | `auth.uid() IS NOT NULL` |

These coexist with the correctly-scoped policies (`feedback_validations_select_policy`,
`..._insert_policy` / `..._update_policy` restricted to `is_admin_or_professor()`, "Professors
can manage feedback validations", "Users can view feedback on their logs"). Because permissive
policies OR together, **the correct, narrower policies are moot for SELECT and INSERT/UPDATE — the
`_all` policies alone already permit any logged-in student to**:
- read every other student's/team's feedback validations (professor comments, validation
  status, points),
- **insert new `feedback_validations` rows themselves** (bypassing the professor-only
  `is_admin_or_professor()` check entirely), and
- **update `points_awarded` on any row, including rows tied to other teams' `chat_logs`** —
  which, via the `trigger_update_team_points` trigger (§3.2), directly moves `teams.points`
  and the leaderboard.

This is the one live-confirmed finding in this document I'd treat as urgent regardless of
what else you prioritize — it's a real, currently-active gap in the points/leaderboard
integrity model, not a documentation ambiguity. I haven't drafted a fix since you didn't ask
me to yet, but the shape of it is straightforward: `DROP POLICY` the three `_all` policies
once you've confirmed nothing in the app still depends on them.

**Smaller live-vs-intended differences** (lower stakes, but worth knowing):
- `diseases` and `teams` both still carry an `"Everyone can view <table>"` policy
  (`qual: true`, `roles: {public}`) alongside the newer `auth.uid() IS NOT NULL` versions —
  live SELECT on both tables is effectively open to anyone, not just authenticated users,
  though the sensitivity of that data is low.
- `teams` UPDATE is live as **admin OR professor**, not admin-only as
  `FINAL_RLS_OVERHAUL_SIMPLIFIED.sql` alone would suggest — an older `"Professors can update
  teams"` policy (`get_user_role(auth.uid()) = ANY(ARRAY['admin','professor'])`) is still
  active alongside `teams_update_policy` (`is_admin()`).
- `profiles` INSERT includes an `"Admin can insert profiles"` policy whose `with_check` is
  `get_user_role(auth.uid()) = ANY(ARRAY['admin','student','professor'])` — notably, this
  does **not** constrain the inserted row's `id` to `auth.uid()` the way the other three
  profile-insert policies do. Any already-registered student/professor/admin can insert a
  `profiles` row for an arbitrary `id`. Lower severity than the `feedback_validations` issue
  (it requires an existing `auth.users` row with no profile yet, and doesn't obviously let
  someone escalate their *own* role), but worth a look alongside the fix above.
- A fourth helper function, `get_user_role(uuid)`, is used throughout the older policies
  above and is clearly live, but — like `get_dashboard_stats`, `get_unique_disease_classifications`,
  and `reset_academic_year` (§2.2) — has **no `CREATE FUNCTION` anywhere in the repo's 23 SQL
  scripts**. It presumably predates `is_admin()`/`is_professor()`/`is_admin_or_professor()`
  and was superseded by them for new policies, without the old ones being cleaned up.
- Everything on `chat_logs`, `comparative_chat_logs`, and `user_feedback_quotas` is
  redundant-but-consistent — 3-5 policies per table/action from different eras, but they all
  converge on the same effective rule (own row, or admin/professor sees/edits all), so there's
  no live behavior gap there, just cleanup opportunity.
- `feedback_quotas` (the older, non-`user_`-prefixed table) **still has active RLS policies
  live** (`feedback_quotas_select_own`/`_insert_own`/`_update_own`, all scoped to
  `user_id = auth.uid()`) — meaning **the table itself still exists in production**,
  alongside `user_feedback_quotas`. See §3.4 for why this is likely the actual root cause of
  the quota problems you mentioned.

No code in `src/` references RLS at all (a repo-wide search turns up nothing but a
false-positive substring inside the word "URLs") — RLS is entirely a database-side concern,
invisible from the application code.

### 2.5 Storage / uploads

**Not used.** A repo-wide search for `.storage.`, `getPublicUrl`, `createSignedUrl`,
`createBucket` returns zero matches in `src/`. `supabase/config.toml:100-103` enables
storage (50MiB file-size limit) at the platform level, and the example bucket config is left
commented out (`:109-114`) — no bucket is actually configured. All images (bot avatars,
logos) are static bundled assets under `src/assets/` and `public/`.

### 2.6 Realtime subscriptions

**Not used.** A repo-wide search for `.channel(`, `postgres_changes` returns zero matches.
`supabase/config.toml:72-73` enables Realtime at the platform level, but the app never opens
a channel. The only `.subscribe()`/`.unsubscribe()` pairs in the codebase are the two
`onAuthStateChange` registrations (§2.3) — an auth event listener, not a Postgres Realtime
channel — and both are cleaned up correctly. Leaderboard, dashboard stats, and usage
monitoring are all one-shot queries on mount/filter-change, not push updates.

### 2.7 Edge functions

**None exist.** `supabase/functions/` is absent from the filesystem entirely, and a
repo-wide search for `supabase.functions.invoke(` returns zero matches.
`supabase/config.toml:304-312` enables `edge_runtime` at the platform level, and
`.vscode/settings.json` has Deno tooling pre-configured for a `supabase/functions` path —
suggesting edge functions were scaffolded in the editor at some point but never actually
created (or were removed before ever being committed).

**What the app uses instead**: all bot/LLM logic is delegated to externally-hosted **n8n**
workflows, called directly from the browser via `axios` — not through Supabase at all.
`src/config/bots.js` defines 5 bots, each with an endpoint:

| Bot | Phase | Requires | Endpoint (current) |
|---|---|---|---|
| `bot_junior` | 1 | none | `n8n.fmv.ulisboa.pt/webhook/b02fc3cb-...` (`:14`) |
| `bot_senior` | 2 | sheet submitted | `n8n.fmv.ulisboa.pt/webhook/eb8add01-...ab` (`:26`) |
| `bot_senior_v2` | 3 | sheet + review | `n8n.fmv.ulisboa.pt/webhook/eb8add01-...abc` (`:38`) |
| `bot_pubmed` | 3 | sheet + review | `n8n.fmv.ulisboa.pt/webhook/f889d515-...` (`:50`) |
| `bot_llm` | 3 | sheet + review | `n8n.fmv.ulisboa.pt/webhook/0cd725d3-...` (`:62`) |

Each entry has an old `manuelnunes.duckdns.org` URL commented out just above the live one —
confirmed by the most recent commit in the repo, `e8c6045 "changed the webhooks endpoints"`
(2026-04-12), which migrated these. **However**, `src/services/api.js:5-6`
(`CHAT_WEBHOOK_URL`/`FEEDBACK_WEBHOOK_URL`, used by `MyFeedback`-adjacent flows) **still
point at the old `manuelnunes.duckdns.org` host** — that migration commit missed this file.
`src/services/api.js:9` also hardcodes a plaintext webhook auth key,
`WEBHOOK_API_KEY = 'maria-secure-key-2024-supabase-v1'`, shipped in the client bundle (see
§5). Two more files, `src/config.js` and `src/config/webhooks.js`, each independently
define a `WEBHOOKS` object with yet more, differing n8n URLs, but neither is imported anywhere in
`src/` — dead, duplicate config (see §5).

Since there are no edge functions, no Supabase-hosted code calls out to an LLM — the n8n
workflows presumably do, but they live outside this repository and outside Supabase, so
their internals aren't inspectable from here.

---

## 3. Data model

### 3.0 Methodology note

**`docs/schema.sql` does not exist in this repo** (confirmed — no `docs/` folder exists at
all), and neither does `supabase/migrations/` (`supabase/config.toml:53`,
`schema_paths = []`). There is no `CREATE TABLE` for most core tables anywhere in the
repo — they were created directly via the Supabase Studio UI and never captured in source
control. The schema below is reconstructed from `ALTER TABLE` statements, RLS policy
definitions, function bodies, and the app's own `.select()`/`.insert()` call sites across 23
loose root-level `.sql` files (§3.4) plus `src/`. There is also **no TypeScript and no
generated Supabase types** (`supabase gen types` is not in any npm script) — so there is no
types file to cross-check against either; the closest thing to "the schema" living in this
repo is the reconstruction below, and it should be treated as best-effort, not authoritative.

### 3.1 Table inventory (reconstructed)

**`profiles`** (extends `auth.users`; the row is created by app code at sign-up —
`AuthContext.jsx:208-210` — not a DB trigger)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, = `auth.users.id` |
| `full_name`, `email` | TEXT | |
| `role` | TEXT | `'student' \| 'professor' \| 'admin'` — no CHECK/enum enforcing this |
| `student_number` | TEXT | |
| `team_id` | INT | FK → `teams.id`, nullable |
| `is_approved` | BOOLEAN | professors default `false` (need admin approval, `AuthContext.jsx:199`); students default `true` |
| `personal_points` | INT | `DEFAULT 0` |
| `feedback_junior_quota`, `feedback_senior_quota`, `feedback_arena_quota` | INT | `DEFAULT 5` each — later dropped by `NEW_YEAR_RESET.sql` in favor of the separate quota table(s) |

**`teams`**

| Column | Type | Notes |
|---|---|---|
| `id` | INT | PK |
| `team_name` | TEXT | unique in practice |
| `points` | INT | mutated by **both** a DB trigger and an RPC — see §3.2 and §5 |
| `assigned_disease_id` | INT | FK → `diseases.id` |
| `supervisor_id` | UUID | FK → `profiles.id` — **read by app code (`AuthContext.jsx:103`) but has no `CREATE`/`ALTER TABLE` anywhere in the repo's SQL** |
| `blue_team_review_target_id` | INT | read by `AuthContext.jsx:104`, reset by `NEW_YEAR_RESET.sql` — **also never created anywhere in tracked SQL** |
| `red_team_1_target_id`, `red_team_2_target_id` | INT | FK → `teams.id` (self-referential) |
| `has_submitted_sheet`, `has_submitted_review` | BOOLEAN | `DEFAULT FALSE` — **this is what the app actually reads** (`FrontOffice.jsx:25-26`, `AuthContext.jsx:107-108`) |
| `ficha_entregue`, `revisao_entregue` | BOOLEAN | `DEFAULT FALSE` — an earlier, Portuguese-named pair covering the same concept; not read by any app code found, but still **written by `NEW_YEAR_RESET.sql`** (see §5) |

**`diseases`**: `id` (PK), `name`.

**`chat_logs`**: `id` (PK), `user_id` (FK), `team_id`, `bot_id`, `question`, `answer`,
`feedback` (INTEGER, `1` = positive in view/function filters), `positive_feedback_details`
(JSONB, GIN-indexed), `source_bot` (`DEFAULT 'bot_junior'`), `points_eligible`
(`DEFAULT TRUE`), `created_at`.

**`comparative_chat_logs`** (Bot Arena votes): `id`, `user_id` (FK), `points_eligible`
(`DEFAULT TRUE`), `created_at`.

**`feedback_validations`**: `id`, `log_id` (FK → `chat_logs.id`), `professor_id` (FK →
`profiles.id`), `is_validated`, `points_awarded`, `comment` ("Professor comment on student
feedback"), `feedback_type` (**CHECK** `IN ('positive','negative')`, `database_updates.sql:6`),
`negative_reason` (**CHECK** `IN ('Resposta errada','Resposta incompleta','Resposta
desatualizada')`, `database_updates.sql:7`), `student_justification`, `validation_date`
(`DEFAULT NOW()`).

**`feedback_quotas`** vs **`user_feedback_quotas`**: two names for what looks like the same
evolving concept, defined incompatibly across at least 4 different script versions (§3.4).
The app never queries either directly — only through RPCs (§2.2). **Confirmed as the root
cause of the quota-management problems, 2026-07-25**: `select count(*)` against the live
project returned **291 rows in `feedback_quotas`, 0 rows in `user_feedback_quotas`**. That's
a clean, unambiguous confirmation of the write/read split suspected from the static analysis
below — this isn't a hypothesis anymore.

- **Write path**: `check_and_update_feedback_quota` (`COMPLETE_DATABASE_DEPLOYMENT.sql:110-159`),
  called on every real feedback submission via `AuthContext.jsx`'s `updateFeedbackQuota()`
  (`:264-302`), writes usage counts into `feedback_quotas` — hence its 291 real rows.
  `updateFeedbackQuota()` also updates local React state directly from this RPC's own
  response (`current_count`/`remaining`/`max_quota`, not the `get_user_feedback_quotas`
  shape), so **within a single session, right after submitting feedback, the on-screen quota
  is probably briefly correct.**
- **Read path**: `get_user_feedback_quotas` (`RLS_ROLE_MISMATCH_FIX_CORRECTED.sql:81-131`,
  verified directly) is called once at login/hydration (`AuthContext.jsx:47-63`) and reads
  from `user_feedback_quotas` — which has **zero rows, ever**. So on every fresh login or
  page reload, quota display resets to "nothing used" regardless of real history, on top of
  the separate `used_count`/array-shape bug already documented in §3.3 (which throws inside
  the `try`/`catch` and falls back to hardcoded defaults — so in practice the empty table is
  masked by that exception rather than ever being reached cleanly, but the net effect for the
  student is the same either way: **the number they see never reflects real usage**).
- Whether the 5-per-bot **enforcement** itself still works is a separate question from the
  **display** bug above: `check_and_update_feedback_quota` both reads and writes
  `feedback_quotas` for its own limit check, so if that RPC's internal logic is otherwise
  sound, blocking a 6th submission likely still works correctly even though the displayed
  count doesn't — worth confirming with a student account that has used all 5 of a bot.
- **Fix is a product decision, not something I've drafted**: either point
  `get_user_feedback_quotas` at `feedback_quotas` (keeping the 291 rows of real history), or
  migrate those 291 rows into `user_feedback_quotas` and repoint the write path instead —
  either way, the loser table's now-orphaned RLS policies (§2.4) should be dropped too.

### 3.2 Logic living in the database

- **The one real trigger** — `database_updates.sql:47-51` (verified by direct read), firing
  function `update_team_points()` (`:27-44`):
  ```sql
  CREATE OR REPLACE FUNCTION update_team_points()
  RETURNS TRIGGER AS $$
  BEGIN
      IF NEW.points_awarded != OLD.points_awarded AND NEW.log_id IS NOT NULL THEN
          UPDATE public.teams
          SET points = points + (NEW.points_awarded - OLD.points_awarded)
          WHERE id = (SELECT team_id FROM public.chat_logs WHERE id = NEW.log_id);
      END IF;
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trigger_update_team_points
      AFTER UPDATE ON public.feedback_validations
      FOR EACH ROW EXECUTE FUNCTION update_team_points();
  ```
  This fires whenever a professor changes `points_awarded` on a `feedback_validations` row.
- **`increment_team_points(team_id, points_to_add)`** — defined in
  `FINAL_RLS_OVERHAUL_SIMPLIFIED.sql:395-405`, `SECURITY DEFINER`, does
  `UPDATE teams SET points = COALESCE(points,0) + points_to_add`. Called explicitly from
  `FeedbackValidation.jsx`/`ArenaFeedbackValidation.jsx` in the same professor-scoring flow
  that updates `feedback_validations.points_awarded` — i.e., **the same action may fire both
  this RPC and the trigger above**. **You confirmed (2026-07-25) this was already mitigated**
  — I can't independently verify which side was disabled from static files (the `CREATE
  TRIGGER` statement is still sitting in `database_updates.sql`, but that only matters if the
  file is re-run), so treat the trigger's presence in tracked SQL as historical, not
  necessarily live. See §5.
- **`check_and_update_feedback_quota`** — `COMPLETE_DATABASE_DEPLOYMENT.sql:110-159`,
  enforces a hardcoded `max_quota INTEGER := 5` — the same "5" is independently hardcoded in
  `AuthContext.jsx:38` (`MAX_QUOTA = 5`), so the rule has to be kept in sync by hand in two
  places.
- **`get_student_analytics()`** — `FINAL_RLS_OVERHAUL_SIMPLIFIED.sql:332-392`,
  `SECURITY DEFINER`, joins `profiles`→`teams`→`diseases` and aggregates
  `chat_logs`/`feedback_validations` into per-student totals.
- **`get_current_curricular_year()`** — `corrected_feedback_quota_system.sql:37-49`,
  computes an academic-year string from `NOW()` (switching over in September). Later
  superseded by a hand-edited constant, e.g. `current_academic_year TEXT := '2024-2025'`
  (`COMPLETE_DATABASE_DEPLOYMENT.sql:74`, `yearly_feedback_quota_system.sql:23`), which has
  to be manually bumped each year — `NEW_YEAR_RESET.sql` calls
  `reset_academic_year_quotas('2025-2026')` for the (at the time) upcoming year. Given
  today's date, whether this has since been bumped to `'2026-2027'` anywhere live is exactly
  the kind of thing this doc can't see (§6).
- **Views**: `positive_feedback_analysis` (`COMPLETE_DATABASE_DEPLOYMENT.sql:217-238`,
  flattens the `positive_feedback_details` JSONB for reporting), `feedback_with_details`
  (`database_updates.sql:55-78`, joins `feedback_validations`+`chat_logs`+`profiles`+`teams`
  for the backoffice UI), `feedback_quota_status` (`feedback_quota_system.sql:75-106`,
  explicitly dropped by `NEW_YEAR_RESET.sql` — likely dead).
- **Check constraints**: only 2, both on `feedback_validations` (above,
  `database_updates.sql:6-7`).

Confirmed by grep: three RPCs the app calls — `get_dashboard_stats`,
`get_unique_disease_classifications`, `reset_academic_year` — have no `CREATE FUNCTION`
anywhere in the repo's SQL files. They exist only in the live database, which means the
tracked SQL is provably incomplete relative to what's actually deployed.

### 3.3 App-vs-schema cross-check

With no TypeScript and no generated types, "cross-checking types against schema" reduces to
comparing raw `.from()`/`.rpc()` call sites against the reconstructed schema. Two concrete
mismatches found:

1. **`get_user_feedback_quotas` return shape.** The latest tracked definition
   (`RLS_ROLE_MISMATCH_FIX_CORRECTED.sql:81-131`, verified by direct read) returns a single
   JSON **object** with only two keys, `bot_junior` and `bot_senior` (no `bot_arena` at
   all), each shaped `{ used, remaining, max }`:
   ```sql
   SELECT json_build_object(
       'bot_junior', json_build_object('used', ..., 'remaining', ..., 'max', 5),
       'bot_senior', json_build_object('used', ..., 'remaining', ..., 'max', 5)
   ) INTO result FROM ...
   ```
   But the caller (`AuthContext.jsx:52-63`) treats the result as an **array** and reads a
   field called **`used_count`**, which this version never produces:
   ```js
   quotaData.forEach(q => {              // .forEach on an object literal, not an array
     if (feedbackQuotas[q.bot_id]) {
       const used = q.used_count || 0;   // this key doesn't exist in the object above
   ```
   This is wrapped in a `try`/`catch` (`:64-66`) that only logs a warning, so it fails
   silently — the quota UI likely always shows the hardcoded defaults (5/5/5) rather than
   real remaining counts, and `bot_arena`'s quota specifically has no server-side source at
   all in this version of the function.
2. **Phantom columns**: `teams.supervisor_id` and `teams.blue_team_review_target_id` are
   read and reset by app code and reset scripts but have no `CREATE`/`ALTER TABLE` anywhere
   in the repo (§3.1) — added directly in Supabase Studio, never captured in source.

Core table names themselves (`profiles`, `teams`, `diseases`, `chat_logs`,
`comparative_chat_logs`, `feedback_validations`) are consistent between app code and the
SQL-derived schema — the drift is at the column/shape level, not table naming.

### 3.4 The 23 SQL scripts — chronological inventory

`git log --diff-filter=A` gives the exact commit that first added each file (more reliable
than filesystem mtimes). Grouped by commit:

| Commit | Date | Message | Files added |
|---|---|---|---|
| `a61cbd3` | 2025-08-12 02:57 | "Initial commit: Complete Zoolio application with all features" | `database_updates.sql`, `feedback_quota_system.sql`, `corrected_feedback_quota_system.sql`, `yearly_feedback_quota_system.sql`, `foreign_key_fix.sql`, `complete_foreign_key_fix.sql`, `positive_feedback_structure_update.sql`, `team_management_updates.sql` |
| `df14a0e` | 2025-08-12 03:59 | "FINAL DEPLOYMENT: Complete database script and deployment summary" | `COMPLETE_DATABASE_DEPLOYMENT.sql` |
| `5932914` | 2025-08-12 04:12 | "CRITICAL FIX: Loading screen issue resolved" | `SECURITY_POLICIES_FIX.sql` |
| `3d661f1` | 2025-08-12 04:21 | "CRITICAL FIX: RLS Infinite Recursion Error Resolved" | `RLS_RECURSION_FIX.sql` |
| `48eb19b` | 2025-08-12 11:40 | "Fix Function Drop Error in Backoffice RLS Script" | `BACKOFFICE_RLS_FIXES.sql` |
| `ef21b40` | 2025-08-12 11:48 | "Fix Student Feedback 500 Errors - Complete RLS Solution" | `STUDENT_RLS_FIXES.sql` |
| `1b3e1a3` | 2025-08-12 18:41 | "feat: Enhance feedback validation UI and fix leaderboard highlighting" | `COMPREHENSIVE_PERMISSION_AND_SCHEMA_FIX.sql`, `FINAL_RLS_OVERHAUL.sql`, `FINAL_RLS_OVERHAUL_SIMPLIFIED.sql`, `TEAM_MANAGEMENT_MISSING_COLUMNS_FIX.sql` |
| `4566a4d` | 2025-08-13 02:12 | "Fix: Corrected blue team outline display in Bot Senior" | `ADD_MISSING_TEAM_COLUMNS.sql`, `NEW_YEAR_RESET.sql`, `REINITIALIZE_QUOTAS.sql`, `RLS_ROLE_MISMATCH_FIX.sql`, `RLS_ROLE_MISMATCH_FIX_CORRECTED.sql`, `TABLE_PERMISSION_FIX.sql` |

Note that the *initial* commit already added 8 scripts together — this repo's git history
starts mid-project, so commit order for that first batch doesn't reflect true authorship
order. The commit messages from `5932914` onward tell their own story: "CRITICAL FIX:
Loading screen issue resolved" → "CRITICAL FIX: RLS Infinite Recursion Error Resolved" →
"Fix Function Drop Error..." → "Fix Student Feedback 500 Errors..." — each fixing a
production incident caused by the previous script, all within about 30 hours.

**Concrete conflicts across these files:**

- **Quota scheme, redefined at least 4 times**: `feedback_quota_system.sql` stores quotas as
  3 extra columns on `profiles`; `corrected_feedback_quota_system.sql` (same commit) instead
  creates a separate `feedback_quotas` table keyed `(user_id, bot_id, curricular_year)` and
  drops the profile-column approach; `COMPLETE_DATABASE_DEPLOYMENT.sql` redefines
  `feedback_quotas` a third way, keyed `(user_id, bot_id, academic_year)`, FK'd to
  `auth.users` instead of `profiles`; `RLS_ROLE_MISMATCH_FIX_CORRECTED.sql` redefines
  `get_user_feedback_quotas()` a fourth way to read from yet another table,
  `user_feedback_quotas`, keyed on integer `quota_year`. Since every version uses `CREATE OR
  REPLACE`/`ADD COLUMN IF NOT EXISTS`, whichever was last run by hand against the live
  database wins — **not determinable from the files themselves** (§6).
- **`ficha_entregue`/`revisao_entregue` vs `has_submitted_sheet`/`has_submitted_review`**:
  `ADD_MISSING_TEAM_COLUMNS.sql` adds the first (Portuguese) pair;
  `team_management_updates.sql`/`TEAM_MANAGEMENT_MISSING_COLUMNS_FIX.sql`/
  `COMPLETE_DATABASE_DEPLOYMENT.sql` separately add the second pair, which is what
  `FrontOffice.jsx:25-26` and `AuthContext.jsx:107-108` actually read. But
  `NEW_YEAR_RESET.sql` resets **`ficha_entregue`/`revisao_entregue`** — the columns the app
  doesn't read — meaning that if it's run as-is, team progress flags as seen by the app
  would not actually reset for the new year (see §5).
- **RLS rewritten 6 times** (§2.4), each one's own comments citing "infinite recursion" or
  "500 errors" in the version before it; policy names collide across files (e.g. `"Users can
  view own profile"` is dropped and recreated under different definitions in at least 4
  files).

---

## 4. Client state initialization & lifecycle

No data-fetching library is used anywhere — confirmed by dependency list and by grep
(`useQuery`/`useSWR`/`redux`/`zustand` all return zero matches). State is 100% React Context
(`AuthContext`) + local `useState`/`useEffect` + direct `supabase-js` calls per component,
with no shared cache.

### 4.1 On mount

- `src/main.jsx` — no effects, just renders the provider tree.
- `src/App.jsx` — no effects; only reads `loading`/`user` from `useAuth()` to gate rendering
  (`:58-86`) and defines the two route guards.
- `src/context/AuthContext.jsx` — the actual initialization point, a two-stage hydration:
  - **Stage 1** (`:128-148`, deps `[]`) — registers `onAuthStateChange`; on any event, sets
    `user` to the **raw** Supabase auth-user object (or `null`) and `loading = false`.
    Cleaned up via `subscription?.unsubscribe()` (`:143-147`).
  - **Stage 2** (`:151-167`, deps `[user]`) — fires whenever `user` changes. If `user` is
    truthy but "raw" (detected via `!user.name` — the raw auth object has no `.name` field),
    calls `fetchUserProfile(user)` (`:19-123`) and replaces `user` with the hydrated result,
    which re-runs this same effect (now a no-op, since the hydrated object has `.name` set).
    This is an **implicit two-stage state machine driven by object shape**, not an explicit
    `isHydrated` flag — see §5 for the fragility this creates.
  - `fetchUserProfile()` itself, in order: `profiles` select (`:23-27`) → sign-out-and-abort
    on error (`:31-33`) → default quota object (`:38-43`) → for students, RPC
    `get_user_feedback_quotas` (`:47-63`, the mismatch from §3.3) → for team members, a
    joined `teams`+`diseases` select (`:91-95`).
- No other root-level component runs anything on mount — no service-worker registration, no
  analytics init, no separate "app init" component.

### 4.2 Auth state change

Exactly two `onAuthStateChange` registrations exist (confirmed by grep):

1. `AuthContext.jsx:132-141` — the primary, app-wide one (Stage 1 above). Lives for the
   app's whole lifetime; cleaned up only if `AuthProvider` itself unmounts.
2. `PaginaUpdatePassword.jsx:28-32` — page-scoped, reacts only to the `PASSWORD_RECOVERY`
   event (the Supabase magic-link/recovery-token flow), writing to its own **local** state,
   independent of `AuthContext`. Cleaned up correctly (`:34`).

`login()`/`logout()` both rely on Stage 1 firing afterward — the code's own comments say
"This will trigger onAuthStateChange, which handles the rest" (`:172,250`) — confirming the
intended design is single-source-of-truth via that one listener.
`refreshUserProfile()` (`:254-262`) breaks this pattern by calling `getUser()` directly (§4.5).

### 4.3 Window focus / visibilitychange

**None found.** A grep for `visibilitychange`, `addEventListener('focus'`,
`refetchOnWindowFocus` across `src/` returns zero matches. There is no focus- or
visibility-driven refetching anywhere in this app. The only staleness mitigation is the
blunt, global no-cache headers on every Supabase request (`supabaseClient.js:6-14`) —
there's no real invalidation strategy, just cache-busting at the HTTP layer.

### 4.4 What triggers refetches / resets

No shared query cache exists. The pattern, repeated independently per component, is local
`useState` + `useEffect` + a direct `supabase` call. Confirmed exhaustively by grep: 41
occurrences of `useEffect` across 18 files in `src/`, of which 18 are the import statement
itself and 23 are actual `useEffect(...)` call sites — matching one-for-one with the mount-
or dependency-triggered fetches below:

| File | Deps | Fetches |
|---|---|---|
| `context/AuthContext.jsx:128` | `[]` | auth listener (§4.1/4.2) |
| `context/AuthContext.jsx:151` | `[user]` | profile hydration (§4.1) |
| `pages/BackOffice.jsx:104` | `[]` | `rpc('get_dashboard_stats')` |
| `pages/MyFeedback.jsx:13` | `[user, filter, botFilter]` | `chat_logs`, `comparative_chat_logs`, `profiles` |
| `pages/PaginaUpdatePassword.jsx:13` | `[navigate]` | `getSession()` + auth listener (§4.2) |
| `components/BotSeniorChat.jsx:46` | `[]` | `diseases` (disease-status panel) |
| `components/ProgressLeaderboard.jsx:16` | `[user]` | `teams`, `chat_logs`, `comparative_chat_logs` |
| `components/backoffice/ArenaFeedbackValidation.jsx:19,23` | `[]`, `[filters]` | `teams`/`comparative_chat_logs`/`profiles` |
| `components/backoffice/DiseaseManagement.jsx:12` | `[]` | `diseases` |
| `components/backoffice/FeedbackValidation.jsx:29,33` | `[]`, `[filters]` | `teams`, `chat_logs`, `comparative_chat_logs`, `feedback_validations`, `profiles`, RPC |
| `components/backoffice/StudentAnalytics.jsx:42` | `[]` | RPC + `teams` |
| `components/backoffice/TeamManagement.jsx:19` | `[]` | `teams`, `diseases`, `profiles` |
| `components/backoffice/UsageMonitoring.jsx:134` | `[filters]` | `chat_logs`, `comparative_chat_logs`, `teams`, RPC |
| `components/backoffice/UserApprovals.jsx:10` | `[]` | `profiles` |

Because `FrontOffice.jsx`'s tab switcher (`renderTabContent`, `:98-125`, verified by direct
read) is a plain `switch` that mounts/unmounts whichever tab component is active, **switching
tabs remounts the destination component and re-runs its `[]` effect from scratch** — leaving
and returning to "Bot Senior" re-runs `loadDiseaseStatus()` every time, leaving and returning
to "Progresso" re-runs the full leaderboard query every time. Component remounting via
navigation is the de facto refetch mechanism in this app — there is no time- or focus-based
invalidation (§4.3). `BotArena.jsx` and `BotJuniorChat.jsx` have no mount-time fetch at all —
they depend entirely on `AuthContext`'s `user`/`user.team` already being hydrated.

### 4.5 Duplicated / racy / inconsistent state

1. **Hydration state is sniffed from object shape, not an explicit flag**
   (`AuthContext.jsx:154`, `if (user && !user.name)`). If `profiles.full_name` were ever
   null/empty, a hydrated user would still look "raw" and Stage 2 would re-run
   `fetchUserProfile` in a loop.
2. **Auth state is read from at least three independent places**: `AuthContext`'s
   `onAuthStateChange` (canonical, feeds `user`); `refreshUserProfile()`'s direct
   `getUser()` call (`:256`, bypasses the context's own state); `services/api.js`'s
   `getUserData()` (`:17-18`), which re-derives role/name from raw session `user_metadata`
   on every chat/feedback send rather than reusing the already-hydrated `AuthContext.user`
   — these two can disagree once a role changes post-signup (§2.3). Plus
   `PaginaUpdatePassword.jsx`'s own independent `getSession()`/`onAuthStateChange` pair.
3. **Dead/orphaned duplicate chat implementations**: `src/pages/PaginaChat.jsx` and
   `src/components/ZoolioChat.jsx` both implement a full chat flow duplicating
   `BotJuniorChat.jsx`/`BotSeniorChat.jsx`. `PaginaChat` is still imported in `App.jsx:6`,
   but the `/chat` route renders `<Navigate to="/" />` instead (`App.jsx:105-112`) — imported
   but unreachable. Neither `<PaginaChat` nor `<ZoolioChat` appears anywhere else in `src/`.
   Leftovers from the app's original "MarIA" incarnation (first commit, 2025-08-07).
4. The `get_user_feedback_quotas` shape mismatch (§3.3) is as much a state-init bug as a
   schema issue — it directly determines what quota numbers land in `AuthContext.user` on
   every login.
5. **Two independent "award points" paths** (§3.2) — the DB trigger and the
   `increment_team_points` RPC both fire from the same professor action. Confirmed
   already mitigated as of 2026-07-25 (§3.2) — kept here as a record of the original concern.

---

## 5. Fragile, dead, duplicated, inconsistent — ranked

*Updated 2026-07-25 with live confirmation from you — items are marked CRITICAL, RESOLVED,
or DECIDED below where that status is known.*

1. **CRITICAL — Live RLS gap on `feedback_validations`** (security/integrity — confirmed
   live, §2.4). Three leftover policies (`feedback_validations_select_all`/`_insert_all`/
   `_update_all`, all just `auth.uid() IS NOT NULL`) let any authenticated student read every
   other student's feedback validations, insert new ones, and update `points_awarded` on
   *any* row — which moves `teams.points` via the trigger. This is the one item in this list
   I'd treat as urgent independent of anything else.
2. **CONFIRMED — quota display reads an empty table.** `feedback_quotas` has 291 real rows;
   `user_feedback_quotas` has 0 (row counts confirmed 2026-07-25, §3.1) — the write RPC and
   the read RPC target different tables, so the quota shown to students never reflects real
   usage. This is the actual, confirmed root cause of the quota-management trouble you
   mentioned. Fixing it is a product decision (repoint the read, or migrate the data) — see
   §3.1 for detail.
3. **Stale Supabase project fallback** (correctness/security). `src/supabaseClient.js:3-4`
   hardcodes a fallback URL/anon key for project `bhpelimxagpohziqcufh`, while the
   production project is confirmed as `bqdirpftoebxrsulwcgu` (also matches the connection
   string you shared, §6). The committed `.env` and the hardcoded fallback both still point
   at the stale project; only the gitignored `.env.local` and Netlify's dashboard config
   point at the real one. If env vars are ever missing, the app silently talks to the wrong
   project instead of failing loudly.
4. **Smaller live RLS looseness** (§2.4): `diseases`/`teams` SELECT is effectively open to
   anyone (leftover `qual: true` policies); `teams` UPDATE live allows professors, not just
   admins; `profiles` INSERT has a policy that doesn't restrict the inserted `id` to the
   caller's own.
5. **RESOLVED — Double-award of team points** — DB trigger + `increment_team_points` RPC
   both used to add to `teams.points` from the same professor action. **You confirmed this
   is already mitigated** — kept here as a record, not an action item.
6. **Hardcoded webhook API key in the client bundle** (security). `src/services/api.js:9` —
   `WEBHOOK_API_KEY = 'maria-secure-key-2024-supabase-v1'`, shipped in plaintext to every
   browser. **You said**: keep for now, storage approach will change later.
7. **Incomplete webhook host migration**. `src/config/bots.js` migrated all 5 bot endpoints
   to `n8n.fmv.ulisboa.pt` (most recent commit, `e8c6045`), but `src/services/api.js:5-6`
   still points at the old `manuelnunes.duckdns.org` host.
8. **Feedback quota display likely always shows defaults** — return-shape mismatch between
   `get_user_feedback_quotas` and `AuthContext.jsx:52-63` (§3.3), silently swallowed by a
   `try`/`catch`. Likely a symptom of item 2 above, not a separate root cause.
9. **Two dead, unused webhook config files** — `src/config.js` and `src/config/webhooks.js`
   each export a `WEBHOOKS` object; neither is imported anywhere in `src/`.
10. **Two dead/unreachable chat components** — `PaginaChat.jsx` (imported but routed to a
    `Navigate`) and `ZoolioChat.jsx` (never rendered), both duplicating logic that lives for
    real in `BotJuniorChat.jsx`/`BotSeniorChat.jsx`. **You said**: keep for now, just in case.
11. **Shadow/duplicate team columns**: `ficha_entregue`/`revisao_entregue` vs
    `has_submitted_sheet`/`has_submitted_review` — the app reads only the latter, but
    `NEW_YEAR_RESET.sql` resets only the former, so running it as-is likely does not reset
    what the app actually checks.
12. **Phantom columns**: `teams.supervisor_id` and `teams.blue_team_review_target_id` are
    read/written by app code and reset scripts but have no `CREATE`/`ALTER TABLE` anywhere in
    tracked SQL.
13. **23 unordered, partly-conflicting SQL scripts with no migration tool** — the quota
    scheme was redefined at least 4 incompatible ways, and RLS was fully rewritten 6 times,
    each rewrite's commit message describing a production incident caused by the last one.
14. **Stale `README.md`** — still describes a pre-teams/bots "MarIA Chat" app on React 18
    with a project structure that predates the current feature set (actual: React 19.1,
    per `package.json:21`).
15. **Implicit, shape-sniffed auth hydration state machine** (`AuthContext.jsx:154`) — see
    §4.5 for the failure mode this could produce.
16. `reset_academic_year()` (called with no args from `NewYearReset.jsx:21`) doesn't match
    the name/signature of the only reset-shaped function in tracked SQL
    (`reset_academic_year_quotas(year text)`). **You said**: honestly not sure yet — a proper
    "start new academic year" function needs to be defined; treat the current button as
    unverified rather than trustworthy until that's done.

---

## 6. Open questions

Most of these were open after the static-analysis pass and have since been answered or
partly answered directly by you (2026-07-25) — kept here as a running record, with what's
still actually open marked accordingly.

1. **RESOLVED** — Which quota scheme is live? `feedback_quotas` (291 rows, real usage
   history) is the one actually written to; `user_feedback_quotas` (0 rows) is the one the
   display reads from — confirmed 2026-07-25 (§3.1/§5#2). **Still open**: which of the two to
   standardize on going forward (repoint the read RPC to keep the 291 rows of history, or
   migrate that history into `user_feedback_quotas` and repoint the write RPC instead), and
   whether the 5-per-bot enforcement itself is still working correctly given it's
   self-consistent against `feedback_quotas` (§3.1).
2. **RESOLVED** — Which RLS rewrite is live, and are stale policies still active alongside
   it? Answered via the `pg_policies` dump you ran; full breakdown in §2.4. Short version:
   policies from at least 4 eras coexist on most tables, and on `feedback_validations` this
   creates a real gap (§5#1).
3. **RESOLVED** — Double team-points award: confirmed already mitigated.
4. **RESOLVED** — Is the stale Supabase project still relevant? You shared the current
   connection string (`db.bqdirpftoebxrsulwcgu.supabase.co`), confirming
   `bqdirpftoebxrsulwcgu` is the one that matters. **Still technically open**: whether
   `bhpelimxagpohziqcufh` (referenced in the committed `.env` and the code fallback) is fully
   decommissioned or still holds old data — doesn't block anything, just worth a cleanup pass
   on the fallback value either way.
5. **DECIDED** — `PaginaChat.jsx`/`ZoolioChat.jsx`: keep for now, per you.
6. **DECIDED** — `WEBHOOK_API_KEY`: keep for now; storage approach will change later, per you.
7. **OPEN** — Academic year rollover: per you, still to be defined — a proper "start new
   academic year" function/process is needed. Until then, treat `NewYearReset.jsx`'s
   `reset_academic_year()` call as unverified (§5#16), and note it resets the shadow
   `ficha_entregue`/`revisao_entregue` columns rather than the ones the app reads (§3.4) —
   worth folding into whatever the new process ends up being.
8. **OPEN** — Do you want the 23 root SQL scripts consolidated into a proper
   `supabase/migrations/` history going forward? `supabase/config.toml` already has the CLI
   scaffolding for this (`schema_paths`) but it's unused.
9. **OPEN, new from the `pg_policies` review** — Do you want a cleanup pass that drops the
   superseded/leftover policies identified in §2.4 (the `feedback_validations` ones
   urgently, the `diseases`/`teams`/`profiles` ones opportunistically) once you've confirmed
   nothing depends on them?

---

*Note on scope: during investigation, a second, unrelated project also named "Zoolio"
(`zoolio_fmv`, an Express + Prisma + Vite app with a `server.ts`/`createViteServer`/PM2 setup
and no Supabase usage) was found outside this repo, on a different GitHub account. It is not
covered by this document, per your instruction to document only `zoolio-app`.*
