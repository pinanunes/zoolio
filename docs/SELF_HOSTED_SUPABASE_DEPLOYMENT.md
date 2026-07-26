# Self-Hosted Supabase Deployment — Debian Production Server

Runbook for standing up self-hosted Supabase (Docker Compose, official
`supabase/supabase` setup) alongside the existing services already running on the
FMV-ULisboa Debian production server, as part of migrating `zoolio-app` off
Netlify + Supabase Cloud before the ~September 2026 academic year deadline.

This document records both **what to run** (so it's repeatable) and **what we
found on this specific server** (so it's a decision record, not just generic
instructions). Status as of 2026-07-25: backup in progress; installation steps
below are prepared but not yet executed.

Feasibility was validated first on a local dev machine (Windows, Docker
Desktop) — real production schema imported, real app frontend logged in and
worked against it end-to-end, a real bug (`check_and_update_feedback_quota`
NULL-propagation on first-ever feedback per bot) was found and fixed there,
then deployed to production. See `docs/ARCHITECTURE.md` for the application
side of this project.

---

## Server context (confirmed facts, 2026-07-25)

- Debian GNU/Linux 13 (trixie), Docker 28.4.0, Docker Compose v2.39.2.
- Hostname `IAAPPS`, admin user `tnunes` (has sudo, not in the `docker` group
  yet — every Docker command below is `sudo`-prefixed accordingly).
- Root filesystem `/dev/mapper/IAAPPS--vg-root`, single LVM volume group
  `IAAPPS-vg` (930.36G), **0 bytes free in the VG** (`root` 910.37G + `swap_1`
  19.99G consume all of it) — **no LVM snapshot is possible**. The root
  filesystem itself has ~634G free for regular files (backups, new images),
  this is only about the VG having no room for a *new logical volume*.
- Existing Docker Compose project name: **`tnunes`** (not `supabase` — no
  volume-naming collision with the new stack, which uses an explicit
  `name: supabase` in its own compose file).
- Existing volumes: `tnunes_n8n_data` (~10.5G), `tnunes_portainer_data`
  (~788KB), `tnunes_postgres_data` (**~191G**), `tnunes_qdrant_data` (~6.1G).
- Existing network: `my_app_network`.
- nginx runs **natively** (systemd service, not containerized), bound to the
  public IP `193.136.99.10:443`, active for 1+ month — handles TLS for
  whatever's already public (n8n, presumably). Not yet wired to anything
  Supabase-related.
- Port scan: only `5432` (existing n8n/shared Postgres, IPv4+IPv6) and `443`
  (nginx) were in use. `8000`, `8443`, `5433`, `6543`, `3000` were all free —
  only the Postgres port needs remapping for the new stack.
- **`iptables -L -n` shows `Chain INPUT (policy ACCEPT)`** — no default-deny,
  port-based firewall. The only rules are a blocklist of ~28 specific IPs
  (likely already-observed hostile scanners). This means any port a container
  publishes to `0.0.0.0` is immediately internet-reachable. See Phase 2.4 —
  the new stack's ports are bound to `127.0.0.1` only rather than relying on
  (or risking a mistake in) the existing iptables rules.

### Important: `tnunes_postgres_data` is a shared, multi-tenant Postgres instance

This is **not** just n8n's database. Databases found inside it:

| Database | Size | Notes |
|---|---|---|
| `wahis` | **173 GB** | World Animal Health Information System — unrelated institutional system, owned/managed by the same admin (`tnunes`) but has nothing to do with n8n or Zoolio |
| `n8n_db` | ~4.9 GB | n8n's actual own data |
| `zoolio2` | 31 MB | Unidentified — possibly related to the separate `zoolio_fmv` project's staging deployment, not confirmed |
| `zoolio` | 10 MB | Unidentified, same caveat as above |
| `auditorias_seguranca_alimentar` | 8.4 MB | Unrelated institutional system (food safety audits) |
| `audit_ai` (×2, near-duplicate names) | 14 MB / 7.6 MB | Unrelated institutional system |
| `template1`, `template0`, `postgres` | ~7.5 MB each | Postgres system databases, not user data |

**Decision**: the new self-hosted Supabase stack brings its own separate
`supabase-db` container and volume — it never touches this shared `postgres`
container or any database inside it. So backup scope is deliberately
**limited to `n8n_data` (volume) + a targeted `pg_dump` of `n8n_db` only** —
not a full `pg_dumpall`, which would needlessly copy 173GB+ of unrelated
institutional data that isn't at risk from this change and isn't ours to be
duplicating. All four existing volumes are still tarred as a general
precaution before touching the shared host at all (see Phase 1).

---

## Phase 0: Pre-flight reconnaissance (already run)

```bash
cat /etc/os-release | grep -E "^(NAME|VERSION)="
docker --version
docker compose version
free -h
df -h /
ss -tlnp | grep -E ":(80|443|8000|8443|5432|5433|6543|3000)\b"
docker compose config --format json | grep -E '"name"|COMPOSE_PROJECT_NAME'   # run from the compose directory
sudo docker volume ls
sudo docker compose ps                                                        # run from the compose directory
docker ps -a --format '{{.Names}}\t{{.Image}}' | grep -i nginx
which nginx && systemctl status nginx --no-pager
sudo docker system df -v | grep -E "portainer_data|n8n_data|postgres_data|qdrant_data"
sudo vgs
sudo lvs
sudo ufw status verbose 2>/dev/null || sudo iptables -L -n | head -30
```

Database sizes inside the shared Postgres instance:
```bash
set -a; source .env; set +a   # from the existing compose directory, where the real .env lives
sudo docker exec postgres psql -U "$POSTGRES_USER" -d postgres -c \
  "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database ORDER BY pg_database_size(datname) DESC;"
```

Results are summarized in "Server context" above.

---

## Phase 1: Backup (completed 2026-07-26)

Final state, all 5 files present in `~/backup-20260725/`, total 130G:
`n8n_db_dump.sql.gz` (2.1G), `tnunes_n8n_data.tar.gz` (3.0G),
`tnunes_portainer_data.tar.gz` (74K), `tnunes_postgres_data.tar.gz` (122G,
compressed down from the source volume's ~191G), `tnunes_qdrant_data.tar.gz`
(2.9G). Note: the original foreground loop was interrupted overnight after
`postgres_data` finished but before `qdrant_data` started (confirming the
disconnect risk flagged when the job began) — `qdrant_data` and the `n8n_db`
dump were re-run manually the next morning to close the gap. Delete this
directory once comfortable the migration is stable (see note below).

**Do this before touching anything else.** Run in its own session — this is a
long-running foreground job (multi-hour, dominated by gzip-compressing the
191G `tnunes_postgres_data` volume at roughly single-threaded-gzip speed).
Don't close that session until it completes; a disconnect would kill the job
mid-copy.

```bash
mkdir -p ~/backup-$(date +%Y%m%d)
cd ~/backup-$(date +%Y%m%d)

for v in tnunes_n8n_data tnunes_portainer_data tnunes_postgres_data tnunes_qdrant_data; do
  sudo docker run --rm -v "$v":/data -v "$PWD":/backup alpine \
    tar czf "/backup/${v}.tar.gz" -C /data .
done
```

Progress-check commands (run from a *second* session, don't touch the one
running the backup):
```bash
sudo docker ps | grep alpine                                    # still running?
ls -lh ~/backup-$(date +%Y%m%d)/tnunes_postgres_data.tar.gz      # run twice, size should grow
top                                                              # a gzip/tar process should be pinning a core
```

Targeted logical backup of just n8n's own database (belt-and-suspenders on
top of the raw volume tar — deliberately not a `pg_dumpall`, see the shared-DB
note above):
```bash
cd /path/to/existing/compose/dir   # wherever tnunes's docker-compose.yml actually lives
set -a; source .env; set +a
sudo docker exec postgres pg_dump -U "$POSTGRES_USER" n8n_db | gzip > ~/backup-$(date +%Y%m%d)/n8n_db_dump.sql.gz
```

Once done:
```bash
ls -lh ~/backup-$(date +%Y%m%d)/
```
Confirm all 4 `.tar.gz` files and `n8n_db_dump.sql.gz` exist with plausible
non-zero sizes before moving to Phase 2. Delete this backup directory once
you're comfortable the migration is stable — it contains a full copy of
`wahis` and the other institutional databases at rest in a home directory,
which isn't somewhere that data should live long-term.

---

## Phase 2: Install self-hosted Supabase (prepared, not yet run)

Run in a separate session from the backup, once Phase 1 has finished (or is
far enough along that pulling images / starting containers won't meaningfully
compete for disk I/O — judgment call based on observed system load).

### 2.1 Get the official self-hosting files

Sparse-checkout of just the `docker/` folder (avoids pulling the whole
monorepo — also sidesteps a Windows path-length issue seen on the dev
machine, though that's specifically a Windows/Git problem and likely moot on
Debian; kept the same approach for consistency with what was already
validated):
```bash
mkdir -p ~/supabase-src && cd ~/supabase-src
git clone --filter=blob:none --sparse https://github.com/supabase/supabase.git
cd supabase && git sparse-checkout set docker
mv docker ~/supabase-project
cd ~/supabase-project && rm -rf ~/supabase-src
```

### 2.2 Configure `.env`

Only change from the shipped defaults: remap the Postgres port off `5432`
(already in use by the existing `tnunes` stack).
```bash
cp .env.example .env
sed -i 's/^POSTGRES_PORT=5432/POSTGRES_PORT=5433/' .env
grep '^POSTGRES_PORT=' .env
```
`SUPABASE_PUBLIC_URL` / `API_EXTERNAL_URL` / `SITE_URL` are left at their
`localhost`-based defaults for this first validation pass — deliberately not
wired to the real domain / nginx yet. See "Next steps" below.

### 2.3 Generate secrets and API keys

Do not hand-write these — the official scripts generate proper random
passwords and correctly-signed JWTs/API keys (a very common self-hosting
failure mode is a manually-typed anon/service key that isn't validly signed
against the JWT secret).
```bash
sh utils/generate-keys.sh --update-env
sh utils/add-new-auth-keys.sh --update-env
```

### 2.4 Restrict exposure to localhost only (required — do not skip)

Confirmed via `sudo iptables -L -n`: `Chain INPUT (policy ACCEPT)`. The only
rules present are a blocklist of ~28 specific IPs (likely already-observed
hostile scanners) — there is **no default-deny, port-based restriction** on
this host. Left as-is, starting the stack would make Kong (`8000`) and the
Postgres pooler (`5433`) reachable from the entire public internet
immediately, unencrypted (no TLS/nginx wired up yet), fronting real
auth/database access, before schema import or hardening.

Deliberately **not** fixing this by editing the existing iptables rules — a
mistake there risks locking out SSH access entirely, a far worse failure mode
than the one being prevented. Instead, bind the new stack's exposed ports to
`127.0.0.1` only, via a compose override (leaves the env-var-driven internal
config like `PGPORT` untouched, only changes the host-side bind address).
This is also very likely the right *permanent* architecture regardless —
nginx becomes the only externally-reachable component, proxying internally
to `127.0.0.1:8000`, matching whatever pattern it already uses for n8n.

**Important — use the `!override` YAML merge tag on `ports:`, not a plain
list.** Docker Compose merges `ports:` (and other sequence fields) across
`-f` files by *concatenating* them, not replacing them. A plain override
list here results in **both** the base file's unprefixed (`0.0.0.0`) port
entries *and* this override's `127.0.0.1`-prefixed ones being active
simultaneously — Docker then tries to bind the same host port twice and
intermittently fails with "address already in use" on whichever service
loses that race (this is exactly what happened on the real deployment: the
error moved between `kong` and `supavisor` across retries, and `ss` always
showed the port free afterward, because the failed half of the duplicate
pair never stayed bound). Confirm the fix with
`docker compose config | grep -B3 -A1 "published:"` — each service should
show exactly 2 port entries, both with `host_ip: 127.0.0.1`, before starting
anything.

```bash
cat > ~/supabase-project/docker-compose.localhost-only.yml <<'EOF'
services:
  kong:
    ports: !override
      - "127.0.0.1:${KONG_HTTP_PORT}:8000/tcp"
      - "127.0.0.1:${KONG_HTTPS_PORT}:8443/tcp"
  supavisor:
    ports: !override
      - "127.0.0.1:${POSTGRES_PORT}:5432"
      - "127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}:6543"
EOF

cd ~/supabase-project
sh run.sh config add localhost-only
sh run.sh config    # confirm docker-compose.localhost-only.yml is now listed in COMPOSE_FILE
docker compose config | grep -B3 -A1 "published:"   # confirm exactly 2 entries per service, both 127.0.0.1
```

### 2.5 Pull images
```bash
sudo docker compose pull
```

### 2.6 Start the stack — done, all 11 services healthy (2026-07-26)
```bash
docker compose up -d --wait
docker compose ps -a
```
Expect every service (`db`, `kong`, `auth`, `rest`, `realtime`, `storage`,
`imgproxy`, `meta`, `functions`, `studio`, `pooler`) to report healthy. This
did **not** match cleanly on the first attempt here (unlike the dev machine) —
before applying the `!override` fix in 2.4, `kong` and `supavisor` failed
intermittently with "address already in use" because the ports-merge bug
made Compose try to bind each port twice (once wide-open from the base file,
once loopback-only from the override). Once 2.4 was corrected, this step
succeeded cleanly: all 11 services healthy, `kong` showing
`127.0.0.1:8000->8000/tcp`/`127.0.0.1:8443->8443/tcp` and `pooler` showing
`127.0.0.1:6543->6543/tcp`/`127.0.0.1:5433->5432/tcp` in `docker compose ps`
— confirming the loopback-only binding actually took effect, not just that
the containers started.

---

## Phase 3: Verification — done, all checks passed (2026-07-26)

Confirms real functionality, not just "containers are up" — same tests that
passed on the dev machine, now also passed here.

```bash
ANON_KEY=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
SERVICE_KEY=$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)

# Auth service responds correctly
curl -s "http://localhost:8000/auth/v1/health" -H "apikey: $ANON_KEY"

# Anon key correctly blocked from the admin-only OpenAPI schema root (expect 403 — this is correct, not a bug)
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:8000/rest/v1/" -H "apikey: $ANON_KEY"

# Anon key correctly allowed on real table routes (expect a clean PostgREST 404 for a nonexistent table,
# proving the key/ACL chain works, not a Kong-level rejection)
curl -s -w "\nHTTP %{http_code}\n" "http://localhost:8000/rest/v1/does_not_exist_yet" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# service_role key correctly allowed on the admin-only root (expect 200)
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:8000/rest/v1/" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
```

All four checks passed exactly as expected: GoTrue health responded with
version info, anon key got `403` on the admin-only schema root, anon key got
a clean PostgREST `404`/`PGRST205` on a real table route (proving the
key/ACL chain works rather than being Kong-rejected), and the service_role
key got `200` on the admin-only root. Identical results to the dev machine —
the self-hosted stack is fully validated on the real server.

---

## Status summary

| Step | Status |
|---|---|
| Reconnaissance | Done |
| Backup (4 volumes + n8n_db dump) | **Done** (2026-07-26) |
| Install self-hosted Supabase stack | **Done** (2026-07-26) — hit and fixed a real ports-merge bug along the way, see §2.4/§2.6 |
| Verification | **Done** (2026-07-26) — all 4 checks passed |
| Import real `zoolio-app` schema (public schema only, no data) | Not started — same process already validated on the dev machine |
| SAML SSO config (faculty Shibboleth) | Not started — needs faculty IdP metadata |
| nginx reverse proxy + real domain for Kong | Not started |
| `feedback_validations` RLS gap fix on production | Not started (see `docs/ARCHITECTURE.md` §5) |
| Data migration (real rows, not just schema) from Supabase Cloud to this instance | Not started — deliberately deferred past the schema-only validation phase |

## Next steps (not yet started)

- Once the stack is verified healthy, import the real `zoolio-app` public
  schema (same schema-only, no-data approach validated on the dev machine —
  pull via the Supabase Cloud **session pooler**, not the direct `db.*`
  host, since that one is IPv6-only and this network path may have the same
  limitation the dev machine did; worth checking IPv6 egress on this server
  before assuming otherwise).
- Wire nginx (already running natively on this box) to reverse-proxy a real
  subdomain to Kong (`localhost:8000`), then update `SUPABASE_PUBLIC_URL` /
  `API_EXTERNAL_URL` / `SITE_URL` in `.env` and restart.
- Configure SAML SSO once the faculty's Shibboleth IdP metadata is available
  (`GOTRUE_SAML_*` env vars are already present, commented out, in
  `docker-compose.yml`).
- Decide the real data migration approach (full data pull, not just schema)
  and cutover plan for `zoolio-app` itself.
- Apply the `feedback_validations` RLS fix here too once this becomes the
  live instance (currently only fixed on the Supabase Cloud production
  project, per `docs/ARCHITECTURE.md`).
