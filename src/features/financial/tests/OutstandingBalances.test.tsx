import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
        loanPrincipalOutstanding="0.00"
      />,
    );
    const region = screen.getByRole("region", { name: "Outstanding obligations" });
    const summary = within(region).getByText("Outstanding supplier payments").closest("dl");
    expect(summary).not.toBeNull();
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
    expect(screen.getByText("Unavailable")).toBeTruthy();
  });

  it("calculates cash remaining only when balances have known dates and loan coverage is complete", () => {
    const obligations = datedObligations.slice(1, 3);
    const { rerender } = render(
      <OutstandingBalances
        obligations={obligations}
        asAt="2026-10-22"
        cashAvailable="1000"
        loanPrincipalOutstanding="0"
      />,
    );
    expect(
      screen.getByText("Cash after recorded obligations due by 30 days").parentElement?.textContent,
    ).toContain("500 MMK");
    rerender(
      <OutstandingBalances
        obligations={datedObligations}
        asAt="2026-10-22"
        cashAvailable="1000"
        loanPrincipalOutstanding="0"
      />,
    );
    expect(
      screen.getByText("Undated supplier balances are excluded from due-date totals."),
    ).toBeTruthy();
    const coverage = screen.getByText(
      "Cash after recorded obligations due by 30 days",
    ).parentElement;
    expect(coverage?.textContent).toContain("Unavailable");
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
        ]}
        asAt="2026-10-22"
        cashAvailable={null}
        loanPrincipalOutstanding="800"
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by type" }), {
      target: { value: "loan" },
    });
    let table = screen.getByRole("table", { name: /outstanding business obligations/i });
    expect(within(table).getByText("Loan A")).toBeTruthy();
    expect(within(table).queryByText("OVERDUE")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by type" }), {
      target: { value: "all" },
    });
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
    expect(within(table).getAllByRole("row")[1]?.textContent).toContain("Loan A");
    expect(within(table).getAllByRole("row")[2]?.textContent).toContain("UNDATED");
    expect(
      screen.getByText(
        "Loan principal is shown separately; no recorded installment schedule is available.",
      ),
    ).toBeTruthy();
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
        loanPrincipalOutstanding="0"
      />,
    );
    expect(screen.getByText("Outstanding supplier payments").parentElement?.textContent).toContain(
      "0.3 MMK",
    );
    expect(
      screen.getByText("Cash after recorded obligations due by 30 days").parentElement?.textContent,
    ).toContain("0.7 MMK");
  });

  it("uses recorded installment dates only when a schedule is available", () => {
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
        loanPrincipalOutstanding="5000"
        loanScheduleAvailable
      />,
    );
    expect(
      screen.getByText("Cash after recorded obligations due by 30 days").parentElement?.textContent,
    ).toContain("700 MMK");
    expect(screen.getByText("LN-1 installment 1")).toBeTruthy();
  });
});
