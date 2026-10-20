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
    policy: config.data?.password_policy || { min_length: 8, required_characters: [] },
  };
}
function useAvailability() {
  const query = useConfig();
  const notice = query.isError
    ? "Unable to verify account configuration. Please try again shortly."
    : !query.data
      ? "Checking account configuration..."
      : !query.data.auth_status?.ready || !authClient()
        ? query.data.auth_status?.message ||
          "Account access is being configured. Please try again later."
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
      setClock(Date.now());
      setDeadline(seconds !== undefined ? Date.now() + seconds * 1000 : 0);
    },
  };
}
type EmailResult = {
  status: "verification_required" | "check_email";
  cooldown_seconds?: number;
  message: string;
};
function useEmailRequest(initialCooldown?: number) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const cooldown = useCooldown(initialCooldown);
  const submit = async (path: string, body: unknown): Promise<EmailResult | null> => {
    if (lock.current || cooldown.active()) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<EmailResult>(path, { method: "POST", body: JSON.stringify(body) });
      if (result.status !== "verification_required" && result.status !== "check_email") {
        throw new Error(
          "The account service did not confirm this request. Check your email before retrying.",
        );
      }
      cooldown.restart(result.cooldown_seconds);
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const availability = useAvailability();
  const { session, ready } = useAuth();
  if (ready && session) return <Navigate to="/" replace />;
  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">Sign in to BIZFLOW</h1>
      <p className="mb-7 mt-3 text-muted-foreground">Manage your business finances in one place.</p>
      <form
        noValidate
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (availability.blocked || busy) return;
          setError("");
          if (!validEmail(email)) {
            setError("Enter a valid email address.");
            return;
          }
          if (!password) {
            setError("Enter your password.");
            return;
          }
          setBusy(true);
          try {
            const { error } = await requireAuthClient().auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (error) {
              setError(
                error.code === "email_not_confirmed"
                  ? "Verify your email before signing in. You can request a new verification email below."
                  : error.status === 429
                    ? "Too many attempts. Please wait and try again."
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
          label="Email address"
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
            Forgot password?
          </Link>
        </div>
        <FormError message={error || availability.notice} />
        <button disabled={busy || availability.blocked} className="bf-button w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to BIZFLOW?{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-4 text-center text-xs">
        <Link to="/verify-email" className="text-muted-foreground underline">
          Resend verification email
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
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
  const request = useEmailRequest();
  const availability = useAvailability();
  const busy = request.busy;
  const [submitted, setSubmitted] = useState<EmailResult | null>(null);
  const set = (key: keyof typeof account, value: string) =>
    setAccount({ ...account, [key]: value });
  if (submitted)
    return <VerificationPage initialEmail={account.email.trim()} initialResult={submitted} />;
  return (
    <AuthShell>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
        Step {step} of 2 · {step === 1 ? "Account details" : "Business details"}
      </p>
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mb-6 mt-3 text-sm text-muted-foreground">
        {step === 1
          ? "Start with your name and a secure password."
          : "Tell us about the business you’ll manage."}
      </p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || (step === 2 && (availability.blocked || request.cooldown.active()))) return;
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
          const result = await request.submit("/api/v1/auth/register", {
            ...account,
            full_name: account.full_name.trim(),
            email: account.email.trim(),
            business,
          });
          if (result) {
            setAccount((previous) => ({ ...previous, password: "", confirm_password: "" }));
            setSubmitted(result);
          }
        }}
      >
        {step === 1 ? (
          <>
            <Field
              label="Full name"
              name="full_name"
              required
              maxLength={120}
              autoComplete="name"
              value={account.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
            <Field
              label="Email address"
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
              label="Confirm password"
              autoComplete="new-password"
              value={account.confirm_password}
              onChange={(value) => set("confirm_password", value)}
            />
          </>
        ) : (
          <BusinessFields value={business} onChange={setBusiness} />
        )}
        <FormError message={availability.notice || error || request.error} />
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
              Back
            </button>
          )}
          <button
            disabled={
              busy || (step === 2 && (availability.blocked || request.cooldown.seconds > 0))
            }
            className="bf-button flex-1"
          >
            {busy
              ? "Creating account..."
              : step === 1
                ? "Continue"
                : request.cooldown.seconds
                  ? `Try again in ${request.cooldown.seconds}s`
                  : "Create account"}
          </button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/verify-email" className="mb-3 block font-semibold text-primary">
          Already requested? Check your email or resend verification
        </Link>
        Already have an account?{" "}
        <Link to="/sign-in" className="font-semibold text-primary">
          Sign in
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
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(!!initialResult);
  const request = useEmailRequest(initialResult?.cooldown_seconds);
  const availability = useAvailability();
  const verification = kind === "verification";
  const problem = availability.notice || error || request.error;
  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">
        {verification ? "Check your email" : "Forgot your password?"}
      </h1>
      <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
        {verification
          ? "Open your verification link before signing in to finish business setup. For a new registration, your business details resume after verification. If you already have an account, sign in or reset your password."
          : "Enter your email address to request a secure reset link."}
      </p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (availability.blocked || request.busy || request.cooldown.active()) return;
          setError("");
          setAccepted(false);
          if (!validEmail(email)) {
            setError("Enter a valid email address.");
            return;
          }
          const result = await request.submit(
            `/api/v1/auth/${verification ? "resend-verification" : "forgot-password"}`,
            { email: email.trim() },
          );
          if (result) setAccepted(true);
        }}
      >
        <Field
          label="Email address"
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
              ? "If this address needs verification, check your inbox and spam folder for the link. This response does not confirm email delivery."
              : "If an account exists for this email, check your inbox and spam folder for a password reset link. This response does not confirm email delivery."}
          </p>
        )}
        <button
          className="bf-button w-full"
          disabled={request.busy || availability.blocked || request.cooldown.seconds > 0}
        >
          {request.busy
            ? "Sending?"
            : request.cooldown.seconds
              ? `${verification ? "Resend" : "Try again"} in ${request.cooldown.seconds}s`
              : verification
                ? "Resend verification email"
                : "Send reset link"}
        </button>
      </form>
      <Link to="/sign-in" className="mt-6 block text-center text-sm font-semibold text-primary">
        Back to sign in
      </Link>
    </AuthShell>
  );
}

export function EmailCallbackPage() {
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
        {error ? "We couldn’t verify this link" : "Verifying your link…"}
      </h1>
      {error ? (
        <div className="mt-5 space-y-4">
          <FormError message={error} />
          <Link to="/verify-email" className="block text-sm font-semibold text-primary">
            Request a verification email
          </Link>
          <Link to="/forgot-password" className="block text-sm font-semibold text-primary">
            Request a password reset
          </Link>
          <Link to="/sign-in" className="block text-sm text-muted-foreground">
            Back to sign in
          </Link>
        </div>
      ) : (
        <p role="status" className="mt-4 text-muted-foreground">
          Please wait while we confirm your account.
        </p>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
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
        <h1 className="text-2xl font-bold">Password updated</h1>
        <p className="my-4 text-muted-foreground">Sign in with your new password to continue.</p>
        <Link to="/sign-in" className="bf-button inline-block">
          Back to sign in
        </Link>
      </AuthShell>
    );
  if (!recoveryReady)
    return (
      <AuthShell>
        <h1 className="text-2xl font-bold">Open your password reset link</h1>
        <p className="my-4 text-muted-foreground">
          This reset session is missing or has expired. Request a new link to choose a password.
        </p>
        <Link to="/forgot-password" className="bf-button inline-block">
          Request a new reset link
        </Link>
      </AuthShell>
    );
  return (
    <AuthShell>
      <h1 className="mb-6 text-3xl font-bold">Choose a new password</h1>
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
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <Requirements policy={policy} />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />
        <FormError message={error} />
        <button disabled={busy} className="bf-button w-full">
          {busy ? "Updating password…" : "Update password"}
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
  const [business, setBusiness] = useState({ ...initial });
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const queries = useQueryClient();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">Finish business setup</h1>
      <p className="mb-6 mt-3 text-sm text-muted-foreground">
        Confirm your details to create your own empty workspace. You can return here after signing
        in if you need to finish later.
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
          label="Full name"
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
          {busy ? "Saving workspace…" : "Create business workspace"}
        </button>
      </form>
      <button
        className="mt-5 w-full text-sm text-muted-foreground underline"
        onClick={() => void signOut()}
      >
        Sign out and finish later
      </button>
    </AuthShell>
  );
}
