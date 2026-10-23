import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import type { Business, ImportResult, SyncStatus } from "@/lib/contracts";
import { setPreferences } from "@/lib/preferences";
import { DataSourcePage } from "./DataSourcePage";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  imported: vi.fn(),
  business: { id: "shop-a", name: "Shop A", source_version: 0 } as Business,
}));

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  api: mocks.api,
}));
vi.mock("@/app/providers", () => ({
  usePlatform: () => ({ business: mocks.business, imported: mocks.imported }),
  Loading: () => <p>Loading data source</p>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("./OneDriveConnect", () => ({
  OneDriveConnect: () => <section aria-label="OneDrive connection" />,
}));

const importedAt = "2026-10-22T10:00:00Z";
function status(lastImport: string | null, imports: ImportResult[] = []): SyncStatus {
  return {
    source_id: lastImport ? "source-1" : null,
    kind: "manual",
    source_version: lastImport ? 1 : 0,
    graph_enabled: false,
    connected: false,
    linked: false,
    drive_id: null,
    item_id: null,
    last_import_at: lastImport,
    last_checked_at: null,
    max_upload_bytes: 5 * 1024 * 1024,
    imports,
  };
}
function result(statusValue: ImportResult["status"]): ImportResult {
  return { status: statusValue, source_version: 1, row_counts: {}, errors: [], warnings: [] };
}

describe("Data Source next step", () => {
  let client: QueryClient;
  let statuses: Record<string, SyncStatus>;
  let upload: () => Promise<ImportResult>;

  beforeEach(() => {
    vi.clearAllMocks();
    setPreferences({ language: "en", theme: "light" });
    mocks.business = { id: "shop-a", name: "Shop A", source_version: 0 };
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    statuses = { "shop-a": status(null), "shop-b": status(null) };
    upload = async () => result("success");
    mocks.api.mockImplementation((path: string) => {
      const id = new URLSearchParams(path.split("?")[1]).get("business_id") || "";
      if (path.includes("sync-status")) return Promise.resolve(statuses[id]);
      if (path.includes("/upload")) return upload();
      throw new Error(`Unexpected API path: ${path}`);
    });
    mocks.imported.mockImplementation(async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["sync-status", mocks.business.id] }),
        client.invalidateQueries({ queryKey: ["financial-summary", mocks.business.id] }),
      ]);
    });
  });
  afterEach(() => {
    cleanup();
    client.clear();
    setPreferences({ language: "en", theme: "light" });
  });

  function mount() {
    return render(
      <QueryClientProvider client={client}>
        <DataSourcePage />
      </QueryClientProvider>,
    );
  }
  async function submit() {
    await screen.findByRole("heading", { name: "Upload Excel workbook" });
    fireEvent.change(screen.getByLabelText("Excel workbook"), {
      target: { files: [new File(["workbook"], "records.xlsx")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import workbook" }));
    await waitFor(() => expect(mocks.imported).toHaveBeenCalled());
  }
  function nextStep() {
    return screen.queryByRole("link", { name: "Get AI Recommendations" });
  }

  it("shows no next step before the selected business has a successful import", async () => {
    mount();
    await screen.findByRole("heading", { name: "Past uploaded workbooks" });
    expect(nextStep()).not.toBeInTheDocument();
    expect(screen.queryByText("Your next step")).not.toBeInTheDocument();
  });

  it("places guidelines first on mobile and upload first on desktop with aligned cards", async () => {
    mount();
    const upload = await screen.findByRole("heading", { name: "Upload Excel workbook" });
    const guide = screen.getByRole("heading", { name: "Workbook Guidelines" });
    expect(upload.closest("section")?.parentElement).toHaveClass("order-2", "lg:order-1", "min-w-0");
    expect(guide.closest("section")?.parentElement).toHaveClass("order-1", "lg:order-2", "min-w-0");
    expect(upload.closest("section")?.parentElement?.parentElement).toHaveClass("items-stretch");
  });

  it("does not treat a timestamp without a confirmed import version as a completed import", async () => {
    statuses["shop-a"] = { ...status(importedAt), source_version: 0 };
    mount();
    await screen.findByRole("heading", { name: "Past uploaded workbooks" });
    expect(nextStep()).not.toBeInTheDocument();
  });

  it("does not show a stale cached import while the backend status is being checked", async () => {
    client.setQueryData(["sync-status", "shop-a"], status(importedAt, [result("success")]));
    mount();
    expect(nextStep()).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(expect.stringContaining("sync-status")),
    );
    await screen.findByText("No imports yet");
    expect(nextStep()).not.toBeInTheDocument();
  });

  it("shows the next step immediately after a confirmed import and links to AI Analyzer", async () => {
    upload = async () => {
      statuses["shop-a"] = status(importedAt, [result("success")]);
      return result("success");
    };
    mount();
    await submit();
    const link = await screen.findByRole("link", { name: "Get AI Recommendations" });
    expect(link).toHaveAttribute("href", "/ai");
    expect(
      screen.getByText(
        "Your business records are ready. Analyze your financial data to discover business issues and recommended next actions.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Your next step")).not.toBeInTheDocument();
    const cards = link.closest("section");
    expect(cards?.previousElementSibling).toHaveClass("grid");
    expect(cards?.nextElementSibling).toHaveTextContent("Past uploaded workbooks");
    expect(screen.queryByRole("link", { name: "View Financial Health" })).not.toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalledWith(expect.stringContaining("/ai/analyze"));
    expect(mocks.business.id).toBe("shop-a");
  });

  it("shows the section to a returning business with a recorded successful import", async () => {
    statuses["shop-a"] = status(importedAt, [result("success")]);
    mount();
    expect(await screen.findByRole("link", { name: "Get AI Recommendations" })).toHaveAttribute(
      "href",
      "/ai",
    );
  });

  it("keeps the link for an unchanged workbook that was imported successfully before", async () => {
    statuses["shop-a"] = status(importedAt, [result("up_to_date")]);
    upload = async () => result("up_to_date");
    mount();
    expect(await screen.findByRole("link", { name: "Get AI Recommendations" })).toBeVisible();
    await submit();
    expect(nextStep()).toBeVisible();
    expect(screen.getByText("Already up to date. No duplicate rows added.")).toBeVisible();
  });

  it("does not claim success after a rejected upload", async () => {
    upload = async () => {
      throw new ApiError(
        400,
        "WORKBOOK_INVALID",
        "Workbook rejected. No business records were changed.",
      );
    };
    mount();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Workbook rejected");
    expect(nextStep()).not.toBeInTheDocument();
  });

  it("uses the selected business's history and does not carry the link across businesses", async () => {
    statuses["shop-a"] = status(importedAt, [result("success")]);
    const view = mount();
    expect(await screen.findByRole("link", { name: "Get AI Recommendations" })).toBeVisible();
    mocks.business = { id: "shop-b", name: "Shop B", source_version: 0 };
    view.rerender(
      <QueryClientProvider client={client}>
        <DataSourcePage />
      </QueryClientProvider>,
    );
    await screen.findByText("Shop B", { exact: false });
    expect(nextStep()).not.toBeInTheDocument();
    mocks.business = { id: "shop-a", name: "Shop A", source_version: 1 };
    view.rerender(
      <QueryClientProvider client={client}>
        <DataSourcePage />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("link", { name: "Get AI Recommendations" })).toBeVisible();
  });
});
