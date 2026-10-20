import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  signIn: vi.fn(),
  navigate: vi.fn(),
  callback: vi.fn(),
  signOut: vi.fn(),
  update: vi.fn(),
  recovery: false,
  configured: true,
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
    auth: { signInWithPassword: mocks.signIn, updateUser: mocks.update },
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
      auth_status: { ready: mocks.configured, message: null },
      password_policy: { min_length: 8, required_characters: [] },
    },
  }),
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
  fill("Password", "secure password");
  fill("Confirm password", "secure password");
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
  mocks.api.mockResolvedValue({ status: "verification_required", cooldown_seconds: 60 });
  mocks.signIn.mockResolvedValue({ error: null });
});

describe("Account UI", () => {
  it("keeps the configuration notice and blocks signup until readiness is confirmed", () => {
    mocks.configured = false;
    const form = validRegistration();
    fireEvent.submit(form);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Account access is being configured");
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it("locks duplicate signup submits and leaves the form only after accepted verification", async () => {
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
    await act(async () => resolve({ status: "verification_required", cooldown_seconds: 125 }));
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend in 125s/ })).toBeDisabled();
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
  it("does not guess a countdown when the provider gives no retry time", async () => {
    mocks.api.mockRejectedValue(
      new ApiError(429, "AUTH_RATE_LIMITED", "Please wait and try later."),
    );
    render(<VerificationPage />);
    fill("Email address", "owner@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please wait and try later.");
    expect(screen.queryByRole("button", { name: /Resend in/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("honors a known deadline without automatically retrying", async () => {
    vi.useFakeTimers();
    try {
      render(
        <VerificationPage
          initialEmail="owner@example.test"
          initialResult={{ status: "verification_required", message: "", cooldown_seconds: 2 }}
        />,
      );
      expect(screen.getByRole("button", { name: "Resend in 2s" })).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(screen.getByRole("button", { name: "Resend verification email" })).toBeEnabled();
      expect(mocks.api).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it("resends using the resend route and replaces the prior success with an error", async () => {
    mocks.api.mockRejectedValue(
      new ApiError(503, "AUTH_UNAVAILABLE", "Delivery is not confirmed."),
    );
    render(
      <VerificationPage
        initialEmail="owner@example.test"
        initialResult={{ status: "verification_required", message: "", cooldown_seconds: 0 }}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Delivery is not confirmed.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith(
      "/api/v1/auth/resend-verification",
      expect.objectContaining({ body: JSON.stringify({ email: "owner@example.test" }) }),
    );
  });
  it("uses labeled credentials and a password visibility control, with no demo field", () => {
    render(<SignInPage />);
    expect(screen.getByRole("heading", { name: "Sign in to BIZFLOW" })).toBeInTheDocument();
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
  it("validates account and business steps, then asks for email verification", async () => {
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
    fill("Password", " secure password ");
    fill("Confirm password", "different");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
    fill("Confirm password", " secure password ");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("business name");
    fill("Company or business name", "Trading Shop");
    fill("Business type or industry", "Retail");
    fill("City or township", "Yangon");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    const payload = JSON.parse(mocks.api.mock.calls[0]![1].body);
    expect(payload.password).toBe(" secure password ");
    expect(payload.business.currency).toBe("MMK");
    expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  });
  it("does not reveal whether a reset email exists", async () => {
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
    fill("New password", "a new password");
    fill("Confirm password", "a new password");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(mocks.update).toHaveBeenCalledWith({ password: "a new password" });
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
