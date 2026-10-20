# Deployment and demo handoff

## Local acceptance

Follow README's two-process setup. The generated `.env`, local DB, Python environment, dependencies and QA images are ignored by Git. `tools/setup_demo.py` preserves any existing configuration. The demo login is password-protected, not an anonymous API bypass; `demo-user` has memberships in three synthetic businesses. Reset is enabled only for demo mode with `ALLOW_DEMO_RESET=true` and the seeded fixture IDs.

Select tea-shop, open Financial Health (185 K in / 125 K out / 60 K net), import the tea-shop workbook, then repeat it. Change E001 rent 50,000 → 80,000; updated=1 and monthly outflow=155 K. Repeat changed file and totals remain unchanged. Try a duplicate sale ID; error details identify the row, while outflow remains 155 K. Switch to grocery (311 K out) to demonstrate isolation. Generate AI local preview, change/import a workbook, return to AI and see stale status until explicitly refreshed. Restore tea-shop to 125 K out. Credit checklist/scenario controls are retained prototype interactions.

## Supabase production connection

1. Create/select a Supabase project and an approved test Auth user. Set `AUTH_MODE=supabase`, `SUPABASE_URL`, and server-only `DATABASE_URL=postgresql+psycopg://...?...sslmode=require` using a database role authorized to ingest. Use Supabase's connection information; do not place the database password or service-role key in browser variables.
2. Run `python tools/migrate.py --supabase` with that environment. It serializes migrations and records applied filenames. Migration 001 creates typed tables/audit; 002 enables SELECT-only membership RLS and denies browser reads of workbook_sources/oauth_states. Apply only to an appropriate new schema; review table names before using an existing project.
3. Provision the approved demo user using `PYTHONPATH=backend python -m app.db.seed --user-id <supabase-auth-user-uuid>`. This grants that user only the three synthetic businesses. To provision real businesses, create users/businesses/memberships through a trusted admin workflow; there is no public membership write API. Never grant all users access by default.
4. Enable email/password sign-in for the approved account. Set frontend build values `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable/anon only). Backend verifies exp/sub/iat, audience `authenticated`, issuer and an RS256/ES256 key from the project's JWKS. Use a Supabase project with asymmetric JWT signing keys; legacy shared-secret HS256 tokens are intentionally unsupported.
5. Verify with **two distinct users**: user A belongs only to tea-shop; user B only to grocery. Check every API returns 403 for the other business, and direct Supabase SELECT with each user's JWT exposes only its business. Assert direct workbook_sources/oauth_states SELECT and all client INSERT/UPDATE/DELETE attempts are denied. These live RLS checks have not been executed in this environment.

## Public hosting

No hosting credentials or connected deployment account were supplied; a public URL is not created by local builds. Deploy the prepared services to the team's approved host. Keep the existing Lovable project/history intact.

- Backend: build `deployment/Dockerfile.backend`, expose 8000, health path `/health`. Apply migrations before startup, set secret environment values in the host's secret store, and use Supabase Postgres for persistence. Factory command is already in the image. Put an HTTPS reverse proxy in front of it. Configure matching `FRONTEND_URL` and `CORS_ORIGINS` without wildcards.
- Frontend: build `deployment/Dockerfile.frontend` with the three allowed public build arguments. It builds the retained TanStack Start app with Nitro `node-server` and serves port 3000. This is an SSR server: do not upload only `.output/public` to a static host. Direct route refresh must reach the Node server. The default `npm run build` still preserves Lovable's Cloudflare target.
- Route `/api/*` to the backend and all other paths to frontend, on the **same HTTPS origin**. Leave `VITE_API_BASE_URL` blank. This avoids cross-site cookie restrictions on the Microsoft OAuth state. An example HTTP nginx config is provided for local Compose; let the public host terminate TLS.
- On multi-instance public hosting, replace the in-process demo login limiter with an edge/distributed rate limiter. Database import locking already coordinates across API processes. Real users should use Supabase Auth, where demo-login/reset are disabled. Consider upload rate limits/timeouts at the gateway for your workload.

For a local Postgres stack, put a URL-safe `POSTGRES_PASSWORD` in `.env` and run from repository root:

```sh
docker compose --env-file .env -f deployment/compose.yaml build
docker compose --env-file .env -f deployment/compose.yaml up -d database
docker compose --env-file .env -f deployment/compose.yaml run --rm backend python tools/migrate.py
docker compose --env-file .env -f deployment/compose.yaml run --rm backend python -m app.db.seed
docker compose --env-file .env -f deployment/compose.yaml up -d
```

Open `http://localhost:8080`; set `FRONTEND_URL`, `CORS_ORIGINS` and callback URI to that origin if testing OAuth. This local Postgres stack uses demo authentication; Supabase-specific RLS migration 002 applies only on Supabase. Docker is not installed in the implementation environment, so the container stack itself has not been executed. Do not run `down -v` against data you intend to keep.

## Microsoft go/no-go

Complete [MICROSOFT_FEASIBILITY.md](MICROSOFT_FEASIBILITY.md) with an approved school account. With no credentials, leave `MICROSOFT_*`/TOKEN_ENCRYPTION_KEY unset and use re-upload. No automatic local-file monitoring or background polling is claimed. Optional future delta discovery must follow paging and persist deltaLink; see [Microsoft delta documentation](https://learn.microsoft.com/en-us/graph/api/driveitem-delta).

## Feature owner merge gate

Ask P1–P4 to review SHARED_CONTRACTS, field/loan assumptions, typed table queries, endpoint business scoping and frontend props. Owners provide working routers/pages in their own modules. P5 composes them using the documented export paths and extends query invalidation for their keys. Review feature changes in branches before merging; no supplied branches or PRs were available during this implementation. Do not force push or rewrite Lovable history.

## Release smoke

Run backend tests, strict TypeScript, frontend tests and both deployment-target builds. Run browser smoke against disposable seeded data. Check the public HTTPS host at `/`, `/working-capital`, `/credit`, `/ai`, `/data-source` and refresh each path. Confirm unauthenticated calls fail, two-user business isolation holds, no private tokens appear in status/API payloads or the browser bundle, failed imports preserve data, AI being unavailable does not block the deterministic pages, and the manual-upload fallback works with Graph disabled. Record host URL, commit, tenant decision and live check results before calling the public release complete.
