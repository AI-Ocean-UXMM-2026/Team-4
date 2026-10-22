# BIZFLOW

Business cashflow application with Supabase email/password authentication, account registration, owned workspaces and Excel ingestion. The existing Lovable frontend remains in `src/`; FastAPI is in `backend/`.

The shared demo-password login and public demo reset have been removed. Registration supports Supabase with email confirmation enabled or disabled. Users follow the confirmation link when required, or sign in immediately when the provider returns a session, then complete business setup before accessing records. Completing onboarding creates one empty workspace belonging to the authenticated user. Existing data is preserved and is never automatically assigned to new accounts.

## Configure and run

Use Python 3.12+ and Node 24. PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm.cmd ci
.\.venv\Scripts\python.exe tools/setup_environment.py
```

Configure these placeholders in private `.env`:

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: backend project connection. Use the project's publishable/anon key, never a service-role key.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: the same public values for the official browser SDK.
- `FRONTEND_URL`: trusted app origin, e.g. `http://localhost:3000`. Configure its exact callback URLs in Supabase Auth.
- `AUTH_PASSWORD_MIN_LENGTH` and `AUTH_PASSWORD_REQUIRED_CHARACTERS`: set the displayed/frontend/backend password rules (default: 8 characters with lowercase, uppercase, a number and a symbol). Configure Supabase with matching or stronger rules; it also enforces any breached-password checks.
- `DATABASE_URL`: local SQLite can store application data during development while authentication uses real Supabase. Production uses Supabase Postgres with `postgresql+psycopg://...?...sslmode=require`.

Enable Supabase email/password sign-up and apply the migrations. The app supports either **Confirm email** setting: enabled uses an email link; disabled returns a session immediately. Configure email delivery for confirmation and password recovery, and allow the app's exact callback URL. See [authentication setup](deployment/AUTHENTICATION.md) for setup and testing.

```powershell
# SQLite: additive local upgrade, preserves existing rows.
.\.venv\Scripts\python.exe tools/migrate.py
# Supabase PostgreSQL: apply all platform and RLS migrations in order instead.
# .\.venv\Scripts\python.exe tools/migrate.py --supabase
.\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log
```

In a second terminal, run `npm.cmd run dev -- --host 127.0.0.1 --port 3000`, then open `http://localhost:3000/sign-in`. Vite proxies `/api` to FastAPI. API docs are at `http://localhost:8000/docs`. Without provider configuration, public account screens remain viewable, but registration/sign-in and all protected API access remain unavailable. There is no fake-auth fallback.

On macOS/Linux use `.venv/bin/python` and `npm` instead of their Windows forms. Restart the frontend when changing `VITE_*` settings; those values are build-time configuration in production.

## Account lifecycle

Registration has two steps: account details, then business details. Sole proprietors may use a shop/trading name; no legal registration number is required. Currency is currently MMK, consistent with the workbook contract.

The validated full name and business draft are saved in Supabase user metadata until business setup is complete. Passwords go only to Supabase over TLS; they never enter the application database or browser storage. Metadata is revalidated after server identity verification and never proves ownership. After registration or email confirmation, the browser establishes the Supabase session and users confirm business setup. A database transaction creates their profile, business and owner membership; retries return the same workspace. Interrupted registration resumes after sign-in.

The official Supabase SDK manages persisted sessions, refresh and sign-out. Browser session state alone grants no API access: FastAPI verifies the JWT signature/issuer/audience/expiry, checks the user with Supabase, and requires business membership/setup. Old custom/demo JWTs and passwords are rejected. Password reset uses provider-issued one-use links; invalid/expired links show a request-new-link action.

## Data workflow

New workspaces show an empty state. Download a personalized workbook from Data Source, enter rows, save and upload. Repeated current file hashes are no-ops; changing a row with its existing ID updates that fact once, with a revision audit. Bad rows reject the complete import. Missing rows are retained with review warnings. All normalized projections remain business-scoped.

[SHARED_CONTRACTS.md](SHARED_CONTRACTS.md) describes sheet fields, exact decimal values, API responses and feature integration. Three synthetic workbooks in `database/seed/` remain available for explicit administrator-controlled tests; registration never seeds or grants access to them. Financial Health, Working Capital, Credit Hub and AI Analyzer are mounted for authenticated business users.

Workbook v1 does not provide historical cost at sale, supplier due dates, stock lead times or loan rate and term. Affected figures and insights remain unavailable; the scenario inputs in Working Capital are explicitly illustrative. Set `OPENAI_API_KEY` in the backend environment to enable AI wording for the exact bundled synthetic workbooks. Other imports use deterministic rules only unless provider use for real business data is explicitly enabled with `AI_ALLOW_REAL_DATA=true` after the required disclosure and consent. The key never belongs in `VITE_*` variables. A cross-feature synthetic demo workbook and walkthrough are in [examples/demo-showcase](examples/demo-showcase/README.md).

Optional delegated OneDrive linking and explicit Sync Now require approved Microsoft app configuration. Manual uploads do not need Microsoft. [Microsoft feasibility setup](deployment/MICROSOFT_FEASIBILITY.md).

## Checks

```powershell
$env:PYTHONPATH='.;backend'
.\.venv\Scripts\python.exe -m pytest backend/app -q
node_modules\.bin\tsc.cmd --noEmit
npm.cmd test
npm.cmd run build
.\.venv\Scripts\python.exe tools/prepare_browser_test.py
```

Auth tests use signed test JWTs and mocked Supabase HTTP/SDK responses; they do not simulate email delivery in the application. The browser smoke exercises public screens and protected redirects without creating a fake account. Live signup, two-user Supabase RLS/storage and provider recovery must also be tested with configured test accounts; [AUTHENTICATION.md](deployment/AUTHENTICATION.md) lists the procedure and opt-in RLS test variables.

Deployment files, same-origin gateway, migration instructions and release checks: [deployment runbook](deployment/RUNBOOK.md). No public deployment has been performed.

## Lovable

The project is connected to [the existing Lovable editor](https://lovable.dev/projects/e503e6ca-6e62-4d9c-8615-c58f92b2bb13). Keep published Git history intact. Main-branch pushes sync back to the editor. Configure the public Supabase build values and API hosting there before enabling real sign-in.
