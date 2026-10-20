# Local validation record

Validated on 20 October 2026 (Asia/Rangoon), branch `p5-platform`.

- Backend: all 32 tests passed in the final regression suite. SQLite exercises real transaction rollback and two concurrent imports against one source. Shared snapshots use a read transaction rather than modifying business records. No Microsoft, LLM or database network calls are required by this suite. One installed Starlette/httpx test-client deprecation warning is present.
- Frontend: strict `tsc --noEmit` passed; Vitest passed 7 tests, including direct routing and expense-to-cash display changes.
- Changed frontend files: ESLint passed with zero errors and three existing component/hooks fast-refresh style warnings.
- Production builds: Lovable/Cloudflare default target and Docker's Nitro `node-server` target passed. Private configured values were absent from all 7 production browser JavaScript chunks.
- Browser acceptance: passed on the Vite app and on the production Node build behind a local same-origin gateway. Covered sign-in, all five routes, direct refresh, business selection persistence, repeated import, 50,000 → 80,000 expense edit (updated=1), immediate financial refresh, AI preview staleness, isolation by business selection and demo reset. Desktop/mobile screenshots are ignored QA outputs under `.artifacts/browser`.
- Excel: all 44 sheets across the template and three fixtures rendered and visually reviewed; independent openpyxl parsing and validation passed for each synthetic persona. Money/date values remain typed; input formulas are absent.
- `git diff --check` passed. No commit, push or feature-branch merge was performed.

Not executed: live Supabase PostgreSQL/RLS checks, Docker container startup (Docker is unavailable here), real school Microsoft OAuth/consent/cloud sync, external LLM integration or a public deployment. Required account/hosting configuration is documented in RUNBOOK and MICROSOFT_FEASIBILITY. The local fallback uses password-protected demo authentication and synthetic data only.
