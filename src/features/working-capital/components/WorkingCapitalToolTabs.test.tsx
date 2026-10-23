import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkingCapitalSnapshot } from "../hooks/useWorkingCapital";
import type { ManualWorkingCapitalInputs } from "../manualInputs";
import { WorkingCapitalToolTabs } from "./WorkingCapitalToolTabs";

afterEach(cleanup);

const unlockInputs: WorkingCapitalSnapshot["unlock_cash"] = {
  as_of: "2026-10-22",
  stock_value_mmk: "1000000",
  receivables_mmk: "500000",
  expense_candidates: [
    { expense_id: "E1", category: "Marketing", description: "Campaign", amount_mmk: "100000" },
  ],
  average_weekly_running_cost_mmk: "210000",
};
const manualInputs: ManualWorkingCapitalInputs = {
  availableCashMmk: null,
  supplierLeadDays: 7,
  mandatoryMonthlyPaymentsMmk: "500000",
  monthlyEssentialCostsMmk: "500000",
  protectedReserveMmk: "3000000",
  dedicatedReserveMmk: "300000",
  stockLevels: {},
};

function renderTools(businessId = "A") {
  const simulate = vi.fn().mockResolvedValue({ result: { ccc_days: 12 } });
  const planReserve = vi.fn().mockResolvedValue({ result: {} });
  const view = render(
    <WorkingCapitalToolTabs
      key={businessId}
      unlockInputs={unlockInputs}
      cashGapInputs={unlockInputs}
      manualStock={false}
      manualInputs={manualInputs}
      simulate={simulate}
      planReserve={planReserve}
    />,
  );
  return { ...view, simulate, planReserve };
}

describe("WorkingCapitalToolTabs", () => {
  it("defaults to Find Cash and labels three independent panels", () => {
    renderTools();
    const find = screen.getByRole("tab", { name: /Find Cash/ });
    const gap = screen.getByRole("tab", { name: /Cash Gap/ });
    const reserve = screen.getByRole("tab", { name: /Safety Reserve/ });
    expect(find.getAttribute("aria-selected")).toBe("true");
    expect(gap.getAttribute("aria-selected")).toBe("false");
    expect(reserve.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tabpanel").textContent).toContain("Unlock hidden cash");
    expect(screen.getByRole("tablist").className).toContain("sm:grid-cols-3");
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(3);
    expect(screen.queryByText("Step 1")).toBeNull();
    expect(screen.queryByText("Step 2")).toBeNull();
    expect(screen.queryByText("Step 3")).toBeNull();
    for (const tab of [find, gap, reserve]) {
      const panel = document.getElementById(tab.getAttribute("aria-controls")!);
      expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
    }
  });

  it("supports arrow, Home, and End keys with roving focus", () => {
    renderTools();
    const find = screen.getByRole("tab", { name: /Find Cash/ });
    const gap = screen.getByRole("tab", { name: /Cash Gap/ });
    const reserve = screen.getByRole("tab", { name: /Safety Reserve/ });
    find.focus();
    fireEvent.keyDown(find, { key: "ArrowRight" });
    expect(document.activeElement).toBe(gap);
    expect(gap.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(gap, { key: "End" });
    expect(document.activeElement).toBe(reserve);
    fireEvent.keyDown(reserve, { key: "Home" });
    expect(document.activeElement).toBe(find);
    fireEvent.keyDown(find, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(reserve);
    expect(reserve.tabIndex).toBe(0);
    expect(find.tabIndex).toBe(-1);
  });

  it("keeps tool inputs and choices mounted without making API requests", () => {
    const { simulate, planReserve } = renderTools();
    fireEvent.change(screen.getByRole("slider", { name: /Target collection/ }), {
      target: { value: "80" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Campaign/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Cash Gap/ }));
    fireEvent.click(screen.getByRole("button", { name: /B2C —/ }));
    fireEvent.change(screen.getByRole("slider", { name: /Average B2C customer payment days/ }), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("tab", { name: /Safety Reserve/ }));
    fireEvent.change(screen.getByRole("slider", { name: /Target coverage/ }), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Monthly contribution" }), {
      target: { value: "1234567" },
    });
    fireEvent.click(screen.getByRole("tab", { name: /Find Cash/ }));
    expect(screen.getByRole("slider", { name: /Target collection/ }).getAttribute("value")).toBe(
      "80",
    );
    expect((screen.getByRole("checkbox", { name: /Campaign/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Cash Gap/ }));
    expect(screen.getByRole("button", { name: /B2C —/ }).getAttribute("aria-pressed")).toBe("true");
    expect(
      screen
        .getByRole("slider", { name: /Average B2C customer payment days/ })
        .getAttribute("value"),
    ).toBe("25");
    fireEvent.click(screen.getByRole("tab", { name: /Safety Reserve/ }));
    expect(screen.getByRole("slider", { name: /Target coverage/ }).getAttribute("value")).toBe("5");
    expect(
      (screen.getByRole("textbox", { name: "Monthly contribution" }) as HTMLInputElement).value,
    ).toBe("1234567");
    expect(simulate).not.toHaveBeenCalled();
    expect(planReserve).not.toHaveBeenCalled();
  });

  it("preserves a calculated scenario result when another tab is visited", async () => {
    const { simulate } = renderTools();
    fireEvent.click(screen.getByRole("tab", { name: /Cash Gap/ }));
    fireEvent.click(screen.getByRole("button", { name: /B2C —/ }));
    fireEvent.click(screen.getByText("Calculation details"));
    fireEvent.click(screen.getByRole("button", { name: "Check with calculation service" }));
    await waitFor(() =>
      expect(screen.getByText("Projected result · records unchanged")).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("tab", { name: /Find Cash/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Cash Gap/ }));
    expect(screen.getByText("Projected result · records unchanged")).toBeTruthy();
    expect(simulate).toHaveBeenCalledTimes(1);
  });

  it("resets scenario state when the authenticated business key changes", () => {
    const simulate = vi.fn();
    const planReserve = vi.fn();
    const props = {
      unlockInputs,
      cashGapInputs: unlockInputs,
      manualStock: false,
      manualInputs,
      simulate,
      planReserve,
    };
    const view = render(<WorkingCapitalToolTabs key="business-A:1" {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: /Cash Gap/ }));
    fireEvent.click(screen.getByRole("button", { name: /B2B —/ }));
    fireEvent.change(screen.getByRole("slider", { name: /Average B2B customer payment days/ }), {
      target: { value: "85" },
    });
    view.rerender(<WorkingCapitalToolTabs key="business-B:1" {...props} />);
    expect(screen.getByRole("tab", { name: /Find Cash/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: /Cash Gap/ }));
    expect(screen.getByRole("button", { name: /B2B —/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.queryByRole("slider", { name: /Average B2B customer payment days/ })).toBeNull();
  });
});
