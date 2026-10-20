# Supabase account setup and acceptance

## Required configuration

1. Select the team's Supabase project. Set `SUPABASE_URL`, backend `SUPABASE_PUBLISHABLE_KEY`, frontend `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to its URL/public key. No Supabase service-role or management key is needed by the application. Keep the PostgreSQL password and Microsoft credentials server-only. Configure an asymmetric JWT signing key (RS256/ES256); the previous local HS256 demo issuer is not accepted.
2. Enable email/password accounts and new signups. **Enable Confirm email**. The API checks Supabase's public `/auth/v1/settings` with the configured public key. `/api/v1/config` reports `auth_status.ready` only when email signup and mandatory confirmation are enabled; key presence alone is insufficient. The browser also compares the project URL and a SHA-256 public-key fingerprint with its build configuration before enabling submissions. This preflight cannot prove SMTP delivery.
3. Configure the provider's password policy. Set `AUTH_PASSWORD_MIN_LENGTH` (default 8) and comma-separated `AUTH_PASSWORD_REQUIRED_CHARACTERS` (`lower,upper,number,symbol`, or blank) to match. These are the displayed/frontend/backend prechecks; Supabase also enforces its current policy and any breached-password checks. The app does not trim passwords. [Provider password security](https://supabase.com/docs/guides/auth/password-security).
4. Set Supabase's Site URL to `FRONTEND_URL`. Allow exactly `<origin>/auth/callback` and `<origin>/auth/callback?flow=recovery`. Use the chosen local origin consistently (e.g. `http://localhost:3000`); allow your production HTTPS origin separately. No request accepts a browser-supplied redirect URL or `next` destination.
5. Configure SMTP/email delivery and provider rate limits. The app separately enforces database-backed email/IP cooldowns (one verification/reset request per email per minute, five per hour, ten per IP per minute per flow) and a matching UI cooldown. Address-specific duplicate/unknown-account responses remain neutral; setup failures, upstream outages and rate limits are explicit failures. Direct Supabase SDK login is additionally subject to Supabase's native limits. [Provider email/password flow](https://supabase.com/docs/guides/auth/passwords).
6. Run `python tools/migrate.py --supabase` with a trusted database connection. Existing migrations 001/002 stay unchanged. **003_accounts.sql** adds profile/business fields, nullable unique owner IDs and request-limit storage. **004_supabase_accounts_storage.sql** requires verified membership for RLS reads, denies browser ownership/profile writes and configures the private `bizflow-uploads` bucket. Production initialization never resets tables or seeds new users. SQLite development uses an additive upgrade that preserves legacy rows.

The application runs public screens with missing provider configuration, but cannot grant access. Real signup, login, verification delivery and password reset cannot be claimed operational until the configured provider is tested.

Configuration checks precede the database throttle, so an unconfigured signup cannot use up the email allowance. Provider setup errors return 503; rate limits return 429; accepted registration awaiting verification returns `verification_required`. Known duplicate-address responses use a neutral `check_email` state without asserting an account was created or a message was sent. A missing/malformed user response or an unexpected session is not accepted as verification success. Resend uses `POST /auth/v1/resend` with `type: signup`, never another signup/password submission. SMTP failures and provider throttles are no longer swallowed as successful responses.

The UI leaves registration for **Check your email** only after an accepted response, shows one relevant message and locks concurrent requests synchronously. It never automatically repeats signup after a timeout. Business fields remain in memory on errors; accepted new registrations preserve the validated draft in provider metadata for verified onboarding on another device. Passwords are never persisted. Supabase remains the email identity authority; local business creation requires verified identity and a unique owner transaction.

Retry timing comes from an explicit provider `Retry-After` (seconds or HTTP-date) or the application's measured database allowance. No provider retry is guessed. Unknown provider timing shows a rate-limit message with no countdown. Explicit provider deadlines are also persisted conservatively across all email flows in the existing request-limit table, coordinating workers/restarts. Successful responses return the known application cooldown, which may be longer after the hourly allowance is consumed. CORS exposes `Retry-After`. Browser refresh cannot bypass server throttles.

## External email setup

As checked on 21 October 2026, Supabase's built-in email service sends only to the project's organization team addresses and is limited to **two messages per project per hour**. A public demo accepting arbitrary addresses needs **custom SMTP**. These are provider restrictions, not evidence that this local failure reached those limits. [SMTP restrictions and setup](https://supabase.com/docs/guides/auth/auth-smtp), [current rate limits](https://supabase.com/docs/guides/auth/rate-limits).

1. In your email service, verify a sending domain and sender address. Add the DNS authentication records with the exact values issued by that service (SPF/DKIM and its recommended DMARC policy). Complete any sandbox/recipient restrictions there.
2. In **Supabase Authentication > Email > SMTP Settings** (or the Authentication settings SMTP section), enable custom SMTP. Enter the service's **host, TLS port, username, password, sender email, and sender name**. Keep SMTP credentials in Supabase, never `VITE_*`. Disable link tracking for verification/reset emails if it rewrites links.
3. In **Authentication > Rate Limits**, review the project email quota and per-user email interval against the mail service's quota. Supabase documents an initial custom-SMTP limit of 30 messages/hour; adjust the actual project setting as needed. Do not disable confirmation to bypass delivery problems.
4. Configure the URL/public-key pairs, Site URL and callback allow list above, then restart the backend and restart/rebuild the frontend: Vite embeds its public settings at build time. Use `http://localhost:3000` consistently for this preview unless you change `FRONTEND_URL` and the allow list together.
5. Test one approved new address. Inspect **Supabase Authentication Users/Auth logs** for the signup outcome and correlate the provider request ID/status/code with the sanitized backend log. Separately inspect SMTP activity for acceptance, suppression, bounce or delivery and confirm the message in the recipient inbox. Do not re-submit signup to test delivery; wait for any supplied retry deadline and use resend. Then verify the real link and finish onboarding twice to confirm the same business ID.

The application logs operation, HTTP status, sanitized provider error code and provider request ID, plus explicit unknown outcomes for transport failures. It does not log passwords, payloads, addresses, tokens or callback query strings. The original server ran without access logs, so historical request bodies/responses are unavailable. Project Auth and SMTP logs require the account owner; none are accessible with the currently empty configuration.

## Email links

The default Supabase `{{ .ConfirmationURL }}` template is supported: the callback validates returned access credentials with the SDK/provider and rejects expired fragment access tokens before allowing `setSession` to refresh them. PKCE code exchange is supported for provider flows initiated with a verifier. No tokens are logged by application handlers or retained in the callback URL.

For cross-device links without fragment sessions, use these provider email-template targets (replace only through Supabase's template variables):

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup">Verify email</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

The SDK calls `verifyOtp` for the declared type; Supabase enforces one-use and expiration. The UI permits password reset controls only after a successful recovery callback. Invalid/expired links provide resend/reset actions. The callback strips query/fragment credentials before other work; the provided gateway disables callback access logging, and HTML uses a no-referrer policy. Apply equivalent rules to any external host/CDN. Do not log authentication request bodies or callback URLs. [Email template reference](https://supabase.com/docs/guides/auth/auth-email-templates), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp).

The two-step registration endpoint preserves only validated full name/business fields in Supabase user metadata. Email verification does not automatically assign any business data. A verified user resumes `/onboarding`; the server revalidates the draft and creates a fresh empty business with owner ID from the verified identity. Owner uniqueness and transaction locking make retries safe. User-supplied owner/business IDs are rejected. Existing legacy rows remain unowned unless already explicitly provisioned; administrators must review/fill required legacy profile/industry/city fields before enabling their existing memberships. Never infer ownership from a matching business name or email domain.

## Session behavior

The official `@supabase/supabase-js` browser client uses its supported persisted-session and auto-refresh strategy. No application localStorage authentication flag is used, and passwords are not stored. Server-rendered HTML is an unauthenticated shell; it does not authorize from browser storage. FastAPI is the authority for private data and verifies JWTs and the current provider user on each request. API data responses are `Cache-Control: no-store`.

If an access token expires, the API client asks the SDK to refresh and retries once. Invalid refresh ends the local provider session and clears private query state. Sign-out asks Supabase to revoke refresh sessions and clears local SDK/session UI state. As with Supabase's supported JWT lifecycle, already issued access tokens last until their expiry; configure that lifetime in the provider. Successful password recovery signs out before the user signs in with the new password.

## Live two-user acceptance

Use two approved test accounts and disposable owned workspaces. These checks require actual credentials/email access; none are substituted with fake runtime authentication.

1. Register User A with all business details. Confirm a missing name/industry/city, malformed email, weak password or mismatched confirmation cannot submit successfully. Verify the received email; confirm a second use or expired link is rejected. Sign in and finish onboarding. Check the new workspace has zero imported rows and no synthetic memberships.
2. Register the same email again. The response remains generic and no local workspace is created from the unauthenticated response. Resume after reload/sign-in. Retry onboarding, including concurrent requests; it must return the original business rather than duplicate it.
3. Register/verify User B for a different business. Under each user's browser session, attempt snapshot/status/template export/import/OneDrive operations with the other business ID. Expect 403. Direct Supabase typed-table SELECT must hide the other business; ownership/membership writes must be denied.
4. In the private `bizflow-uploads` bucket use object keys `<authorized-business-id>/<filename>`. Upload/read/update/delete an owned test object, then try the same operations under the other user's ID. Expect denial. Existing unrelated storage policies must be reviewed: PostgreSQL permissive policies combine with OR and another broad policy must not expose this bucket. Manual Excel uploads are parsed transiently and do not leave downloadable private workbook files.
5. Request password reset for registered and unknown email addresses. Both display the same generic outcome. Follow the real reset email, change the password and sign in with the new password. Confirm old/expired links cannot establish recovery, and old credentials no longer sign in.
6. Verify invalid credentials show the generic message, anonymous dashboard access redirects, unverified accounts cannot call protected endpoints, incomplete users resume setup, sign-out clears cached data, and an expired access token refreshes only through Supabase. The retired demo endpoint must return 404 and old demo JWTs 401.

An opt-in database/RLS test is included. Set these **server-only** environment values and run `python -m pytest -c backend/pytest.ini -q backend/app/integrations/excel/tests/test_rls_live.py`:

```text
BIZFLOW_RLS_TEST_DATABASE_URL=<trusted-postgres-connection>
BIZFLOW_RLS_TEST_USER_A=<already-verified-auth-user-uuid>
BIZFLOW_RLS_TEST_USER_B=<different-already-verified-auth-user-uuid>
```

It uses a transaction with temporary test businesses and storage-object metadata, switches to the authenticated role for both users, checks cross-business reads/writes and storage policy enforcement, then rolls back all fixture changes. It does not test file bytes or email delivery; the browser/provider checks above remain necessary. It is skipped when these values are missing.
