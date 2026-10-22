import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UnlockCashSimulator } from "./UnlockCashSimulator";
import type { WorkingCapitalSnapshot } from "../hooks/useWorkingCapital";

afterEach(cleanup);

const inputs: WorkingCapitalSnapshot["unlock_cash"] = {
  as_of: "2026-10-22",
  stock_value_mmk: "1000000.00",
  receivables_mmk: "500000.00000",
  expense_candidates: [
    { expense_id: "E1", category: "Marketing", description: "Campaign", amount_mmk: "100000.00" },
    { expense_id: "E2", category: "Travel", description: "Trip", amount_mmk: "50000.00" },
  ],
  average_weekly_running_cost_mmk: "210000.00",
};

describe("UnlockCashSimulator", () => {
  it("updates all three projections and coverage immediately without action buttons", () => {
    render(<UnlockCashSimulator inputs={inputs} />);
    expect(screen.getByText("+ 240 K")).toBeTruthy();
    expect(screen.getByText("+ 250 K")).toBeTruthy();
    expect(screen.getByText("≈ 2.3 extra weeks of running costs covered")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /Project stock sale|Project collection|Project spending avoided/,
      }),
    ).toBeNull();

    fireEvent.change(screen.getByRole("slider", { name: /Discount/ }), {
      target: { value: "30" },
    });
    expect(screen.getByText("+ 210 K")).toBeTruthy();
    fireEvent.change(screen.getByRole("slider", { name: /Discount/ }), {
      target: { value: "20" },
    });

    fireEvent.change(screen.getByRole("slider", { name: /Slow-moving share/ }), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /Target collection/ }), {
      target: { value: "80" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Campaign/ }));
    expect(screen.getAllByText("+ 400 K")).toHaveLength(2);
    expect(screen.getByText("+ 100 K")).toBeTruthy();
    expect(screen.getByText("+ 900 K")).toBeTruthy();
    expect(screen.getByText("≈ 4.3 extra weeks of running costs covered")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Trip/ }));
    expect(screen.getByText("+ 150 K")).toBeTruthy();
    expect(screen.getByText("+ 950 K")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Campaign/ }));
    expect(screen.getByText("+ 850 K")).toBeTruthy();
  });

  it("keeps missing source amounts and weekly coverage unavailable", () => {
    render(
      <UnlockCashSimulator
        inputs={{
          ...inputs,
          stock_value_mmk: null,
          receivables_mmk: null,
          average_weekly_running_cost_mmk: null,
          expense_candidates: [],
        }}
      />,
    );
    expect(screen.getByText("Running-cost coverage unavailable")).toBeTruthy();
    expect(screen.getByText("Total cash unlocked").parentElement?.textContent).toContain(
      "Unavailable",
    );
    expect(screen.getByText("+ 0 K")).toBeTruthy();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("shows exact MMK instead of rounding a small positive projection to zero K", () => {
    render(
      <UnlockCashSimulator
        inputs={{
          ...inputs,
          stock_value_mmk: "800.00",
          receivables_mmk: "250.00000",
          average_weekly_running_cost_mmk: "210.00",
          expense_candidates: [],
        }}
      />,
    );
    expect(screen.getByText("+ 192 MMK")).toBeTruthy();
    expect(screen.getByText("+ 125 MMK")).toBeTruthy();
    expect(screen.getByText("+ 317 MMK")).toBeTruthy();
    expect(screen.getByText("≈ 1.5 extra weeks of running costs covered")).toBeTruthy();
  });

  it("keeps every expense selectable in a bounded, keyboard-focusable list", () => {
    const expenseCandidates = Array.from({ length: 18 }, (_, index) => ({
      expense_id: `E${index + 1}`,
      category: "Optional",
      description: `Expense ${index + 1}`,
      amount_mmk: "1000.00",
    }));
    render(<UnlockCashSimulator inputs={{ ...inputs, expense_candidates: expenseCandidates }} />);

    const list = screen.getByRole("region", { name: "Optional expense items" });
    const stockCard = screen.getByText("Discount slow stock").parentElement?.parentElement;
    const collectionCard = screen.getByText("Collect receivables").parentElement?.parentElement;
    const spendingCard = screen.getByText("Pause optional spending").parentElement?.parentElement;
    const grid = stockCard?.parentElement;
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("md:grid-cols-2");
    expect(grid?.className).toContain("xl:grid-cols-3");
    expect(grid?.className).toContain("items-stretch");
    expect(collectionCard?.parentElement).toBe(grid);
    expect(spendingCard?.parentElement).toBe(grid);
    expect(spendingCard?.className).toContain("md:col-span-2");
    expect(spendingCard?.className).toContain("xl:col-span-1");
    expect(list.tabIndex).toBe(0);
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("h-60");
    expect(list.className).toContain("md:h-72");
    expect(list.className).toContain("xl:h-80");
    expect(within(list).getAllByRole("checkbox")).toHaveLength(18);
    expect(list.contains(screen.getByText("Pause optional spending"))).toBe(false);
    expect(list.contains(screen.getByText("+ 0 K"))).toBe(false);
    expect(stockCard?.textContent).toContain("1,000,000 MMK");
    expect(collectionCard?.textContent).toContain("500,000 MMK");
    expect(collectionCard?.children[1]?.querySelector('input[type="range"]')).toBeTruthy();

    fireEvent.click(within(list).getByRole("checkbox", { name: /Expense 18/ }));
    expect(screen.getByText("+ 1 K")).toBeTruthy();
    expect(screen.getByText("Total cash unlocked").parentElement?.textContent).toContain("+ 491 K");
  });
});
