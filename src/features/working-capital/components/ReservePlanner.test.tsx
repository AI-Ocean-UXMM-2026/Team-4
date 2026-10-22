import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReservePlanner } from "./ReservePlanner";
import type { ManualWorkingCapitalInputs } from "../manualInputs";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (text: string) => text }),
  translate: (text: string) => text,
}));
afterEach(cleanup);

const inputs: ManualWorkingCapitalInputs = {
  availableCashMmk: null,
  supplierLeadDays: 7,
  mandatoryMonthlyPaymentsMmk: "500000",
  monthlyEssentialCostsMmk: "500000",
  protectedReserveMmk: "3000000",
  dedicatedReserveMmk: "300000",
  stockLevels: {},
};

function metric(label: string): string | undefined {
  const matches = screen.getAllByText(label);
  return matches[matches.length - 1]?.parentElement?.textContent ?? undefined;
}

describe("ReservePlanner", () => {
  it("renders saved inputs immediately and refreshes the cards when they change", () => {
    const planReserve = vi.fn().mockResolvedValue({
      result: {
        target_mmk: "3000000.00",
        shortfall_mmk: "2700000.00",
      },
    });
    const view = render(<ReservePlanner inputs={inputs} planReserve={planReserve} />);
    expect(screen.queryByText("Reserve target")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Plan reserve milestones" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide plan" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(metric("Reserve target")).toContain("3,000,000 MMK");
    expect(metric("Amount still needed")).toContain("2,700,000 MMK");
    expect(metric("Monthly contribution")).toContain("100,000 MMK");
    expect(screen.queryByText(/example monthly essential costs/)).toBeNull();
    view.rerender(
      <ReservePlanner
        inputs={{ ...inputs, protectedReserveMmk: "4000000" }}
        planReserve={planReserve}
      />,
    );
    expect(metric("Reserve target")).toContain("4,000,000 MMK");
    expect(metric("Amount still needed")).toContain("3,700,000 MMK");
    fireEvent.change(screen.getByRole("slider", { name: /Monthly contribution/ }), {
      target: { value: "200000" },
    });
    expect(metric("Monthly contribution")).toContain("200,000 MMK");
    expect(metric("Months to target")).toContain("19");
    fireEvent.click(screen.getByRole("button", { name: "Hide plan" }));
    expect(screen.queryByText("Reserve target")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Plan reserve milestones" }).getAttribute("aria-expanded"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Plan reserve milestones" }));
    expect(metric("Reserve target")).toContain("4,000,000 MMK");
  });

  it("sends saved values, not hardcoded examples, to the calculation service", async () => {
    const planReserve = vi.fn().mockResolvedValue({
      result: {
        target_mmk: "3000000",
        shortfall_mmk: "2700000.00",
      },
    });
    render(<ReservePlanner inputs={inputs} planReserve={planReserve} />);
    fireEvent.click(screen.getByRole("button", { name: /Plan reserve milestones/ }));
    await waitFor(() =>
      expect(planReserve).toHaveBeenCalledWith({
        monthly_essential_costs_mmk: "500000",
        dedicated_reserve_mmk: "300000",
        protected_reserve_target_mmk: "3000000",
        target_months: 3,
        monthly_contribution_mmk: 100000,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("Calculation service verified this plan.")).toBeTruthy(),
    );
  });

  it("does not replace live cards with an outdated backend result", async () => {
    const planReserve = vi.fn().mockResolvedValue({
      result: {
        target_mmk: "1500000.00",
        shortfall_mmk: "1200000.00",
      },
    });
    render(<ReservePlanner inputs={inputs} planReserve={planReserve} />);
    fireEvent.click(screen.getByRole("button", { name: /Plan reserve milestones/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("out of date"));
    expect(metric("Reserve target")).toContain("3,000,000 MMK");
  });

  it("can hide results while the calculation service is still pending", () => {
    const planReserve = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<ReservePlanner inputs={inputs} planReserve={planReserve} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan reserve milestones" }));
    expect(screen.getByText("Checking calculation service…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide plan" }));
    expect(screen.queryByText("Reserve target")).toBeNull();
    expect(screen.queryByText("Checking calculation service…")).toBeNull();
  });
});
