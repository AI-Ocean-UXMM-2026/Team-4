import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReservePlanner } from "./ReservePlanner";
import type { ManualWorkingCapitalInputs } from "../manualInputs";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (text: string, values?: Record<string, string>) =>
      text.replace(/\{(\d+)\}/g, (_, key: string) => values?.[key] ?? ""),
  }),
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
    expect(screen.getByRole("region", { name: "Projected result" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Projected result" }));
    expect(screen.getByRole("button", { name: "Hide plan" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(
      screen.getByText("At 100,000 MMK per month, the target could be reached in about 27 months."),
    ).toBeTruthy();
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
    fireEvent.change(screen.getByRole("textbox", { name: "Monthly contribution" }), {
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

  it("accepts exact whole MMK amounts above the old slider limit", () => {
    render(<ReservePlanner inputs={inputs} planReserve={vi.fn()} />);
    const field = screen.getByRole("textbox", { name: "Monthly contribution" }) as HTMLInputElement;
    expect(field.value).toBe("100000");
    expect(field.getAttribute("inputmode")).toBe("numeric");
    expect(field.getAttribute("placeholder")).toBe("Enter amount");
    expect(screen.getByText("Amount you plan to save each month.")).toBeTruthy();
    fireEvent.change(field, { target: { value: "1234567" } });
    expect(field.value).toBe("1234567");
    fireEvent.click(screen.getByRole("button", { name: "Plan reserve milestones" }));
    expect(metric("Monthly contribution")).toContain("1,234,567 MMK");
    expect(metric("Months to target")).toContain("3");
    expect(screen.getByRole("slider", { name: /Target coverage/ })).toBeTruthy();
  });

  it("recalculates the reserve target from target coverage without changing saved inputs", () => {
    const planReserve = vi.fn().mockResolvedValue({
      result: { target_mmk: "1500000", shortfall_mmk: "1200000" },
    });
    const planningInputs = { ...inputs, protectedReserveMmk: "0" };
    render(<ReservePlanner inputs={planningInputs} planReserve={planReserve} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan reserve milestones" }));
    expect(metric("Reserve target")).toContain("1,500,000 MMK");
    fireEvent.change(screen.getByRole("slider", { name: /Target coverage/ }), {
      target: { value: "6" },
    });
    expect(metric("Reserve target")).toContain("3,000,000 MMK");
    expect(metric("Amount still needed")).toContain("2,700,000 MMK");
    expect(planningInputs.protectedReserveMmk).toBe("0");
  });

  it("keeps invalid entries visible, explains the problem, and blocks planning", () => {
    render(<ReservePlanner inputs={inputs} planReserve={vi.fn()} />);
    const field = screen.getByRole("textbox", { name: "Monthly contribution" }) as HTMLInputElement;
    const cases = [
      ["", "Enter a monthly contribution, or 0 if you cannot save yet."],
      ["-1", "Enter a non-negative whole MMK amount."],
      ["1.5", "Enter a non-negative whole MMK amount."],
      ["abc", "Enter a non-negative whole MMK amount."],
      ["1000000000001", "Monthly contribution must be 1,000,000,000,000 MMK or less."],
    ];
    for (const [value, message] of cases) {
      fireEvent.change(field, { target: { value } });
      expect(field.value).toBe(value);
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(
        (screen.getByRole("button", { name: "Plan reserve milestones" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    }
    fireEvent.change(field, { target: { value: "250000" } });
    expect(field.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains missing and invalid saved planning inputs when the button is clicked", () => {
    const planReserve = vi.fn();
    const view = render(<ReservePlanner inputs={null} planReserve={planReserve} />);
    const button = screen.getByRole("button", { name: "Plan reserve milestones" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter monthly essential costs and the reserve already saved in the planning inputs above.",
    );
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(planReserve).not.toHaveBeenCalled();

    view.rerender(
      <ReservePlanner
        inputs={{ ...inputs, monthlyEssentialCostsMmk: "0" }}
        planReserve={planReserve}
      />,
    );
    fireEvent.click(button);
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter monthly essential costs greater than 0 in the planning inputs above.",
    );

    view.rerender(
      <ReservePlanner inputs={{ ...inputs, dedicatedReserveMmk: "" }} planReserve={planReserve} />,
    );
    fireEvent.click(button);
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter your current dedicated reserve in the planning inputs above. Use 0 if none.",
    );
    expect(screen.queryByRole("region", { name: "Projected result" })).toBeNull();
    expect(planReserve).not.toHaveBeenCalled();
  });

  it("accepts zero contribution without dividing by zero", async () => {
    const planReserve = vi.fn().mockResolvedValue({
      result: { target_mmk: "3000000.00", shortfall_mmk: "2700000.00" },
    });
    render(<ReservePlanner inputs={inputs} planReserve={planReserve} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Monthly contribution" }), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Plan reserve milestones" }));
    expect(metric("Monthly contribution")).toContain("0 MMK");
    expect(metric("Months to target")).toContain("No timeline at this contribution");
    expect(
      screen.getByText(
        "At 0 MMK per month, this target cannot be reached without additional contributions.",
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(planReserve).toHaveBeenCalledWith(
        expect.objectContaining({ monthly_contribution_mmk: 0 }),
      ),
    );
  });

  it("shows when the already-saved reserve meets the target", () => {
    const planReserve = vi.fn().mockResolvedValue({
      result: { target_mmk: "3000000", shortfall_mmk: "0" },
    });
    render(
      <ReservePlanner
        inputs={{ ...inputs, dedicatedReserveMmk: "3000000" }}
        planReserve={planReserve}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Plan reserve milestones" }));
    expect(screen.getByText("Reserve target already reached.")).toBeTruthy();
    expect(metric("Amount still needed")).toContain("0 MMK");
    expect(metric("Months to target")).toContain("0");
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
