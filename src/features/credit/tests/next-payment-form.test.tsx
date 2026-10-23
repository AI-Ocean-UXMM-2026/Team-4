import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { NextPaymentForm } from "../components/NextPaymentForm";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/apiClient", () => ({ api: mocks.api }));
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ language: "en" }) }));
afterEach(() => {
  cleanup();
  mocks.api.mockReset();
});
const balance = {
  id: "balance",
  lender_kind: "individual" as const,
  lender_name: "Person",
  outstanding_principal_mmk: "1000000",
  as_of_date: "2026-10-01",
};
it("saves an explicitly stated payment without inventing loan terms", async () => {
  mocks.api.mockResolvedValue({
    ...balance,
    annual_rate_pct: "12.000",
    remaining_term_months: 12,
    next_payment_date: "2026-11-03",
    next_payment_mmk: "120000",
    payment_frequency: "weekly",
    repayment_terms: {
      rate_period: "annual",
      entered_rate_pct: "12",
      interest_method: "reducing_balance",
      regular_payment_mmk: "120000",
      next_payment_fees_mmk: "0",
      balloon_payment_mmk: "0",
      grace_months: 0,
    },
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextPaymentForm businessId="mine" balance={balance} asOf="2026-10-23" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("Add next payment to view repayment table"));
  fireEvent.change(screen.getByRole("spinbutton", { name: /agreed interest rate/i }), {
    target: { value: "12" },
  });
  fireEvent.change(screen.getByLabelText(/2. How many months remain/), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText("4. When is your next payment due?"), {
    target: { value: "2026-11-03" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /regular instalment excluding fees/i }), {
    target: { value: "120000" },
  });
  fireEvent.change(screen.getByLabelText("3. How often are payments due?"), {
    target: { value: "weekly" },
  });
  fireEvent.change(screen.getByLabelText("Interest calculation method"), {
    target: { value: "reducing_balance" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save next payment" }));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.api.mock.calls[0]![1].body)).toMatchObject({
    annual_rate_pct: "12.000",
    remaining_term_months: 12,
    next_payment_date: "2026-11-03",
    next_payment_mmk: "120000",
    payment_frequency: "weekly",
  });
  await screen.findByText("Recorded next payment");
  expect(screen.queryByText("Add next payment to view repayment table")).toBeNull();
  expect(screen.getByRole("button", { name: "Save next payment" })).toBeVisible();
});

it("shows the repayment table from the confirmed saved terms without waiting for a page refresh", async () => {
  mocks.api.mockResolvedValue(complete);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextPaymentForm businessId="mine" balance={balance} asOf="2026-10-23" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("Add next payment to view repayment table"));
  fireEvent.change(screen.getByLabelText("Interest rate period"), { target: { value: "monthly" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: /agreed interest rate/i }), {
    target: { value: "1.1" },
  });
  fireEvent.change(screen.getByLabelText("Interest calculation method"), {
    target: { value: "reducing_balance" },
  });
  fireEvent.change(screen.getByLabelText(/How many months remain/), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("4. When is your next payment due?"), {
    target: { value: "2026-11-23" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /regular instalment excluding fees/i }), {
    target: { value: "210000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save next payment" }));
  await screen.findByText("Next payment saved.");
  expect(screen.getByRole("table")).toBeVisible();
  expect(screen.queryByText(/An estimate requires monthly reducing-balance terms/)).toBeNull();
});
it("keeps past recorded dates visible for review", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextPaymentForm
        businessId="mine"
        balance={{
          ...balance,
          next_payment_date: "2026-10-20",
          next_payment_mmk: "120000",
          payment_frequency: "monthly",
          annual_rate_pct: "12",
          remaining_term_months: 6,
        }}
        asOf="2026-10-23"
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText("10/20/2026 (MM/DD/YYYY)")).toBeVisible();
  expect(screen.getByText("3 days past the recorded date — review payment status")).toBeVisible();
  expect(screen.getByText("12%")).toBeVisible();
  expect(screen.getByText("6 months")).toBeVisible();
  expect(screen.getByText("Edit next payment")).toBeVisible();
});

it("sends monthly rates, separate fees and special repayment terms", async () => {
  mocks.api.mockImplementation(async (_url, options) => ({
    ...balance,
    ...JSON.parse(options.body),
  }));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextPaymentForm editable businessId="mine" balance={balance} asOf="2026-10-23" />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Interest rate period"), { target: { value: "monthly" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: /agreed interest rate/i }), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Interest calculation method"), {
    target: { value: "interest_only" },
  });
  fireEvent.change(screen.getByLabelText(/How many months remain/), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText("4. When is your next payment due?"), {
    target: { value: "2026-11-03" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /regular instalment excluding fees/i }), {
    target: { value: "10000" },
  });
  fireEvent.change(screen.getByLabelText(/Next-payment fees/), { target: { value: "500" } });
  fireEvent.change(screen.getByLabelText(/Final lump-sum principal/), {
    target: { value: "1000000" },
  });
  fireEvent.change(screen.getByLabelText(/Remaining grace period/), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Save next payment" }));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.api.mock.calls[0]![1].body)).toMatchObject({
    annual_rate_pct: "12.000",
    next_payment_mmk: "10500",
    outstanding_principal_mmk: "1000000",
    as_of_date: "2026-10-01",
    repayment_terms: {
      rate_period: "monthly",
      entered_rate_pct: "1",
      interest_method: "interest_only",
      regular_payment_mmk: "10000",
      next_payment_fees_mmk: "500",
      balloon_payment_mmk: "1000000",
      grace_months: 2,
    },
  });
});

const complete = {
  ...balance,
  annual_rate_pct: "13.200",
  remaining_term_months: 5,
  next_payment_date: "2026-11-23",
  next_payment_mmk: "210000",
  payment_frequency: "monthly",
  repayment_terms: {
    rate_period: "monthly" as const,
    entered_rate_pct: "1.1",
    interest_method: "reducing_balance" as const,
    regular_payment_mmk: "210000",
    next_payment_fees_mmk: "0",
    balloon_payment_mmk: "0",
    grace_months: 0,
  },
};
it("accepts decimal-normalized rates without a restart warning", async () => {
  mocks.api.mockResolvedValue(complete);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextPaymentForm editable businessId="mine" balance={complete} asOf="2026-10-23" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save next payment" }));
  await screen.findByText("Next payment saved.");
  expect(mocks.api).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).toBeNull();
});
it("checks persisted details if the save response omits fields", async () => {
  mocks.api
    .mockResolvedValueOnce({ ...complete, repayment_terms: null })
    .mockResolvedValueOnce({ recorded_balances: [complete] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextPaymentForm editable businessId="mine" balance={complete} asOf="2026-10-23" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save next payment" }));
  await screen.findByText("Next payment saved.");
  expect(mocks.api).toHaveBeenCalledTimes(2);
  expect(mocks.api.mock.calls[1]![0]).toContain("/summary?");
});
it("keeps entries and reports genuinely missing fields without asking for a restart", async () => {
  mocks.api
    .mockResolvedValueOnce({ ...complete, repayment_terms: null })
    .mockResolvedValueOnce({ recorded_balances: [{ ...complete, repayment_terms: null }] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextPaymentForm editable businessId="mine" balance={complete} asOf="2026-10-23" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save next payment" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).not.toMatch(/restart/i);
  expect(screen.queryByText("Next payment saved.")).toBeNull();
  expect(screen.getByRole("spinbutton", { name: /agreed interest rate/i })).toHaveValue(1.1);
});
