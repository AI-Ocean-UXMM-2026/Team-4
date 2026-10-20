# Deployment runbook

Configure [Supabase authentication](AUTHENTICATION.md) first. The shared demo password, local session issuer and public reset endpoint no longer exist. New accounts register, verify email and create an empty workspace. Existing imported data stays in place.

## Migrations

Run `python tools/migrate.py --supabase` against Supabase PostgreSQL. The migration ledger serializes and records each file. Apply 001 through 004 on a new project; an existing project with 001/002 recorded receives only 003/004. Do not regenerate or modify applied migration files. If legacy tables were created manually without the ledger, compare them with 001/002 and record an accurate baseline through a trusted administrator before using the migrator; never drop/reset existing data to get past a migration error.

For local application-data development, `python tools/migrate.py` initializes/upgrades SQLite additively; authentication still requires real Supabase. The application does not insert demo users, seeded businesses or synthetic memberships on startup. Retained sample workbooks and the seed CLI are explicit administrator test utilities only; the CLI requires a chosen existing test-user ID.

## Services

- Backend: build `deployment/Dockerfile.backend`, serve 8000, health `/health`. Use a persistent server-only Supabase database URL, the project URL/public key, trusted FRONTEND_URL/CORS origins, and optional Microsoft secrets. Deploy migrations before starting the new application version. JWT validation supports Supabase asymmetric RS256/ES256 keys.
- Frontend: build `deployment/Dockerfile.frontend` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Leave `VITE_API_BASE_URL` blank for same-origin hosting. The Docker build targets Nitro `node-server` and serves 3000. The default build remains compatible with the existing Lovable/Cloudflare target. This SSR application needs a server; publishing only `.output/public` is insufficient.
- Gateway: route `/api/*` to backend and other paths to frontend on one HTTPS origin. The supplied nginx example is HTTP for local Compose; use your host's TLS termination for production. Apply its callback log/referrer/cache protections in the public gateway/CDN too. Keep exact production email callback URLs in Supabase's allow list.

Local Docker/Postgres stack (put a URL-safe private `POSTGRES_PASSWORD` and real Supabase authentication settings in `.env`):

```sh
docker compose --env-file .env -f deployment/compose.yaml build
docker compose --env-file .env -f deployment/compose.yaml up -d database
docker compose --env-file .env -f deployment/compose.yaml run --rm backend python tools/migrate.py
docker compose --env-file .env -f deployment/compose.yaml up -d
```

Open `http://localhost:8080/sign-in`. Use that exact origin in frontend/callback configuration when testing this stack. Local Postgres applies 001/003; the RLS/storage migrations require a real Supabase schema. Do not run volume-deletion commands against data you want to preserve. Docker is not available in the implementation environment, so container startup remains an external verification step.

## Before public release

Run backend tests, strict TypeScript, Vitest, production build and public browser smoke. Complete the live two-user signup/email/reset/RLS/storage acceptance in AUTHENTICATION.md. Test each dashboard/data route with direct navigation and refresh; anonymous users must reach sign-in and incomplete accounts must reach setup. Verify no server secret is in the frontend bundle. Configure provider email rate limits and an edge request limiter appropriate to your host; application email cooldowns coordinate through the database.

Microsoft OneDrive remains optional; [the tenant feasibility gate](MICROSOFT_FEASIBILITY.md) is separate from Supabase account sign-in. Manual upload works after a verified user has completed business setup. P1–P4 backend feature routers are still integrated only when owners supply them. No external account, email delivery, live RLS, Docker runtime or public deployment is implied by a local test/build.
