# Signup state correction validation

Validated locally on 21 October 2026 (Asia/Rangoon).

## Observed cause and actual trace

The local `.env` has all four Supabase URL/public-key settings empty. Before the fix, two valid `POST /api/v1/auth/register` requests for the same diagnostic address produced:

| Attempt | HTTP | Error | Retry-After |
| --- | --- | --- | --- |
| First | 503 | `AUTH_NOT_CONFIGURED` | absent |
| Immediate retry | 429 | `AUTH_RATE_LIMITED` (application database limit) | 59 seconds |

The router reserved a database email allowance before checking configuration. The frontend then independently rendered the request error and configuration notice. No Supabase request was made by these attempts. The original process disabled access logging and did not retain historical signup payloads/responses; we cannot infer any earlier account or delivery outcome from its UI. The diagnostic request included the required full name, email, password/confirmation and business details; no real recipient was used and no password was saved to the evidence record.

After correction and backend restart, both requests return **503 AUTH_NOT_CONFIGURED**, with **no Retry-After**. Backend logs show `Account operation=register status=503 code=AUTH_NOT_CONFIGURED` twice. Database counts remain identical before/after: **3 businesses, 1 user, 5 existing rate-limit records**. Existing counters and data were preserved. Sanitized actual responses/configuration presence/counts are recorded locally in `.artifacts/auth/signup-diagnosis.json` (ignored by Git).

## Verification

- Backend: **76 passed, 1 skipped**. Tests cover missing/invalid configuration before throttling, accepted verification response validation, configuration-specific SMTP rejection, upstream 429 with seconds/date/absent/invalid retry timing, durable provider deadlines, supported resend payload, concurrent signup sending once, timeout outcomes and log redaction. Existing verification, metadata resume, atomic/concurrent single-owner onboarding, isolation and workbook tests pass. Provider HTTP is mocked only in tests.
- Frontend: **42 passed**. Tests cover one-message configuration/rate/failure states, synchronous duplicate-submit protection, accepted signup leaving registration for **Check your email**, preserved business fields, provider resend, known cooldown expiry without auto-retry, no countdown for unknown timing, project/key fingerprint matching, response-header parsing, callback/recovery and route guards. SDK/API calls are mocked only in tests.
- Strict TypeScript passed. Production Cloudflare and Nitro Node deployment builds passed. Chrome public UI smoke passed against the restarted real local app: disabled unconfigured signup/sign-in, exactly one configuration alert, zero browser signup requests, registration steps, protected redirects, responsive layout, password visibility and invalid callback/recovery guards. Current registration screenshot was visually reviewed at `.artifacts/auth/registration.png`.

**Still blocked externally:** real Supabase signup/sign-in, SMTP verification/reset delivery and live RLS/storage testing. Project URL/public keys are absent; no Supabase project or mail-provider logs can be inspected here. Mandatory email verification remains enabled as a required provider setting and enforced by the API. No account creation, sent email or public deployment is claimed. Exact project/SMTP/callback setup and live acceptance steps are in [AUTHENTICATION.md](AUTHENTICATION.md).

---

# Previous authentication validation record

Validated locally on 20 October 2026 (Asia/Rangoon). This supersedes the earlier demo-password acceptance record.

- Backend: **57 passed, 1 skipped**. Real JWT signature validation uses generated test RSA keys; Supabase HTTP responses are mocked only in tests. Checks cover registration validation, unchanged passwords, provider password rejection, duplicate-email responses, required email confirmation, unverified/expired/forged/demo rejection, resumable drafts, one empty owner workspace, concurrent retries, orphan rollback, cross-user read/import/export/link denial, rate limits, generic delivery failures and the existing workbook regressions. Additive SQLite upgrade is checked twice against a populated legacy database.
- Frontend: **33 passed**. Checks cover labeled sign-in/toggle, generic invalid credentials, provider-accepted sign-in, registration steps/validation, generic recovery, invalid/expired links, expired-fragment rejection, recovery password update/sign-out, provider refresh failure, anonymous/incomplete/pending-account route guards, direct routes and workbook display integration.
- Strict TypeScript passed. Changed authentication files linted with zero errors; component/hooks fast-refresh warnings remain. Both the existing Lovable/Cloudflare target and Docker's Nitro Node target built successfully. The Node/browser build scan found no configured server secrets in its 15 JavaScript chunks. Build warnings include the larger SDK-containing client chunk and existing Vite/Nitro plugin notices.
- Chrome public UI smoke passed against Vite and the production Node app through a same-origin local gateway: all private paths redirect to sign-in, responsive sign-in/registration, password toggle, field validation, two steps, invalid callback and recovery-session guard. It deliberately does not create a fake runtime account or send real email. Desktop/mobile views were visually reviewed.
- Existing local data was upgraded additively; no business/import reset or automatic synthetic assignment was performed. The running local API no longer exposes demo-login/reset; missing provider settings report `auth_configured=false` and fail closed.

**Not verified live:** Supabase signup/sign-in, SMTP/email verification/password recovery delivery, deployed Postgres RLS or private-storage file bytes. Supabase project URL/public keys and email/deployment settings were not provided. The opt-in two-real-user RLS test is skipped until configured as documented in AUTHENTICATION.md. Docker is also unavailable in this environment. No public deployment was performed for this change.
