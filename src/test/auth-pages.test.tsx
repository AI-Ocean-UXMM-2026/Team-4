import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  signIn: vi.fn(),
  setSession: vi.fn(),
  invalidate: vi.fn(),
  navigate: vi.fn(),
  callback: vi.fn(),
  signOut: vi.fn(),
  update: vi.fn(),
  recovery: false,
  configured: true,
  registrationReady: true,
  setRecovery: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  Navigate: ({ to }: { to: string }) => <span>Redirect: {to}</span>,
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  api: mocks.api,
}));
vi.mock("@/lib/auth", () => ({
  authClient: () => ({}),
  requireAuthClient: () => ({
    auth: {
      signInWithPassword: mocks.signIn,
      updateUser: mocks.update,
      setSession: mocks.setSession,
    },
  }),
  completeEmailCallback: mocks.callback,
}));
vi.mock("@/app/session", () => ({
  useAuth: () => ({
    session: null,
    ready: true,
    signOut: mocks.signOut,
    recoveryReady: mocks.recovery,
    setRecoveryReady: mocks.setRecovery,
  }),
  useAccount: () => ({}),
  useConfig: () => ({
    data: {
      auth_configured: mocks.configured,
      auth_status: { ready: mocks.configured && mocks.registrationReady, message: null },
      password_policy: {
        min_length: 8,
        required_characters: ["lower", "upper", "number", "symbol"],
      },
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("@/app/providers", () => ({ Loading: () => <p>Loading</p> }));

import {
  EmailCallbackPage,
  ForgotPasswordPage,
  RegisterPage,
  ResetPasswordPage,
  SignInPage,
  VerificationPage,
} from "@/features/auth/AuthPages";

import { ApiError } from "@/lib/apiClient";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
}
function validRegistration() {
  render(<RegisterPage />);
  fill("Full name", "Owner");
  fill("Email address", "owner@example.test");
  fill("Password", "StrongPassword1!");
  fill("Confirm password", "StrongPassword1!");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fill("Company or business name", "Trading Shop");
  fill("Business type or industry", "Retail");
  fill("City or township", "Yangon");
  return screen.getByRole("button", { name: "Create account" }).closest("form")!;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.recovery = false;
  mocks.configured = true;
  mocks.registrationReady = true;
  mocks.api.mockResolvedValue({
    status: "registered",
    session: { access_token: "access", refresh_token: "refresh" },
  });
  mocks.setSession.mockResolvedValue({ error: null });
  mocks.signIn.mockResolvedValue({ error: null });
});

describe("Account UI", () => {
  it.each([
    [SignInPage, "Sign in"],
    [RegisterPage, "Continue"],
    [ForgotPasswordPage, "Send reset link"],
  ] as const)("opens %s without showing a setup error", (Page, button) => {
    mocks.configured = false;
    render(<Page />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: button })).toBeEnabled();
  });
  it("shows the availability error only after a valid signup attempt", () => {
    mocks.configured = false;
    const form = validRegistration();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Account access is temporarily unavailable",
    );
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it.each([
    [SignInPage, "Sign in"],
    [ForgotPasswordPage, "Send reset link"],
  ] as const)("shows a service error after submitting %s", (Page, button) => {
    mocks.configured = false;
    render(<Page />);
    fill("Email address", "owner@example.test");
    if (Page === SignInPage) fill("Password", "StrongPassword1!");
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Account access is temporarily unavailable",
    );
    expect(mocks.api).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("shows input validation while provider configuration is pending", () => {
    mocks.configured = false;
    render(<RegisterPage />);
    fill("Full name", "Owner");
    fill("Email address", "bad-email");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid email");
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it("locks duplicate signup submits and signs in without an email link", async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const form = validRegistration();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mocks.api).toHaveBeenCalledTimes(1);
    await act(async () =>
      resolve({
        status: "registered",
        session: { access_token: "access", refresh_token: "refresh" },
      }),
    );
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/onboarding" });
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("keeps business fields on a rejected request and shows just the rate limit", async () => {
    mocks.api.mockRejectedValue(
      new ApiError(429, "AUTH_RATE_LIMITED", "Provider email limit reached.", [], 125),
    );
    const form = validRegistration();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Provider email limit reached.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Try again in 125s/ })).toBeDisabled();
    expect(screen.getByLabelText("Company or business name")).toHaveValue("Trading Shop");
    expect(screen.queryByText(/Account access is being configured/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
  });
  it("lets an existing user request a confirmation email", async () => {
    mocks.api.mockResolvedValue({ status: "check_email", cooldown_seconds: 60 });
    render(<VerificationPage />);
    expect(screen.getByRole("heading", { name: "Confirm your email" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fill("Email address", "owner@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect(await screen.findByRole("status")).toHaveTextContent("check your inbox");
    expect(mocks.api).toHaveBeenCalledWith("/api/v1/auth/resend-verification", expect.anything());
  });
  it.each(["verification_required", "check_email"])(
    "handles the %s signup result without claiming automatic sign-in",
    async (status) => {
      mocks.api.mockResolvedValue({ status, cooldown_seconds: 60, message: "Check your email" });
      fireEvent.submit(validRegistration());
      expect(
        await screen.findByRole("heading", {
          name: status === "check_email" ? "Continue with your account" : "Confirm your email",
        }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Email address")).toHaveValue("owner@example.test");
      expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Try again in 60s" })).toBeDisabled();
      expect(mocks.setSession).not.toHaveBeenCalled();
      expect(mocks.navigate).not.toHaveBeenCalled();
      if (status === "check_email")
        expect(screen.getByRole("link", { name: "Reset password" })).toHaveAttribute(
          "href",
          "/forgot-password",
        );
    },
  );
  it("offers confirmation recovery when the provider rejects an unconfirmed sign-in", async () => {
    mocks.signIn.mockResolvedValue({ error: { code: "email_not_confirmed", status: 400 } });
    render(<SignInPage />);
    fill("Email address", "owner@example.test");
    fill("Password", "StrongPassword1!");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Confirm your email before signing in",
    );
    expect(screen.getByRole("link", { name: "Request a confirmation email" })).toHaveAttribute(
      "href",
      "/verify-email",
    );
  });
  it("shows an automatic sign-in failure without pretending registration failed", async () => {
    mocks.setSession.mockResolvedValue({ error: { message: "failed" } });
    fireEvent.submit(validRegistration());
    expect(await screen.findByRole("alert")).toHaveTextContent("Your account was created");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("rejects weak character combinations before sending signup", () => {
    render(<RegisterPage />);
    fill("Full name", "Owner");
    fill("Email address", "owner@example.test");
    fill("Password", "weakpassword");
    fill("Confirm password", "weakpassword");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("character types");
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it("uses labeled credentials and a password visibility control, with no demo field", () => {
    render(<SignInPage />);
    expect(screen.getByRole("heading", { name: "Sign in to Shay Sett" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Demo password")).not.toBeInTheDocument();
    const password = screen.getByLabelText("Password", { exact: true });
    expect(password).toHaveAttribute("autocomplete", "current-password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });
  it("shows generic invalid credentials and passes passwords unchanged", async () => {
    mocks.signIn.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    render(<SignInPage />);
    fill("Email address", " owner@example.test ");
    fill("Password", " password with spaces ");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email or password is incorrect")).toBeInTheDocument();
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: " password with spaces ",
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("navigates only after the provider accepts sign-in", async () => {
    render(<SignInPage />);
    fill("Email address", "owner@example.test");
    fill("Password", "correct password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" }));
  });
  it.each([
    { name: "AuthRetryableFetchError", status: 0 },
    { name: "AuthApiError", status: 503 },
  ])("does not label a service failure as an incorrect password: %j", async (error) => {
    mocks.signIn.mockResolvedValue({ error });
    render(<SignInPage />);
    fill("Email address", "owner@example.test");
    fill("Password", "StrongPassword1!");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the account service");
    expect(screen.queryByText("Email or password is incorrect")).not.toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("allows existing accounts to sign in while new registration is unavailable", async () => {
    mocks.registrationReady = false;
    render(<SignInPage />);
    fill("Email address", "owner@example.test");
    fill("Password", "StrongPassword1!");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" }));
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: "StrongPassword1!",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("shows the actual sign-in error while new registration is unavailable", async () => {
    mocks.registrationReady = false;
    mocks.signIn.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    render(<SignInPage />);
    fill("Email address", "owner@example.test");
    fill("Password", "StrongPassword1!");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("retains the registration check for new accounts", () => {
    mocks.registrationReady = false;
    fireEvent.submit(validRegistration());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Account creation is temporarily unavailable",
    );
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it("allows password recovery while new registration is unavailable", async () => {
    mocks.registrationReady = false;
    mocks.api.mockResolvedValue({ status: "check_email", cooldown_seconds: 60 });
    render(<ForgotPasswordPage />);
    fill("Email address", "owner@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
    expect(mocks.api).toHaveBeenCalledWith("/api/v1/auth/forgot-password", expect.anything());
  });
  it("validates account and business steps, then starts onboarding immediately", async () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your full name");
    fill("Full name", "Owner");
    fill("Email address", "bad");
    fill("Password", "x");
    fill("Confirm password", "x");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid email");
    fill("Email address", "owner@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 8");
    fill("Password", " StrongPassword1! ");
    fill("Confirm password", "different");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
    fill("Confirm password", " StrongPassword1! ");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("business name");
    fill("Company or business name", "Trading Shop");
    fill("Business type or industry", "Retail");
    fill("City or township", "Yangon");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/onboarding" }));
    const payload = JSON.parse(mocks.api.mock.calls[0]![1].body);
    expect(payload.password).toBe(" StrongPassword1! ");
    expect(payload.business.currency).toBe("MMK");
    expect(mocks.setSession).toHaveBeenCalled();
  });
  it("does not reveal whether a reset email exists", async () => {
    mocks.api.mockResolvedValue({ status: "check_email", cooldown_seconds: 60 });
    render(<ForgotPasswordPage />);
    fill("Email address", "unknown@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
  });
  it("handles expired verification links", async () => {
    mocks.callback.mockRejectedValue(new Error("This link is invalid or has expired."));
    render(<EmailCallbackPage />);
    expect(
      await screen.findByRole("heading", { name: "We couldn’t verify this link" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a password reset" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
  it("requires a verified recovery flow before showing password reset controls", () => {
    render(<ResetPasswordPage />);
    expect(
      screen.getByRole("heading", { name: "Open your password reset link" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });
  it("updates the password with the provider and signs out the recovered session", async () => {
    mocks.recovery = true;
    mocks.update.mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    fill("New password", "NewPassword1!");
    fill("Confirm password", "NewPassword1!");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(mocks.update).toHaveBeenCalledWith({ password: "NewPassword1!" });
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
