# Supabase account setup and acceptance

## MVP registration

Registration checks email format, matching passwords, and password strength. Default requirements are at least 8 characters including lowercase, uppercase, a number, and a symbol. Business details remain part of the existing two-step form.

The app follows Supabase's configured registration flow. With Confirm email off, a successful signup returns a session and opens business setup. With Confirm email on, signup returns a pending user without a session and opens the confirmation screen. The /verify-email page and resend-verification API let existing pending users request a fresh link. Neither mode is treated as a configuration failure.

## Configuration

1. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in private .env, and mirror the same public values in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Use a publishable/anon key, never a service-role key.
2. Enable email/password accounts and new signups. Either **Confirm email** setting is supported. The API checks key validity and whether email registration is enabled before accepting signup, without rejecting projects that require confirmation. Configure SMTP as needed for real email delivery. [Supabase general configuration](https://supabase.com/docs/guides/auth/general-configuration).
3. Set AUTH_PASSWORD_MIN_LENGTH (default 8) and AUTH_PASSWORD_REQUIRED_CHARACTERS (default lower,upper,number,symbol). These are frontend and backend checks. Supabase can enforce additional password requirements. Passwords are never trimmed or persisted by the application.
4. Set FRONTEND_URL to the app origin (locally http://localhost:3000). Configure Supabase Site URL and allow the exact confirmation callback /auth/callback and recovery callback /auth/callback?flow=recovery. Restart the backend and restart/rebuild the frontend after changing environment values.
5. Apply platform migrations as described in the deployment runbook. Local development uses SQLite; Supabase handles account credentials. With Confirm email disabled, Supabase implicitly confirms new users, so the existing Postgres/storage RLS checks remain compatible. No schema migration is required for this flow.

Accounts pending confirmation can use the confirmation link or request another one through /verify-email. Sign-in shows this action when Supabase reports email_not_confirmed. The public key cannot administratively confirm users.

## Account and session behavior

POST /api/v1/auth/register validates input, checks provider setup, enforces database-backed request limits, and creates the Supabase account with validated non-secret name/business metadata. A matching user with access and refresh tokens returns registered. A matching unconfirmed user without tokens returns verification_required only when Supabase requires confirmation. Obfuscated duplicate-user responses use a neutral check_email state and grant no session or membership; explicit duplicate errors return ACCOUNT_EXISTS. Malformed responses and transport failures never claim account creation succeeded.

The official Supabase SDK establishes, persists, and refreshes the returned session. FastAPI verifies JWT signature, issuer, audience, expiry, and current provider identity on private requests. It does not require a separate email-confirmation timestamp. Business access still requires membership, and onboarding creates one empty workspace owned by the authenticated user. Retries return the same workspace. Existing business data is never automatically assigned to new users.

Signup responses contain credentials and use Cache-Control: no-store. Application logs must not include passwords, payloads, addresses, tokens, or callback query strings. No browser localStorage flag grants access.

## Password recovery

Forgot password remains an email-link flow, with generic responses for registered and unknown addresses, durable request limits, and provider Retry-After handling. Configure SMTP for delivery to external addresses as needed. The callback validates one-use recovery credentials with Supabase and strips credentials from the URL. Invalid or expired links cannot open password-reset controls. Successful recovery signs out before normal sign-in.

## Checks

- Reject malformed emails, short passwords, missing character types, mismatched confirmation, and invalid business details before signup. Confirm server checks reject the same invalid requests directly.
- With Confirm email off, register an approved test account. Confirm a session is established without email interaction and business setup opens immediately.
- With Confirm email on, confirm signup is accepted and displays the confirmation screen without an unavailable-service error. Follow the real email link, finish business setup, and verify resend never calls signup again.
- Sign out and sign in again. Confirm duplicate signup prompts sign-in, and a failed automatic session setup does not claim a second registration is needed.
- Complete onboarding twice and check the same empty workspace is returned. Test separate users cannot read, export, upload, or link each other's business data.
- Check anonymous, expired, forged, and retired demo tokens are rejected. Confirm sign-out clears cached private data and expired access tokens refresh only through Supabase.
- Test password recovery separately with a real mailbox; mocked tests do not prove SMTP delivery.

Optional live RLS tests use BIZFLOW_RLS_TEST_DSN, BIZFLOW_RLS_TEST_USER_A, and BIZFLOW_RLS_TEST_USER_B with disposable authenticated accounts and the existing opt-in test setup.
