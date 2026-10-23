import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportResult, SyncStatus as Status } from "@/lib/contracts";
import { translate } from "@/lib/i18n";
import { Issues, SyncStatus } from "./SyncStatus";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  imported: vi.fn(),
}));

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  api: mocks.api,
}));

vi.mock("@/app/providers", () => ({
  usePlatform: () => ({
    business: { id: "test-biz", name: "Test Business", source_version: 2 },
    imported: mocks.imported,
  }),
}));

const mockStatus: Status = {
  source_id: "src-1",
  kind: "manual",
  source_version: 2,
  graph_enabled: false,
  connected: false,
  linked: false,
  drive_id: null,
  item_id: null,
  last_import_at: "2026-10-23T06:00:00Z",
  last_checked_at: null,
  max_upload_bytes: 5242880,
  imports: [
    {
      import_batch_id: "batch-current",
      status: "success",
      source_version: 2,
      filename: "october-records.xlsx",
      row_counts: { inserted: 15, updated: 2, unchanged: 10 },
      errors: [],
      warnings: [],
      created_at: "2026-10-23T06:00:00Z",
    },
    {
      import_batch_id: "batch-past",
      status: "success",
      source_version: 1,
      filename: "september-records.xlsx",
      row_counts: { inserted: 20, updated: 0, unchanged: 0 },
      errors: [],
      warnings: [],
      created_at: "2026-09-30T06:00:00Z",
    },
    {
      import_batch_id: "batch-failed",
      status: "failed",
      source_version: 0,
      filename: "bad-records.xlsx",
      row_counts: {},
      errors: [{ sheet: "Settings", row: 2, field: "business_id", reason: "Row belongs to another business" }],
      warnings: [],
      created_at: "2026-10-22T06:00:00Z",
    },
  ],
};

describe("SyncStatus History & Snapshot Switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders successful past files and marks the current snapshot active", () => {
    render(<SyncStatus status={mockStatus} />);

    expect(screen.getByText("october-records.xlsx")).toBeInTheDocument();
    expect(screen.getByText("september-records.xlsx")).toBeInTheDocument();
    expect(screen.getByText(translate("Active snapshot"))).toBeInTheDocument();

    // The past file has a "Load this file" button
    expect(screen.getByRole("button", { name: new RegExp(translate("Load this file"), "i") })).toBeInTheDocument();
  });

  it("activates past workbook snapshot when 'Load this file' is clicked", async () => {
    mocks.api.mockResolvedValueOnce({ status: "activated" });

    render(<SyncStatus status={mockStatus} />);

    const loadButton = screen.getByRole("button", { name: new RegExp(translate("Load this file"), "i") });
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(mocks.api).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/data/activate-history?business_id=test-biz&batch_id=batch-past"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(mocks.imported).toHaveBeenCalled();
    });
  });

  it("segregates failed attempts into a collapsed section", () => {
    render(<SyncStatus status={mockStatus} />);

    // Failed uploads summary header is present
    expect(screen.getByText(new RegExp("Failed upload attempts", "i"))).toBeInTheDocument();
    expect(screen.getByText("bad-records.xlsx")).toBeInTheDocument();
  });
});

describe("Issues error presentation & consolidation", () => {
  it("consolidates repetitive ownership mismatch errors into a single summary row", () => {
    const repetitiveResult: ImportResult = {
      status: "failed",
      source_version: 0,
      row_counts: {},
      errors: [
        { sheet: "Settings", row: 2, field: "business_id", reason: "Row belongs to another business" },
        { sheet: "Products", row: 2, field: "business_id", reason: "Row belongs to another business" },
        { sheet: "Products", row: 3, field: "business_id", reason: "Row belongs to another business" },
        { sheet: "Purchases", row: 2, field: "business_id", reason: "Row belongs to another business" },
      ],
      warnings: [],
    };

    render(<Issues result={repetitiveResult} />);

    // Renders the consolidated summary row
    expect(screen.getByText("Settings (+2 other sheets)")).toBeInTheDocument();
    expect(screen.getByText("Multiple rows (4)")).toBeInTheDocument();
    expect(screen.getByText("Row belongs to another business")).toBeInTheDocument();

    // Does not spam 4 separate table rows for business_id
    const cells = screen.getAllByText("Row belongs to another business");
    expect(cells).toHaveLength(1);

    // Can toggle to view all rows if desired
    const viewAllButton = screen.getByRole("button", { name: "View all 4 rows" });
    fireEvent.click(viewAllButton);
    expect(screen.getAllByText("Row belongs to another business")).toHaveLength(4);
  });

  it("prioritizes non-ownership issues and groups repetitive errors by field and sheet", () => {
    const mixedResult: ImportResult = {
      status: "failed",
      source_version: 0,
      row_counts: {},
      errors: [
        { sheet: "Products", row: 2, field: "quantity", reason: "Inventory would become negative on this date" },
        { sheet: "Products", row: 3, field: "quantity", reason: "Inventory would become negative on this date" },
        { sheet: "Settings", row: 2, field: "business_id", reason: "Row belongs to another business" },
        { sheet: "Products", row: 2, field: "business_id", reason: "Row belongs to another business" },
      ],
      warnings: [],
    };

    render(<Issues result={mixedResult} />);

    // Grouped non-ownership error
    expect(screen.getByText("Row 2 (+1 more)")).toBeInTheDocument();
    expect(screen.getByText("Inventory would become negative on this date")).toBeInTheDocument();

    // Consolidated ownership error
    expect(screen.getByText("Multiple rows (2)")).toBeInTheDocument();
  });
});
