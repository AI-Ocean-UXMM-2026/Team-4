import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n";
import { setPreferences } from "@/lib/preferences";
import { WorkbookGuideCard } from "./WorkbookGuideCard";

vi.mock("@/app/providers", () => ({
  usePlatform: () => ({
    business: { id: "my-shop-123", name: "My Shop", source_version: 2 },
  }),
}));

afterEach(() => {
  cleanup();
  setPreferences({ language: "en", theme: "light" });
});

describe("Workbook guidelines", () => {
  it.each(["en", "my"] as const)("explains automatic business association in %s without an ID-copy step", (language) => {
    setPreferences({ language });
    render(<WorkbookGuideCard />);

    const guidance = "Imports are automatically linked to your current business. You do not need to add a business ID to your workbook.";
    expect(screen.getByText(translate(guidance))).toBeVisible();
    expect(screen.queryByText("my-shop-123")).not.toBeInTheDocument();
    expect(screen.queryByText(translate("Your Business ID"))).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: translate("Download template") })).toBeEnabled();
    if (language === "my") expect(translate(guidance)).not.toBe(guidance);
  });
});
