# CLAUDE.md

This file gives Claude Code (and any other contributor) the practical facts needed to work
in this repo: stack, how to run/build/deploy it, and conventions. For the full technical
picture — every Supabase usage, the reconstructed data model, client state lifecycle, and a
list of known-fragile spots — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What this is

Zoolio (internally still called "MarIA" in some legacy files) is a veterinary-education
chatbot platform, built for FMV-ULisboa. Students in teams work through progressively
unlocked bots — Bot Junior, then Bot Senior (unlocked after the team submits its disease
sheet), then Bot Arena (three senior-tier bots answering side by side, unlocked after the
team submits its peer review) — and rate the answers they get. Professors validate that
feedback and award points; an admin backoffice manages teams, diseases, user approvals, and
year-end resets. See `src/config/bots.js` for the exact unlock rules and
`docs/ARCHITECTURE.md` §3 for the full data model behind teams/diseases/points.

## Stack

| Layer | Choice | Source |
|---|---|---|
| Frontend | React 19.1, plain JSX (no TypeScript anywhere in `src/`) | `package.json:21-22` |
| Build tool | Vite 7.0.4, via `@vitejs/plugin-react-swc` (SWC, not Babel) | `package.json:32,37` |
| Styling | Tailwind CSS 4.1.11, via `@tailwindcss/vite` | `package.json:15,26` |
| Routing | react-router-dom 7.7.1 | `package.json:25` |
| Backend-as-a-service | `@supabase/supabase-js` 2.53.0 — the only backend; there is no custom server | `package.json:13` |
| External LLM/chat logic | n8n webhooks, called directly from the browser (not through Supabase) | `src/config/bots.js`, `src/services/api.js` |

There is no `server.ts`, no Express, no PM2 anywhere in this repo — see
`docs/ARCHITECTURE.md` §1 for the full explanation of the dev/build/serve pipeline.

## Development

```bash
npm install
npm run dev      # vite — dev server (package.json:7)
```

Env vars (no `.env.example` exists — create `.env.local` yourself):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Gotcha:** `src/supabaseClient.js:3-4` hardcodes fallback values that point at a
*different, apparently stale* Supabase project (`bhpelimxagpohziqcufh`) than the one
actually live in production (`bqdirpftoebxrsulwcgu` — see `netlify.toml:14,18`). If
`.env.local` is missing or incomplete, the app will silently start talking to the wrong
project instead of failing loudly. Always confirm your local env vars match the production
project before debugging data issues.

**Gotcha:** `supabase/config.toml:19` allow-lists CORS for `http://localhost:5178`, not
Vite's default `5173`. If you run local Supabase services and hit CORS errors, check which
port `vite` actually bound to.

## Build & preview

```bash
npm run build     # vite build → dist/ (package.json:8)
npm run preview   # serve the built dist/ locally (package.json:10)
```

Single build step — there's no server to build separately, and no `tsc` compile step (this
is JS/JSX). Output directory is Vite's default `dist/`, confirmed by `netlify.toml:2`
(`publish = "dist"`).

## Lint

```bash
npm run lint      # eslint . (package.json:9)
```

Flat config at `eslint.config.js`, extending `js.configs.recommended` +
`eslint-plugin-react-hooks` (recommended-latest) + `eslint-plugin-react-refresh` (vite
preset). The only customized rule is `no-unused-vars`, which ignores identifiers matching
`^[A-Z_]` (`eslint.config.js:25-27`).

## Deploy

Static hosting on **Netlify**, driven entirely by `netlify.toml`: build command
`npm run build`, publish dir `dist`, Node 18. Production and deploy-preview contexts each
set `VITE_SUPABASE_URL` in `netlify.toml:14,18`; `VITE_SUPABASE_ANON_KEY` is set directly in
the Netlify dashboard (not in the repo — see the comments at `netlify.toml:15,19`). There is
no CI/CD config (`.github/workflows` does not exist) and no PM2/Docker — Netlify's own
build-on-push is the only pipeline.

**Database changes are not automated.** There's no `supabase/migrations/` folder in use
(`supabase/config.toml:53` has `schema_paths = []`). Schema and RLS changes are 23 loose
`.sql` files at the repo root, meant to be pasted into Supabase's SQL Editor by hand.
`DEPLOYMENT_GUIDE.md` documents a run order for 5 of them (`database_updates.sql`,
`feedback_quota_system.sql`, `yearly_feedback_quota_system.sql`,
`positive_feedback_structure_update.sql`, `team_management_updates.sql`), but the full set's
true executed order/live state can't be confirmed from the repo — see
`docs/ARCHITECTURE.md` §3 before touching anything schema- or RLS-related.

## Conventions

- **One shared Supabase client.** `src/supabaseClient.js` is instantiated once and imported
  everywhere (`import { supabase } from '../supabaseClient'`). Don't create a second client;
  there's exactly one in the whole codebase, using only the anon key (no service_role key
  appears anywhere in client code — that's correct and should stay that way).
- **RLS is the real security boundary**, not the UI. `PrivateRoute`/`AdminRoute` in
  `src/App.jsx:12-56` are convenience redirects driven by client-side state — they improve
  UX but enforce nothing. Anything security-sensitive must be enforced by a Postgres RLS
  policy, not by hiding a route.
- **Language mix**: UI copy and some business-logic strings (error messages, disease/reason
  enums) are in Portuguese; most code identifiers are in English, but a few DB columns are
  Portuguese (`ficha_entregue`, `revisao_entregue` — see the fragility note in
  `docs/ARCHITECTURE.md` §5 about these being superseded, unread shadow columns).
- **No data-fetching library.** No React Query/SWR/Redux/Zustand — every component fetches
  its own data with local `useState`/`useEffect` + a direct `supabase` call. See
  `docs/ARCHITECTURE.md` §4 before assuming any cross-component cache exists.

## Known gotchas (see docs/ARCHITECTURE.md §5 for full detail on each)

1. **CRITICAL — live RLS gap, confirmed 2026-07-25**: three leftover Postgres policies on
   `feedback_validations` (`..._select_all`/`_insert_all`/`_update_all`, condition is just
   "logged in") let any authenticated student read, insert, and update *any* feedback
   validation row — including `points_awarded`, which moves the leaderboard via a trigger.
   Treat this as the top-priority item in this repo right now, independent of anything else.
   See `docs/ARCHITECTURE.md` §2.4/§5.
2. **CONFIRMED — quota display reads an empty table**: `feedback_quotas` has 291 real rows,
   `user_feedback_quotas` has 0 (checked 2026-07-25) — the write RPC and read RPC target
   different tables, so students never see their real quota usage. See
   `docs/ARCHITECTURE.md` §3.1/§5.
3. Stale Supabase project fallback in `supabaseClient.js` (above).
4. `src/services/api.js:9` ships a webhook API key in plaintext in the client bundle (known,
   being addressed later).
5. `src/services/api.js:5-6` and `src/config/bots.js` point at two different webhook hosts —
   one migrated to `n8n.fmv.ulisboa.pt`, the other still on the old `duckdns.org` domain.
6. The student-facing feedback quota display likely always shows hardcoded defaults rather
   than real counts, due to a return-shape mismatch between the SQL function and the
   JS code that reads it (`AuthContext.jsx:52-63`) — likely a symptom of #2 above.
7. `README.md` is stale — it still describes a pre-teams/bots "MarIA Chat" app on React 18
   (actual: React 19.1, per `package.json:21`).

Team points being double-awarded (trigger + RPC) was flagged in the original pass but has
since been confirmed already mitigated — not an action item.

## Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — full stack/build details, every Supabase
  usage grouped by capability, the reconstructed data model, client state lifecycle, and the
  complete fragile/dead/duplicated-code inventory.
- `DEPLOYMENT_GUIDE.md`, `BACKOFFICE_DEPLOYMENT_GUIDE.md` — historical deployment notes
  (Netlify + Supabase SQL Editor steps).
