import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WorkingCapitalInputChoices } from "./WorkingCapitalInputChoices";

const save = vi.fn();
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (text: string) => text }) }));
vi.mock("../manualInputs", () => ({
  useWorkingCapitalManualInputs: () => ({ inputs: null, save }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
afterEach(() => {
  cleanup();
  save.mockClear();
});

describe("WorkingCapitalInputChoices", () => {
  it("links to Data Source and applies manual assumptions without modifying imports", () => {
    render(<WorkingCapitalInputChoices inventory={[]} recordedCashMmk={null} complete={false} />);
    expect(screen.getByText("Update via Excel File").closest("a")?.getAttribute("href")).toBe(
      "/data-source",
    );
    fireEvent.click(screen.getByRole("button", { name: /Input Data Manually/ }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /Mandatory \/ fixed monthly payments/ }),
      {
        target: { value: "200000" },
      },
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: /Protected cash reserve target/ }), {
      target: { value: "300000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & Apply" }));
    expect(save).toHaveBeenCalledWith({
      availableCashMmk: null,
      supplierLeadDays: 7,
      mandatoryMonthlyPaymentsMmk: "200000",
      monthlyEssentialCostsMmk: "200000",
      protectedReserveMmk: "300000",
      dedicatedReserveMmk: "0",
      stockLevels: {},
    });
    expect(screen.queryByRole("button", { name: "Save & Apply" })).toBeNull();
  });

  it("accepts manual available cash when the workbook has no recorded cash", () => {
    render(<WorkingCapitalInputChoices inventory={[]} recordedCashMmk={null} complete={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Input Data Manually/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Available cash for purchases/ }), {
      target: { value: "5000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & Apply" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ availableCashMmk: "5000000" }));
  });

  it("saves full essential costs and the amount already dedicated", () => {
    render(<WorkingCapitalInputChoices inventory={[]} recordedCashMmk={null} complete={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Input Data Manually/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Monthly essential costs/ }), {
      target: { value: "800000" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /Current dedicated reserve/ }), {
      target: { value: "300000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & Apply" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyEssentialCostsMmk: "800000",
        dedicatedReserveMmk: "300000",
      }),
    );
  });

  it("replaces the missing-data choices with a small edit control when complete", () => {
    render(<WorkingCapitalInputChoices inventory={[]} recordedCashMmk={"5000000"} complete />);
    expect(screen.queryByText("Update via Excel File")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit Planning Inputs" }));
    expect(screen.getByRole("button", { name: "Save & Apply" })).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: /Available cash for purchases/ })).toBeNull();
  });
});
