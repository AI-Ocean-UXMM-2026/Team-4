import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashGapSimulator } from "./CashGapSimulator";

afterEach(cleanup);

function gap(label: string): string | null | undefined {
  return screen.getByText(label).parentElement?.textContent;
}

describe("CashGapSimulator", () => {
  it("updates the weighted cash gap and action comparison immediately", () => {
    const simulate = vi.fn().mockResolvedValue({ result: {} });
    render(<CashGapSimulator simulate={simulate} />);

    expect(screen.getByText(/B2C pay now:/).textContent).toContain("60%");
    expect(screen.getByText(/B2B pay later:/).textContent).toContain("40%");
    expect(gap("Now · assumption baseline")).toContain("17 days");
    expect(gap("After actions · scenario")).toContain("17 days");
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "SPAN" &&
          element.textContent?.startsWith("Average payment waiting days:") === true,
      ).textContent,
    ).toContain("12 days");
    expect(simulate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("slider", { name: "B2B pay-later share" }), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /B2B customers pay after/ }), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /Days stock sits before selling/ }), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /Days supplier gives you to pay/ }), {
      target: { value: "20" },
    });
    expect(screen.getByText(/B2C pay now:/).textContent).toContain("50%");
    expect(screen.getByText(/B2B pay later:/).textContent).toContain("50%");
    expect(gap("Now · assumption baseline")).toContain("40 days");
    expect(gap("After actions · scenario")).toContain("40 days");

    fireEvent.click(screen.getByRole("checkbox", { name: /60% deposit/ }));
    expect(gap("After actions · scenario")).toContain("28 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /Restock only fast-selling items/ }));
    expect(gap("After actions · scenario")).toContain("18 days");
    fireEvent.click(screen.getByRole("checkbox", { name: /15 more days to pay/ }));
    expect(gap("After actions · scenario")).toContain("3 days");
    expect(gap("After actions · scenario")).toContain("−37 days from baseline");
    expect(screen.getAllByText("Estimated cash tied up: Unavailable")).toHaveLength(2);
    expect(simulate).not.toHaveBeenCalled();
  });

  it("shows zero instead of a negative gap and keeps the authenticated calculator available", async () => {
    const simulate = vi.fn().mockResolvedValue({ result: { status: "demo_estimate" } });
    render(<CashGapSimulator simulate={simulate} />);
    fireEvent.change(screen.getByRole("slider", { name: "B2B pay-later share" }), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /Days stock sits before selling/ }), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /Days supplier gives you to pay/ }), {
      target: { value: "100" },
    });
    expect(screen.getByText(/B2C pay now:/).textContent).toContain("100%");
    expect(gap("Now · assumption baseline")).toContain("0 days");
    expect(gap("After actions · scenario")).toContain("0 days");

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
});
