import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutstandingBalances } from "../components/OutstandingBalances";
import type { Obligation } from "../types";

afterEach(cleanup);

const datedObligations: Obligation[] = [
  {
    kind: "supplier",
    reference_id: "OVERDUE",
    due_date: "2026-10-21",
    amount_mmk: "100.00",
    original_amount_mmk: "300.00",
    amount_paid_mmk: "200.00",
  },
  {
    kind: "supplier",
    reference_id: "DUE-7",
    due_date: "2026-10-29",
    amount_mmk: "200.00",
    original_amount_mmk: "200.00",
    amount_paid_mmk: "0.00",
  },
  {
    kind: "supplier",
    reference_id: "DUE-30",
    due_date: "2026-11-21",
    amount_mmk: "300.00",
    original_amount_mmk: "300.00",
    amount_paid_mmk: "0.00",
  },
  {
    kind: "supplier",
    reference_id: "LATER",
    due_date: "2026-11-22",
    amount_mmk: "400.00",
    original_amount_mmk: "400.00",
    amount_paid_mmk: "0.00",
  },
  {
    kind: "supplier",
    reference_id: "UNDATED",
    due_date: null,
    amount_mmk: "500.00",
    original_amount_mmk: "500.00",
    amount_paid_mmk: "0.00",
  },
];

describe("OutstandingBalances", () => {
  it("classifies amounts at the selected report date without double-counting due windows", () => {
    render(
      <OutstandingBalances
        obligations={datedObligations}
        asAt="2026-10-22"
        cashAvailable="1000.00"
      />,
    );
    const region = screen.getByRole("region", { name: "Outstanding supplier payments section" });
    expect(within(region).getByRole("heading", { name: "Outstanding Supplier Payments" })).toBeVisible();
    const summary = within(region).getByText("Outstanding supplier payments").closest("dl");
    expect(summary).not.toBeNull();
    expect(within(summary!).getAllByRole("term")).toHaveLength(4);
    expect(summary).toHaveClass("xl:grid-cols-4", "sm:grid-cols-2", "grid-cols-1");
    expect(within(summary!).queryByText("Outstanding loan principal")).toBeNull();
    expect(
      within(summary!).getByText("Outstanding supplier payments").parentElement?.textContent,
    ).toContain("1,500 MMK");
    expect(within(summary!).getByText("Overdue").parentElement?.textContent).toContain("100 MMK");
    expect(within(summary!).getByText("Due within 7 days").parentElement?.textContent).toContain(
      "200 MMK",
    );
    expect(within(summary!).getByText("Due within 30 days").parentElement?.textContent).toContain(
      "500 MMK",
    );
    expect(within(summary!).getByText("Also included in the 30-day amount")).toBeTruthy();
    expect(within(summary!).getByText("Supplier bills detailed in the table below")).toBeTruthy();
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Due within 7 days").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Due within 30 days").length).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: /outstanding business obligations/i });
    expect(within(table).getByText("Due later")).toBeTruthy();
    expect(within(table).getByText("Due date unavailable")).toBeTruthy();
  });

  it("excludes loan instalments and loan schedule warnings from supplier summary", () => {
    const obligations: Obligation[] = [
      { kind: "loan", reference_id: "LN-1", due_date: "2026-10-29", amount_mmk: "300" },
      { kind: "loan", reference_id: "LN-UNDATED", due_date: null, amount_mmk: "500" },
      { kind: "supplier", reference_id: "PUR-1", due_date: "2026-10-29", amount_mmk: "200" },
    ];
    render(
      <OutstandingBalances
        obligations={obligations}
        asAt="2026-10-22"
        cashAvailable="1000"
      />,
    );
    const summary = screen.getByText("Outstanding supplier payments").closest("dl")!;
    expect(within(summary).getByText("Due within 7 days").parentElement?.textContent).toContain("200 MMK");
    expect(within(summary).getByText("Due within 30 days").parentElement?.textContent).toContain("200 MMK");
    expect(within(summary).queryByText("Outstanding loan principal")).toBeNull();
  });

  it("filters by recorded date, status, type, and minimum balance and can sort by amount", () => {
    render(
      <OutstandingBalances
        obligations={[
          ...datedObligations,
          {
            kind: "loan",
            reference_id: "Loan A",
            due_date: "2026-10-25",
            amount_mmk: 600,
            original_amount_mmk: 800,
            amount_paid_mmk: 200,
          },
          { kind: "expense", reference_id: "Expense A", due_date: "2026-10-21", amount_mmk: 700 },
        ]}
        asAt="2026-10-22"
        cashAvailable={null}
      />,
    );
    const summary = screen.getByText("Outstanding supplier payments").closest("dl")!;
    expect(within(summary).getByText("Overdue").parentElement?.textContent).toContain("100 MMK");
    expect(within(summary).getByText("Due within 7 days").parentElement?.textContent).toContain("200 MMK");
    expect(within(summary).getByText("Due within 30 days").parentElement?.textContent).toContain("500 MMK");
    expect(within(summary).queryByText("Outstanding loan principal")).toBeNull();
    const typeFilter = screen.getByRole("combobox", { name: "Filter by type" });
    expect(within(typeFilter).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All types",
      "Supplier",
    ]);
    let table = screen.getByRole("table", { name: /outstanding business obligations/i });
    expect(within(table).queryByText("Loan A")).toBeNull();
    expect(within(table).queryByText("Expense A")).toBeNull();
    expect(screen.getByText("Showing 1–5 of 5 payments")).toBeTruthy();
    fireEvent.change(typeFilter, {
      target: { value: "supplier" },
    });
    expect(within(table).getByText("OVERDUE")).toBeTruthy();
    expect(screen.getByText("Showing 1–5 of 5 payments")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by due date" }), {
      target: { value: "unavailable" },
    });
    table = screen.getByRole("table", { name: /outstanding business obligations/i });
    expect(within(table).getByText("UNDATED")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by due date" }), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), {
      target: { value: "Overdue" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum outstanding amount" }), {
      target: { value: "150" },
    });
    table = screen.getByRole("table", { name: /outstanding business obligations/i });
    expect(within(table).queryByText("OVERDUE")).toBeNull();
    expect(within(table).getByText("No payments match these filters.")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum outstanding amount" }), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Sort payments" }), {
      target: { value: "amount" },
    });
    table = screen.getByRole("table", { name: /outstanding business obligations/i });
    expect(within(table).getAllByRole("row")[1]?.textContent).toContain("UNDATED");
    expect(within(table).getAllByRole("row")[2]?.textContent).toContain("LATER");
  });

  it("adds money values without floating-point rounding", () => {
    render(
      <OutstandingBalances
        obligations={[
          { kind: "supplier", reference_id: "A", due_date: "2026-10-25", amount_mmk: "0.10" },
          { kind: "supplier", reference_id: "B", due_date: "2026-10-26", amount_mmk: "0.20" },
        ]}
        asAt="2026-10-22"
        cashAvailable="1.00"
      />,
    );
    expect(screen.getByText("Outstanding supplier payments").parentElement?.textContent).toContain(
      "0.3 MMK",
    );
  });

  it("does not include loan instalments in supplier-only coverage or the table", () => {
    render(
      <OutstandingBalances
        obligations={[
          {
            kind: "loan",
            reference_id: "LN-1 installment 1",
            due_date: "2026-10-29",
            amount_mmk: "300",
            original_amount_mmk: "300",
            amount_paid_mmk: "0",
          },
        ]}
        asAt="2026-10-22"
        cashAvailable="1000"
      />,
    );
    expect(screen.getByText("No supplier payments in available records")).toBeTruthy();
    expect(screen.queryByText("Outstanding loan principal")).toBeNull();
    expect(screen.queryByRole("table", { name: /outstanding business obligations/i })).toBeNull();
  });

  it("searches supplier references and names without exposing loan or expense records", () => {
    render(
      <OutstandingBalances
        obligations={[
          {
            kind: "supplier",
            reference_id: "PUR-204",
            name: "Golden Wholesale",
            due_date: null,
            amount_mmk: "100",
          },
          {
            kind: "loan",
            reference_id: "LN-19",
            name: "City Bank",
            due_date: "2026-11-01",
            amount_mmk: "200",
          },
          { kind: "expense", reference_id: "EXP-71", due_date: "2026-11-02", amount_mmk: "300" },
        ]}
        asAt="2026-10-22"
      />,
    );
    const table = screen.getByRole("table", { name: /outstanding business obligations/i });
    const search = screen.getByRole("searchbox", { name: "Search payments" });
    fireEvent.change(search, { target: { value: "golden" } });
    expect(within(table).getByText("PUR-204")).toBeTruthy();
    expect(within(table).queryByText("LN-19")).toBeNull();
    fireEvent.change(search, { target: { value: "ln-19" } });
    expect(within(table).queryByText("City Bank")).toBeNull();
    expect(within(table).queryByText("PUR-204")).toBeNull();
    expect(within(table).getByText("No payments match these filters.")).toBeTruthy();
    fireEvent.change(search, { target: { value: "exp-71" } });
    expect(within(table).queryByText("EXP-71")).toBeNull();
    expect(within(table).getByText("No payments match these filters.")).toBeTruthy();
  });

  it("sorts exact balances in both directions, references, and known dates before missing dates", () => {
    render(
      <OutstandingBalances
        obligations={[
          { kind: "supplier", reference_id: "Z", due_date: null, amount_mmk: "100.01" },
          { kind: "supplier", reference_id: "B", due_date: "2026-11-02", amount_mmk: "100.10" },
          { kind: "supplier", reference_id: "A", due_date: "2026-10-28", amount_mmk: "100.02" },
        ]}
        asAt="2026-10-22"
      />,
    );
    const table = screen.getByRole("table", { name: /outstanding business obligations/i });
    const order = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelectorAll("td")[1]?.textContent);
    expect(order()).toEqual(["A", "B", "Z"]);
    const sort = screen.getByRole("combobox", { name: "Sort payments" });
    fireEvent.change(sort, { target: { value: "amount" } });
    expect(order()).toEqual(["B", "A", "Z"]);
    fireEvent.change(sort, { target: { value: "amount-asc" } });
    expect(order()).toEqual(["Z", "A", "B"]);
    fireEvent.change(sort, { target: { value: "reference" } });
    expect(order()).toEqual(["A", "B", "Z"]);
  });

  it("paginates ten rows, resets after filters or a business dataset change, and retains complete totals", () => {
    const obligations: Obligation[] = Array.from({ length: 23 }, (_, index) => ({
      kind: "supplier",
      reference_id: `BILL-${String(index + 1).padStart(2, "0")}`,
      due_date: null,
      amount_mmk: "100",
    }));
    const { rerender } = render(
      <OutstandingBalances
        obligations={[
          ...obligations,
          { kind: "loan", reference_id: "LOAN-24", due_date: null, amount_mmk: "900" },
          { kind: "expense", reference_id: "EXP-25", due_date: null, amount_mmk: "1000" },
        ]}
        asAt="2026-10-22"
      />,
    );
    const table = screen.getByRole("table", { name: /outstanding business obligations/i });
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Showing 1–10 of 23 payments")).toBeTruthy();
    expect(within(table).queryByText("LOAN-24")).toBeNull();
    expect(within(table).queryByText("EXP-25")).toBeNull();
    expect(screen.getByText("Outstanding supplier payments").parentElement?.textContent).toContain(
      "2,300 MMK",
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    expect(within(table).getByText("BILL-11")).toBeTruthy();
    expect(within(table).queryByText("BILL-01")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search payments" }), {
      target: { value: "BILL-02" },
    });
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(within(table).getByText("BILL-02")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search payments" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    rerender(
      <OutstandingBalances
        obligations={[
          { kind: "loan", reference_id: "OTHER-BUSINESS", due_date: null, amount_mmk: "50" },
        ]}
        asAt="2026-10-21"
      />,
    );
    expect(screen.getByText("No supplier payments in available records")).toBeTruthy();
    expect(screen.queryByRole("table", { name: /outstanding business obligations/i })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Outstanding payments pages" })).toBeNull();
  });

  it("keeps an undated 100 MMK payment distinct from overdue and shows exact paid and remaining amounts", () => {
    render(
      <OutstandingBalances
        obligations={[
          {
            kind: "supplier",
            reference_id: "PART-100",
            due_date: null,
            original_amount_mmk: "300",
            amount_paid_mmk: "100",
            amount_mmk: "200",
          },
        ]}
        asAt="2026-10-22"
      />,
    );
    const row = within(screen.getByRole("table", { name: /outstanding business obligations/i }))
      .getByText("PART-100")
      .closest("tr");
    expect(row).not.toBeNull();
    expect(row!.cells[2]?.textContent).toBe("300 MMK");
    expect(row!.cells[3]?.textContent).toBe("100 MMK");
    expect(row!.cells[4]?.textContent).toBe("200 MMK");
    expect(row!.cells[5]?.getAttribute("aria-label")).toBe("Due date unavailable");
    expect(row!.cells[6]?.textContent).toBe("Due date unavailable");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), {
      target: { value: "Overdue" },
    });
    expect(
      within(screen.getByRole("table", { name: /outstanding business obligations/i })).queryByText(
        "PART-100",
      ),
    ).toBeNull();
  });

  it("edits the selected supplier date and updates due statuses after refreshed obligations arrive", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const initial: Obligation = { kind: "supplier", reference_id: "PUR-1", due_date: null,
      amount_mmk: "200", original_amount_mmk: "300", amount_paid_mmk: "100" };
    const view = render(<OutstandingBalances obligations={[initial]} asAt="2026-10-22" onSaveDueDate={save} />);
    expect(screen.getByRole("link", { name: "Update via Excel" })).toHaveAttribute("href", "/data-source");
    fireEvent.click(screen.getByRole("button", { name: "Add due date" }));
    const dialog = screen.getByRole("dialog", { name: "Edit supplier due date" });
    expect(within(dialog).getByText(/PUR-1/)).toBeVisible();
    expect(within(dialog).getByText(/200 MMK/)).toBeVisible();
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-10-25" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith("PUR-1", "2026-10-25", null));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    view.rerender(<OutstandingBalances obligations={[{ ...initial, due_date: "2026-10-25" }]} asAt="2026-10-22" onSaveDueDate={save} />);
    expect(screen.getByRole("button", { name: "Edit due date" })).toBeVisible();
    expect(screen.getByText("Due within 7 days", { selector: "span" })).toBeVisible();
  });

  it("keeps the dialog open with a visible error after a failed save", async () => {
    const save = vi.fn().mockRejectedValue(new Error("The due date changed. Refresh and try again."));
    render(<OutstandingBalances obligations={[{ kind: "supplier", reference_id: "PUR-2", due_date: "2026-10-30", amount_mmk: "400" }]}
      asAt="2026-10-22" onSaveDueDate={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit due date" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-11-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The due date changed. Refresh and try again.");
    expect(save).toHaveBeenCalledExactlyOnceWith("PUR-2", "2026-11-01", "2026-10-30");
  });
});
