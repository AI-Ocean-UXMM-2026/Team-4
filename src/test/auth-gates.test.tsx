import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  pending: false,
  complete: false,
  ready: true,
}));
vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => <span>Redirect: {to}</span>,
}));
vi.mock("@/app/session", () => ({
  useAuth: () => ({ session: state.session, ready: state.ready, signOut: vi.fn() }),
  useAccount: () => ({
    isPending: state.pending,
    isError: false,
    data: { onboarding_complete: state.complete },
  }),
  useConfig: () => ({}),
}));
import { AccountGate } from "@/app/providers";
beforeEach(() => {
  state.session = null;
  state.pending = false;
  state.complete = false;
  state.ready = true;
});
it("redirects an unregistered visitor without rendering private content", () => {
  render(
    <AccountGate>
      <p>Private dashboard</p>
    </AccountGate>,
  );
  expect(screen.getByText("Redirect: /sign-in")).toBeInTheDocument();
  expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument();
});
it("routes an authenticated user with unfinished setup to onboarding", () => {
  state.session = { user: { id: "verified-owner" } };
  render(
    <AccountGate>
      <p>Private dashboard</p>
    </AccountGate>,
  );
  expect(screen.getByText("Redirect: /onboarding")).toBeInTheDocument();
});
it("waits for server account verification before rendering a dashboard", () => {
  state.session = { user: { id: "owner" } };
  state.pending = true;
  render(
    <AccountGate>
      <p>Private dashboard</p>
    </AccountGate>,
  );
  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument();
});
it("renders private content only after completed server setup", () => {
  state.session = { user: { id: "owner" } };
  state.complete = true;
  render(
    <AccountGate>
      <p>Private dashboard</p>
    </AccountGate>,
  );
  expect(screen.getByText("Private dashboard")).toBeInTheDocument();
});
