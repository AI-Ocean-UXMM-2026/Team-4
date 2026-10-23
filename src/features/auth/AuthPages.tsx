import { useTranslation } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/apiClient";
import { authClient, completeEmailCallback, requireAuthClient } from "@/lib/auth";
import { useAccount, useAuth, useConfig } from "@/app/session";
import { Loading } from "@/app/providers";
import type { BusinessDetails } from "@/lib/contracts";
import { AuthShell, BusinessFields, Field, FormError, PasswordField, Requirements } from "./Fields";
import { businessProblem, emptyBusiness, passwordProblem, validEmail } from "./validation";

function usePolicy() {
  const config = useConfig();
  return {
    config,
    policy: config.data?.password_policy || {
      min_length: 8,
      required_characters: ["lower", "upper", "number", "symbol"],
    },
  };
}
function useAvailability(signup = false) {
  const query = useConfig();
  const notice = query.isError
    ? "Unable to verify account configuration. Please try again shortly."
    : !query.data
      ? "Checking account configuration..."
      : !query.data.auth_configured || !authClient()
        ? "Account access is temporarily unavailable. Please try again later."
        : signup && !query.data.auth_status?.ready
          ? query.data.auth_status?.message ||
            "Account creation is temporarily unavailable. Please try again later."
          : "";
  return { notice, blocked: !!notice };
}
function useCooldown(initial?: number) {
  const [deadline, setDeadline] = useState(() => (initial ? Date.now() + initial * 1000 : 0));
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return {
    seconds: Math.max(0, Math.ceil((deadline - clock) / 1000)),
    active: () => deadline > Date.now(),
    restart: (seconds?: number) => {
      const now = Date.now();
      setClock(now);
      setDeadline(seconds !== undefined ? now + seconds * 1000 : 0);
    },
  };
}
type EmailResult = {
  status: "check_email" | "verification_required";
  cooldown_seconds?: number;
  message: string;
};
type RegistrationResult = {
  status: "registered";
  session: { access_token: string; refresh_token: string };
};
function useAccountRequest(initialCooldown?: number) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const cooldown = useCooldown(initialCooldown);
  const submit = async (
    path: string,
    body: unknown,
  ): Promise<EmailResult | RegistrationResult | null> => {
    if (lock.current || cooldown.active()) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<EmailResult | RegistrationResult>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const accepted = path.endsWith("/register")
        ? ["registered", "verification_required", "check_email"].includes(result.status)
        : result.status === "check_email";
      if (!accepted) {
        throw new Error("The account service did not confirm this request. Please try again.");
      }
      if (result.status !== "registered") cooldown.restart(result.cooldown_seconds);
      return result;
    } catch (failure) {
      setError(message(failure));
      if (failure instanceof ApiError && failure.status === 429)
        cooldown.restart(failure.retryAfterSeconds);
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { error, busy, cooldown, submit };
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Please try again.";

export function SignInPage() {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const navigate = useNavigate();
  const availability = useAvailability();
  const { session, ready } = useAuth();
  if (ready && session) return <Navigate to="/" replace />;
  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">{t("Sign in to Shay Sett")}</h1>
      <p className="mb-7 mt-3 text-muted-foreground">
        {t("Manage your business finances in one place.")}
      </p>
      <form
        noValidate
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setError("");
          setNeedsConfirmation(false);
          if (!validEmail(email)) {
            setError("Enter a valid email address.");
            return;
          }
          if (!password) {
            setError("Enter your password.");
            return;
          }
          if (availability.blocked) {
            setError(availability.notice);
            return;
          }
          setBusy(true);
          try {
            const { error } = await requireAuthClient().auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (error) {
              setNeedsConfirmation(error.code === "email_not_confirmed");
              setError(
                error.code === "email_not_confirmed"
                  ? "Confirm your email before signing in. Open the link in your inbox or request a new one below."
                  : error.status === 429
                    ? "Too many attempts. Please wait and try again."
                    : error.name === "AuthRetryableFetchError" ||
                        error.status === 0 ||
                        (error.status !== undefined && error.status >= 500)
                      ? "Cannot reach the account service. Check your connection and try again."
                      : "Email or password is incorrect",
              );
              return;
            }
            setPassword("");
            await navigate({ to: "/" });
          } catch (failure) {
            setError(message(failure));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label={t("Email address")}
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField value={password} onChange={setPassword} />
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t("Forgot password?")}
          </Link>
        </div>
        <FormError message={error} />
        {needsConfirmation && (
          <Link to="/verify-email" className="block text-sm font-semibold text-primary">
            {t("Request a confirmation email")}
          </Link>
        )}
        <button disabled={busy} className="bf-button w-full">
          {busy ? t("Signing in…") : t("Sign in")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("New to Shay Sett?")}{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          {t("Create an account")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();

  const { policy } = usePolicy();
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [business, setBusiness] = useState<BusinessDetails>({ ...emptyBusiness });
  const [error, setError] = useState("");
  const request = useAccountRequest();
  const availability = useAvailability(true);
  const navigate = useNavigate();
  const queries = useQueryClient();
  const signupLock = useRef(false);
  const [finishing, setFinishing] = useState(false);
  const [verification, setVerification] = useState<EmailResult | null>(null);
  const busy = request.busy || finishing;
  const set = (key: keyof typeof account, value: string) =>
    setAccount({ ...account, [key]: value });
  if (verification)
    return <VerificationPage initialEmail={account.email.trim()} initialResult={verification} />;
  return (
    <AuthShell>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
        {t("Step")} {step} {t("of 2 ·")} {step === 1 ? t("Account details") : t("Business details")}
      </p>
      <h1 className="text-3xl font-bold">{t("Create your account")}</h1>
      <p className="mb-6 mt-3 text-sm text-muted-foreground">
        {step === 1
          ? t("Start with your name and a secure password.")
          : t("Tell us about the business you’ll manage.")}
      </p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (signupLock.current || busy || (step === 2 && request.cooldown.active())) return;
          setError("");
          if (!account.full_name.trim() || account.full_name.trim().length > 120) {
            setStep(1);
            setError("Enter your full name (up to 120 characters).");
            return;
          }
          if (!validEmail(account.email)) {
            setStep(1);
            setError("Enter a valid email address.");
            return;
          }
          const passwordError = passwordProblem(account.password, account.confirm_password, policy);
          if (passwordError) {
            setStep(1);
            setError(passwordError);
            return;
          }
          if (step === 1) {
            setStep(2);
            return;
          }
          const problem = businessProblem(business);
          if (problem) {
            setError(problem);
            return;
          }
          if (availability.blocked) {
            setError(availability.notice);
            return;
          }
          signupLock.current = true;
          setFinishing(true);
          try {
            const result = await request.submit("/api/v1/auth/register", {
              ...account,
              full_name: account.full_name.trim(),
              email: account.email.trim(),
              business,
            });
            if (!result) return;
            setAccount((previous) => ({ ...previous, password: "", confirm_password: "" }));
            if (result.status !== "registered") {
              setVerification(result);
              return;
            }
            const { error: sessionError } = await requireAuthClient().auth.setSession(
              result.session,
            );
            if (sessionError)
              throw new Error(
                "Your account was created, but automatic sign-in failed. Please sign in.",
              );
            await queries.invalidateQueries({ queryKey: ["account"] });
            await navigate({ to: "/onboarding" });
          } catch (failure) {
            setError(message(failure));
          } finally {
            signupLock.current = false;
            setFinishing(false);
          }
        }}
      >
        {step === 1 ? (
          <>
            <Field
              label={t("Full name")}
              name="full_name"
              required
              maxLength={120}
              autoComplete="name"
              value={account.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
            <Field
              label={t("Email address")}
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={account.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <PasswordField
              autoComplete="new-password"
              value={account.password}
              onChange={(value) => set("password", value)}
            />
            <Requirements policy={policy} />
            <PasswordField
              label={t("Confirm password")}
              autoComplete="new-password"
              value={account.confirm_password}
              onChange={(value) => set("confirm_password", value)}
            />
          </>
        ) : (
          <BusinessFields value={business} onChange={setBusiness} />
        )}
        <FormError message={error || request.error} />
        <div className="flex gap-3">
          {step === 2 && (
            <button
              type="button"
              disabled={busy}
              className="bf-button-secondary"
              onClick={() => {
                setStep(1);
                setError("");
              }}
            >
              {t("Back")}
            </button>
          )}
          <button
            disabled={busy || (step === 2 && request.cooldown.seconds > 0)}
            className="bf-button flex-1"
          >
            {busy
              ? t("Creating account...")
              : step === 1
                ? t("Continue")
                : request.cooldown.seconds
                  ? t("Try again in {0}s", { "0": request.cooldown.seconds })
                  : t("Create account")}
          </button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("Already have an account?")}{" "}
        <Link to="/sign-in" className="font-semibold text-primary">
          {t("Sign in")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function VerificationPage({
  initialEmail = "",
  initialResult,
}: {
  initialEmail?: string;
  initialResult?: EmailResult | undefined;
}) {
  return (
    <EmailRequestPage
      kind="verification"
      initialEmail={initialEmail}
      initialResult={initialResult}
    />
  );
}
export function ForgotPasswordPage() {
  return <EmailRequestPage kind="recovery" />;
}
function EmailRequestPage({
  kind,
  initialEmail = "",
  initialResult,
}: {
  kind: "verification" | "recovery";
  initialEmail?: string;
  initialResult?: EmailResult | undefined;
}) {
  const { t } = useTranslation();

  const verification = kind === "verification";
  const existingAccount = verification && initialResult?.status === "check_email";
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(!!initialResult);
  const request = useAccountRequest(initialResult?.cooldown_seconds);
  const availability = useAvailability();
  const problem = error || request.error;
  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">
        {existingAccount
          ? t("Continue with your account")
          : verification
            ? t("Confirm your email")
            : t("Forgot your password?")}
      </h1>
      <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
        {existingAccount
          ? t(
              "If you already registered with this email, sign in with your existing password or reset it. If you are waiting for confirmation, check your inbox or request a new link below.",
            )
          : verification
            ? t(
                "Open the confirmation link in your email, then sign in to finish setting up your business. If you already have an account, sign in or reset your password.",
              )
            : t("Enter your email address to request a secure reset link.")}
      </p>
      {existingAccount && (
        <div className="mb-6 flex flex-wrap gap-4 text-sm font-semibold text-primary">
          <Link to="/sign-in">{t("Sign in")}</Link>
          <Link to="/forgot-password">{t("Reset password")}</Link>
        </div>
      )}
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (request.busy || request.cooldown.active()) return;
          setError("");
          setAccepted(false);
          if (!validEmail(email)) {
            setError("Enter a valid email address.");
            return;
          }
          if (availability.blocked) {
            setError(availability.notice);
            return;
          }
          const result = await request.submit(
            verification ? "/api/v1/auth/resend-verification" : "/api/v1/auth/forgot-password",
            {
              email: email.trim(),
            },
          );
          if (result) setAccepted(true);
        }}
      >
        <Field
          label={t("Email address")}
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setAccepted(false);
          }}
        />
        <FormError message={problem} />
        {!problem && accepted && (
          <p role="status" className="text-sm text-primary">
            {verification
              ? t(
                  "If this address needs confirmation, check your inbox and spam folder for the link.",
                )
              : t(
                  "If an account exists for this email, check your inbox and spam folder for a password reset link.",
                )}
          </p>
        )}
        <button
          className="bf-button w-full"
          disabled={request.busy || request.cooldown.seconds > 0}
        >
          {request.busy
            ? t("Sending...")
            : request.cooldown.seconds
              ? t("Try again in {0}s", { "0": request.cooldown.seconds })
              : verification
                ? t("Resend confirmation email")
                : t("Send reset link")}
        </button>
      </form>
      <Link to="/sign-in" className="mt-6 block text-center text-sm font-semibold text-primary">
        {t("Back to sign in")}
      </Link>
    </AuthShell>
  );
}

export function EmailCallbackPage() {
  const { t } = useTranslation();

  const [error, setError] = useState("");
  const pending = useRef<Promise<{ recovery: boolean }> | null>(null);
  const navigate = useNavigate();
  const { setRecoveryReady } = useAuth();
  useEffect(() => {
    let active = true;
    setRecoveryReady(false);
    pending.current ??= completeEmailCallback();
    void pending.current
      .then(async (result) => {
        if (!active) return;
        setRecoveryReady(result.recovery);
        await navigate({ to: result.recovery ? "/reset-password" : "/", replace: true });
      })
      .catch((failure) => {
        if (active) setError(message(failure));
      });
    return () => {
      active = false;
    };
  }, [navigate, setRecoveryReady]);
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold">
        {error ? t("We couldn’t verify this link") : t("Verifying your link…")}
      </h1>
      {error ? (
        <div className="mt-5 space-y-4">
          <FormError message={error} />
          <Link to="/verify-email" className="block text-sm font-semibold text-primary">
            {t("Request a confirmation email")}
          </Link>
          <Link to="/forgot-password" className="block text-sm font-semibold text-primary">
            {t("Request a password reset")}
          </Link>
          <Link to="/sign-in" className="block text-sm text-muted-foreground">
            {t("Back to sign in")}
          </Link>
        </div>
      ) : (
        <p role="status" className="mt-4 text-muted-foreground">
          {t("Please wait while we confirm your account.")}
        </p>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();

  const { recoveryReady, signOut, setRecoveryReady } = useAuth();
  const { policy } = usePolicy();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  if (done)
    return (
      <AuthShell>
        <h1 className="text-2xl font-bold">{t("Password updated")}</h1>
        <p className="my-4 text-muted-foreground">
          {t("Sign in with your new password to continue.")}
        </p>
        <Link to="/sign-in" className="bf-button inline-block">
          {t("Back to sign in")}
        </Link>
      </AuthShell>
    );
  if (!recoveryReady)
    return (
      <AuthShell>
        <h1 className="text-2xl font-bold">{t("Open your password reset link")}</h1>
        <p className="my-4 text-muted-foreground">
          {t(
            "This reset session is missing or has expired. Request a new link to choose a password.",
          )}
        </p>
        <Link to="/forgot-password" className="bf-button inline-block">
          {t("Request a new reset link")}
        </Link>
      </AuthShell>
    );
  return (
    <AuthShell>
      <h1 className="mb-6 text-3xl font-bold">{t("Choose a new password")}</h1>
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const problem = passwordProblem(password, confirm, policy);
          if (problem) {
            setError(problem);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const { error } = await requireAuthClient().auth.updateUser({ password });
            if (error)
              throw new Error(
                error.code === "weak_password"
                  ? "Password does not meet the account provider’s password policy."
                  : "Your reset link expired or the password could not be changed. Request a new link.",
              );
            setPassword("");
            setConfirm("");
            await signOut();
            setRecoveryReady(false);
            setDone(true);
          } catch (failure) {
            setError(message(failure));
          } finally {
            setBusy(false);
          }
        }}
      >
        <PasswordField
          label={t("New password")}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <Requirements policy={policy} />
        <PasswordField
          label={t("Confirm password")}
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />
        <FormError message={error} />
        <button disabled={busy} className="bf-button w-full">
          {busy ? t("Updating password…") : t("Update password")}
        </button>
      </form>
    </AuthShell>
  );
}

export function OnboardingPage() {
  const account = useAccount();
  if (account.isPending || !account.data) return <Loading />;
  return (
    <BusinessSetup
      key={account.data.user.id}
      initial={account.data.pending_business || emptyBusiness}
      initialName={account.data.user.full_name}
    />
  );
}
function BusinessSetup({
  initial,
  initialName,
}: {
  initial: BusinessDetails;
  initialName: string;
}) {
  const { t } = useTranslation();

  const [business, setBusiness] = useState({ ...initial });
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const queries = useQueryClient();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">{t("Finish business setup")}</h1>
      <p className="mb-6 mt-3 text-sm text-muted-foreground">
        {t(
          "Confirm your details to create your own empty workspace. You can return here after signing in if you need to finish later.",
        )}
      </p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (!name.trim() || name.trim().length > 120) {
            setError("Enter your full name.");
            return;
          }
          const problem = businessProblem(business);
          if (problem) {
            setError(problem);
            return;
          }
          setBusy(true);
          try {
            const result = await api<{ business_id: string }>("/api/v1/auth/onboarding", {
              method: "POST",
              body: JSON.stringify({ ...business, full_name: name.trim() }),
            });
            sessionStorage.setItem("bizflow-business", result.business_id);
            await queries.invalidateQueries({ queryKey: ["account"] });
            await queries.invalidateQueries({ queryKey: ["businesses"] });
            await navigate({ to: "/", replace: true });
          } catch (failure) {
            setError(message(failure));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label={t("Full name")}
          name="full_name"
          required
          autoComplete="name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <BusinessFields value={business} onChange={setBusiness} />
        <FormError message={error} />
        <button className="bf-button w-full" disabled={busy}>
          {busy ? t("Saving workspace…") : t("Create business workspace")}
        </button>
      </form>
      <button className="bf-button-link mt-5 w-full text-sm" onClick={() => void signOut()}>
        {t("Sign out and finish later")}
      </button>
    </AuthShell>
  );
}
