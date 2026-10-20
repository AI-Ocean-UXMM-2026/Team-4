# BizFlow platform

Excel ingestion and application integration for the existing Lovable SME cashflow prototype. Work is on `p5-platform`; published history is preserved.

Implemented: FastAPI backend, demo/Supabase JWT authentication, business memberships, PostgreSQL schema and Supabase RLS migration, typed shared tables, bounded XLSX parsing/validation, atomic stable-ID upserts, revision audits, upload/status/template APIs and UI, three synthetic SME workbooks, optional delegated OneDrive linking and explicit Sync Now, five real frontend routes, demo reset, regression tests and deployment configuration.

P1–P4 backend feature modules were not supplied. The existing frontend views are retained behind a shared snapshot adapter; working-capital scenarios and credit checklist remain prototypes. AI is honestly labeled as a local heuristic preview, generated only on request and marked stale after a newer import. No LLM is required for the app or import workflow.

**Release status:** the local manual-upload demo is implemented and tested. Public hosting, live Supabase/RLS verification and school Microsoft consent testing require external account configuration. No public deployment or feature-branch merge has been performed. See [release runbook](deployment/RUNBOOK.md) and [Microsoft feasibility gate](deployment/MICROSOFT_FEASIBILITY.md).

## Run locally (PowerShell)

Prerequisites: Python 3.12+ and Node 24 (the Vite 8 app requires a modern Node runtime).

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm.cmd ci
.\.venv\Scripts\python.exe tools/setup_demo.py
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m app.db.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --app-dir backend --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 3000
```

Open `http://localhost:3000`. Sign in using `DEMO_PASSWORD` from your private `.env`; setup generates it and a session signing secret. No school account, Supabase project or AI key is needed for this SQLite fallback. The API is at `http://localhost:8000/docs`. Vite proxies `/api` to the backend. No secrets belong in `VITE_*`; the only allowed browser configuration is API origin, Supabase URL and Supabase publishable key.

On macOS/Linux use `.venv/bin/python`, `npm` and `PYTHONPATH=backend .venv/bin/python -m app.db.seed`. The two processes and same-origin API proxy are otherwise identical.

## Demo workflow

1. Select Mingalar Tea Shop, Shwe Grocery or Aye Chan Workshop in the header. Each uses a separate business ID/source.
2. Open Data Source and upload the matching workbook from `database/seed/`. Repeating it adds no duplicates.
3. In the tea-shop workbook change `Expenses!E2` (E001.amount_mmk) from 50,000 to 80,000. Save and upload. Expect **updated=1**, no new expense, cash out increases by 30,000 MMK once. The tea-shop monthly outflow changes from 125 K to 155 K.
4. Duplicate a sale ID or enter an overpayment. Import is rejected, an audit explains the Excel row/field, and previous data remains intact.
5. Restore sample data from Data Source when demo reset is enabled. This explicitly replaces only the selected synthetic business fixture.

Template: [blank workbook](shared/workbook-template/bizflow-template.xlsx); the UI download personalizes its Settings row. Required sheet fields and financial assumptions: [SHARED_CONTRACTS.md](SHARED_CONTRACTS.md).

## Checks

```powershell
.\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini -q
node_modules\.bin\tsc.cmd --noEmit
npm.cmd test
npm.cmd run build
# Run against the local synthetic demo processes:
.\.venv\Scripts\python.exe tools/prepare_browser_test.py
```

Browser smoke uses installed Chrome (`playwright` is a dev dependency); use `npx playwright install chrome` if Chrome is unavailable. It exercises sign-in, five routes with direct refresh, repeat upload, one-row expense update, business selection and reset. It writes QA screenshots only to ignored `.artifacts/`. Tests run without Microsoft/LLM/network dependencies. Backend tests cover malformed files, row coordinates, formulas, missing sheets, foreign IDs, mixed payment errors, overpayments, retained records, transaction rollback, concurrent requests, auth and Graph failures/eTag behavior. PostgreSQL/RLS must additionally be checked in the actual Supabase project before release.

## Repository map

- `backend/app/core`, `db`, `integrations/excel`: P5 platform implementation.
- `src/app`, `src/lib`, `src/components/layout`, `src/features/data-source`: composition and import UI; the existing app root remains `src`.
- `src/components/PrototypeModules.tsx`: extracted original Lovable views with imported display inputs. Feature owners replace the matching imports in `src/app/routes.tsx`.
- `database/migrations`: initial PostgreSQL schema and Supabase-only RLS; `database/seed`: three synthetic workbooks.
- `shared/contracts`: machine-readable workbook schema; `shared/workbook-template`: Excel template.
- `deployment`: Dockerfiles, same-origin nginx gateway, Compose, browser smoke and runbooks.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e503e6ca-6e62-4d9c-8615-c58f92b2bb13).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.
