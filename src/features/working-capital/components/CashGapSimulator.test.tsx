import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashGapSimulator } from "./CashGapSimulator";
import { gapChange } from "./cashGapChange";

afterEach(cleanup);

function gap(label: string, group?: "B2C" | "B2B"): string | null | undefined {
  const container = group
    ? screen.getByRole("region", { name: group + " scenario" })
    : document.body;
  return within(container).getByText(label).parentElement?.textContent;
}

function choose(model: "B2C" | "B2B" | "mixed") {
  fireEvent.click(
    screen.getByRole("button", {
      name: model === "mixed" ? /Both — B2B and B2C/ : new RegExp(model + " —"),
    }),
  );
}

function setSlider(name: RegExp, value: string) {
  fireEvent.change(screen.getByRole("slider", { name }), { target: { value } });
}

describe("CashGapSimulator", () => {
  it("requires an explicit business model and keeps the equal-width orange choice cards", () => {
    render(<CashGapSimulator simulate={vi.fn()} />);
    const names = [/B2C —/, /B2B —/, /Both — B2B and B2C/];
    const cards = names.map((name) => screen.getByRole("button", { name }));
    expect(cards.every((card) => card.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(cards[0]?.parentElement?.className).toContain("md:grid-cols-3");
    expect(cards.every((card) => card.className.includes("h-full"))).toBe(true);
    expect(screen.queryByText("Cash gap inputs")).toBeNull();
    for (const model of ["B2C", "B2B", "mixed"] as const) {
      choose(model);
      const selected = screen.getByRole("button", {
        name: model === "mixed" ? /Both — B2B and B2C/ : new RegExp(model + " —"),
      });
      expect(selected.getAttribute("aria-pressed")).toBe("true");
      expect(selected.className).toContain("border-primary bg-primary/10");
      expect(selected.className).toContain("focus-visible:outline-2");
    }
  });

  it.each([
    ["B2C", 3, true, false],
    ["B2B", 3, false, true],
    ["mixed", 4, true, true],
  ] as const)("shows only relevant payment-day sliders for %s", (model, count, b2c, b2b) => {
    render(<CashGapSimulator simulate={vi.fn()} />);
    choose(model);
    expect(screen.getAllByRole("slider")).toHaveLength(count);
    expect(!!screen.queryByRole("slider", { name: /Average B2C customer payment days/ })).toBe(b2c);
    expect(!!screen.queryByRole("slider", { name: /Average B2B customer payment days/ })).toBe(b2b);
    expect(screen.getByRole("slider", { name: /Days stock stays before selling/ })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /Days before paying suppliers/ })).toBeTruthy();
    expect(
      screen.queryByRole("slider", { name: /customer share|sales paid later|collection days/i }),
    ).toBeNull();
    expect(screen.queryByText(/Cash gap = Stock days/)).toBeNull();
    expect(screen.queryByText(/Average payment waiting days:/)).toBeNull();
  });

  it("uses B2C average including zero-day sales and updates the deposit scenario", () => {
    render(<CashGapSimulator simulate={vi.fn()} />);
    choose("B2C");
    expect(
      screen.getByText("Include immediately paid sales as 0 days in this average."),
    ).toBeTruthy();
    expect(gap("Before Changes")).toContain("20 days");
    expect(screen.getByText("No change yet")).toBeTruthy();
    setSlider(/Average B2C customer payment days/, "40");
    expect(gap("Before Changes")).toContain("45 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /60% deposit/ }));
    expect(gap("After Changes")).toContain("21 days");
    expect(screen.getByText("Potential improvement: 24 fewer days")).toBeTruthy();
  });

  it("uses the independent B2B average and permits a zero-day average", () => {
    render(<CashGapSimulator simulate={vi.fn()} />);
    choose("B2B");
    setSlider(/Average B2B customer payment days/, "0");
    expect(gap("Before Changes")).toContain("5 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /60% deposit/ }));
    expect(gap("After Changes")).toContain("5 days");
    setSlider(/Average B2B customer payment days/, "40");
    expect(gap("Before Changes")).toContain("45 days");
    expect(gap("After Changes")).toContain("21 days");
  });

  it("applies stock and supplier actions independently without exceeding the baseline", () => {
    render(<CashGapSimulator simulate={vi.fn()} />);
    choose("B2C");
    expect(gap("Before Changes")).toContain("20 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /Restock only fast-selling items/ }));
    expect(gap("After Changes")).toContain("10 days");
    expect(screen.getByText("Potential improvement: 10 fewer days")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Restock only fast-selling items/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /15 more days to pay/ }));
    expect(gap("After Changes")).toContain("5 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /Restock only fast-selling items/ }));
    expect(gap("After Changes")).toContain("0 days");
    expect(screen.getByText("Potential improvement: 20 fewer days")).toBeTruthy();
  });

  it("shows two separate mixed-business comparisons without an invented sales split", () => {
    render(<CashGapSimulator simulate={vi.fn()} />);
    choose("mixed");
    setSlider(/Average B2C customer payment days/, "20");
    setSlider(/Average B2B customer payment days/, "40");
    setSlider(/Days stock stays before selling/, "40");
    setSlider(/Days before paying suppliers/, "20");
    expect(
      screen.getByText("No verified sales split; B2C and B2B estimates are shown separately."),
    ).toBeTruthy();
    expect(
      screen.getByText("Include immediately paid sales as 0 days in each average."),
    ).toBeTruthy();
    expect(gap("Before Changes", "B2C")).toContain("40 days");
    expect(gap("Before Changes", "B2B")).toContain("60 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /60% deposit/ }));
    expect(gap("After Changes", "B2C")).toContain("28 days");
    expect(gap("After Changes", "B2B")).toContain("36 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /Restock only fast-selling items/ }));
    expect(gap("After Changes", "B2C")).toContain("18 days");
    expect(gap("After Changes", "B2B")).toContain("26 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /15 more days to pay/ }));
    expect(gap("After Changes", "B2C")).toContain("3 days");
    expect(gap("After Changes", "B2B")).toContain("11 days");
    expect(
      within(screen.getByRole("region", { name: "B2C scenario" })).getByText(
        "Potential improvement: 37 fewer days",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "B2B scenario" })).getByText(
        "Potential improvement: 49 fewer days",
      ),
    ).toBeTruthy();
    expect(screen.getByText("B2C −12 · B2B −24 wait days")).toBeTruthy();
    expect(screen.queryByText(/Estimated cash tied up|An MMK estimate needs/)).toBeNull();
  });

  it("preserves separate B2C and B2B averages when switching models", () => {
    render(<CashGapSimulator simulate={vi.fn()} />);
    choose("B2C");
    setSlider(/Average B2C customer payment days/, "25");
    choose("B2B");
    expect(
      screen
        .getByRole("slider", { name: /Average B2B customer payment days/ })
        .getAttribute("value"),
    ).toBe("15");
    setSlider(/Average B2B customer payment days/, "45");
    choose("mixed");
    expect(
      screen
        .getByRole("slider", { name: /Average B2C customer payment days/ })
        .getAttribute("value"),
    ).toBe("25");
    expect(
      screen
        .getByRole("slider", { name: /Average B2B customer payment days/ })
        .getAttribute("value"),
    ).toBe("45");
    expect(gap("Before Changes", "B2C")).toContain("30 days");
    expect(gap("Before Changes", "B2B")).toContain("50 days");
  });

  it("keeps concise accessible actions and a single bottom disclaimer", () => {
    render(<CashGapSimulator simulate={vi.fn()} />);
    choose("B2C");
    expect(screen.getByText("Ways to reduce your cash gap")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: /What-if: ask every pay-later customer for a 60% deposit immediately/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: /What-if: Restock only fast-selling items, reducing stock days by up to 10/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: /What-if: suppliers agree to 15 more days to pay/ }),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        /Assumes stock days fall|Assumes the supplier agrees|Actual terms may differ/,
      ),
    ).toBeNull();
    expect(
      screen.queryByText(/Estimated cash tied up|An MMK estimate needs|A dated cash forecast/),
    ).toBeNull();
    expect(
      screen.getAllByText("Planning estimates only. Your business records do not change."),
    ).toHaveLength(1);
    expect((screen.getByText("Calculation details").parentElement as HTMLDetailsElement).open).toBe(
      false,
    );
  });

  it("checks each mixed scenario separately through the existing calculation API", async () => {
    const simulate = vi.fn().mockResolvedValue({ result: { status: "demo_estimate" } });
    render(<CashGapSimulator simulate={simulate} />);
    choose("mixed");
    setSlider(/Average B2C customer payment days/, "20");
    setSlider(/Average B2B customer payment days/, "40");
    fireEvent.click(screen.getByRole("checkbox", { name: /60% deposit/ }));
    fireEvent.click(screen.getByText("Calculation details"));
    fireEvent.click(screen.getByRole("button", { name: "Check with calculation service" }));
    await waitFor(() => expect(simulate).toHaveBeenCalledTimes(2));
    expect(simulate).toHaveBeenCalledWith("cash_gap", {
      dio_days: 30,
      dso_days: 20,
      dpo_days: 25,
      proposed_dio_days: 30,
      proposed_dso_days: 8,
      supplier_extension_days: 0,
      demo_estimate: true,
    });
    expect(simulate).toHaveBeenCalledWith("cash_gap", {
      dio_days: 30,
      dso_days: 40,
      dpo_days: 25,
      proposed_dio_days: 30,
      proposed_dso_days: 16,
      supplier_extension_days: 0,
      demo_estimate: true,
    });
    await waitFor(() =>
      expect(screen.getAllByText("Projected result · records unchanged")).toHaveLength(2),
    );
  });

  it("clamps negative displayed gaps while passing actual assumptions to the API", async () => {
    const simulate = vi.fn().mockResolvedValue({ result: { status: "demo_estimate" } });
    render(<CashGapSimulator simulate={simulate} />);
    choose("B2C");
    setSlider(/Average B2C customer payment days/, "0");
    setSlider(/Days stock stays before selling/, "0");
    setSlider(/Days before paying suppliers/, "100");
    expect(gap("Before Changes")).toContain("0 days");
    expect(gap("After Changes")).toContain("0 days");
    expect(screen.getByText("No change yet")).toBeTruthy();
    fireEvent.click(screen.getByText("Calculation details"));
    fireEvent.click(screen.getByRole("button", { name: "Check with calculation service" }));
    await waitFor(() =>
      expect(simulate).toHaveBeenCalledWith("cash_gap", {
        dio_days: 0,
        dso_days: 0,
        dpo_days: 100,
        proposed_dio_days: 0,
        proposed_dso_days: 0,
        supplier_extension_days: 0,
        demo_estimate: true,
      }),
    );
  });

  it("classifies improvement, no change, and worsening from displayed gap values", () => {
    expect(gapChange(20, 0)).toEqual({ kind: "improved", days: 20 });
    expect(gapChange(0, 0)).toEqual({ kind: "unchanged", days: 0 });
    expect(gapChange(5, 8)).toEqual({ kind: "worsened", days: 3 });
  });
});
