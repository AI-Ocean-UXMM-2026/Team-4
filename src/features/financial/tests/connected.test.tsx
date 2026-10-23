import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConnectedFinancialPage } from "../pages/ConnectedFinancialPage";
import { formatMmk } from "../types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  imported: vi.fn(),
  business: { id: "A", name: "Imported Store" },
  state: {
    isPending: false,
    isFetching: false,
    isError: false,
    error: new Error("Snapshot failed"),
    data: { business_id: "A", source_version: 1 },
    refetch: vi.fn(),
  },
}));
vi.mock("@/app/providers", () => ({
  usePlatform: () => ({ business: mocks.business, imported: mocks.imported }),
  useSnapshot: () => mocks.state,
}));
vi.mock("@/lib/apiClient", () => ({ api: mocks.api }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.imported.mockResolvedValue(undefined);
  mocks.business = { id: "A", name: "Imported Store" };
  mocks.state.isFetching = false;
  mocks.state.isError = false;
  mocks.state.data = { business_id: "A", source_version: 1 };
  mocks.api.mockImplementation(async (path: string) => {
    const url = new URL(path, "http://test");
    const businessId = url.searchParams.get("business_id") || "A";
    const common = {
      business_id: businessId,
      source_version: 1,
      import_batch_id: `import-${businessId}`,
      as_of: "2026-10-21T03:30:00Z",
    };
    if (url.pathname.endsWith("/trends"))
      return {
        ...common,
        granularity: url.searchParams.get("granularity"),
        points: [
          {
            period: { start: url.searchParams.get("start"), end: url.searchParams.get("end") },
            revenue_mmk: "0.00",
            cogs_mmk: "0.00",
            operating_expenses_mmk: "0.00",
            total_costs_mmk: "0.00",
            revenue_record_count: 0,
            operating_expense_record_count: 0,
          },
        ],
      };
    return {
      ...common,
      period: { start: url.searchParams.get("start"), end: url.searchParams.get("end") },
      actual: {
        revenue_mmk: businessId === "B" ? "90.00" : "150.75",
        cogs_mmk: businessId === "B" ? "40.00" : null,
        gross_profit_mmk: businessId === "B" ? "50.00" : null,
        operating_expenses_mmk: "20.10",
        operating_profit_mmk: businessId === "B" ? "29.90" : null,
        interest_expenses_mmk: "0.00",
        profit_before_tax_mmk: businessId === "B" ? "29.90" : null,
        cash_balance_mmk: businessId === "B" ? "130.00" : null,
        receivables_mmk: "80.40",
        payables_mmk: "20.00",
      },
      upcoming_obligations: [
        { kind: "supplier", reference_id: "P", due_date: null, amount_mmk: "20.00" },
      ],
      data_quality: {
        status: "partial",
        missing_sheets: [],
        warnings: ["Historical cost and expense settlement unavailable."],
      },
    };
  });
});

it("uses the shared authenticated client with active business and renders exact decimals", async () => {
  render(<ConnectedFinancialPage />);
  expect(await screen.findByText("150.75 MMK")).toBeTruthy();
  expect(screen.getByText("80.4 MMK")).toBeTruthy();
  const obligationsTable = screen.getByRole("table", { name: /outstanding business obligations/i });
  expect(within(obligationsTable).getByText("Due date unavailable")).toBeTruthy();
  expect(
    mocks.api.mock.calls.every(
      ([path, options]) => path.includes("business_id=A") && options.signal instanceof AbortSignal,
    ),
  ).toBe(true);
  const trendUrl = new URL(
    mocks.api.mock.calls.find(([path]) => String(path).includes("/trends"))![0],
    "http://test",
  );
  expect(trendUrl.searchParams.get("start")).toMatch(/^\d{4}-\d{2}-01$/);
  expect(trendUrl.searchParams.get("end")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(trendUrl.searchParams.get("granularity")).toBe("weekly");
});

it("hides cards immediately when the shared import query refetches", async () => {
  const view = render(<ConnectedFinancialPage />);
  await screen.findByText("150.75 MMK");
  mocks.state.isFetching = true;
  view.rerender(<ConnectedFinancialPage />);
  expect(screen.queryByText("150.75 MMK")).toBeNull();
  expect(screen.getByRole("status")).toBeTruthy();
});

it("refreshes values and availability when the authenticated business changes", async () => {
  const view = render(<ConnectedFinancialPage />);
  await screen.findByText("150.75 MMK");
  expect(screen.getByText("Cost of goods sold").closest("article")?.textContent).toContain("Unavailable");

  mocks.business = { id: "B", name: "Second Store" };
  mocks.state.data = { business_id: "B", source_version: 1 };
  view.rerender(<ConnectedFinancialPage />);
  expect(screen.queryByText("150.75 MMK")).toBeNull();
  await screen.findByText("90 MMK");
  expect(screen.getByText("Cash available").closest("article")?.textContent).toContain("130 MMK");
  expect(screen.getByText("Cost of goods sold").closest("article")?.textContent).toContain(
    "Cost of products sold during this period.",
  );
  expect(mocks.api.mock.calls.some(([path]) => String(path).includes("business_id=B"))).toBe(true);

  mocks.business = { id: "A", name: "Imported Store" };
  mocks.state.data = { business_id: "A", source_version: 1 };
  view.rerender(<ConnectedFinancialPage />);
  await screen.findByText("150.75 MMK");
  expect(screen.getByText("Cost of goods sold").closest("article")?.textContent).toContain("Unavailable");
});

it("saves supplier due dates for the selected business and invalidates its import cache", async () => {
  const view = render(<ConnectedFinancialPage />);
  await screen.findByText("150.75 MMK");
  fireEvent.click(screen.getByRole("button", { name: "Add due date" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-10-28" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mocks.imported).toHaveBeenCalledOnce());
  const mutation = mocks.api.mock.calls.find(([path]) => String(path).includes("/purchases/P/due-date"));
  expect(mutation?.[0]).toContain("business_id=A");
  expect(JSON.parse(mutation?.[1]?.body)).toEqual({ due_date: "2026-10-28", expected_due_date: null });
  mocks.business = { id: "B", name: "Second Store" };
  mocks.state.data = { business_id: "B", source_version: 1 };
  view.rerender(<ConnectedFinancialPage />);
  await screen.findByText("90 MMK");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("rejects old financial source versions after the shared import is updated", async () => {
  const view = render(<ConnectedFinancialPage />);
  await screen.findByText("150.75 MMK");
  mocks.state.data = { business_id: "A", source_version: 2 };
  await act(async () => view.rerender(<ConnectedFinancialPage />));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("stale or inconsistent"),
  );
  expect(screen.queryByText("150.75 MMK")).toBeNull();
});

it("shows no-workbook state instead of fake totals", async () => {
  mocks.state.data = { business_id: "A", source_version: 0 };
  render(<ConnectedFinancialPage />);
  expect(
    await screen.findByRole("heading", { name: "Start with your business data" }),
  ).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.api).not.toHaveBeenCalled();
});

it("formats large decimal amounts without floating-point loss", () => {
  expect(formatMmk("9999999999999999.99")).toBe("9,999,999,999,999,999.99 MMK");
  expect(formatMmk("-0.25")).toBe("-0.25 MMK");
});
