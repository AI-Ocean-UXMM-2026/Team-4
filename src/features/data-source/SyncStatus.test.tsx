import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportResult, SyncStatus as Status } from "@/lib/contracts";
import { translate } from "@/lib/i18n";
import { setPreferences } from "@/lib/preferences";
import { Issues, SyncStatus } from "./SyncStatus";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  imported: vi.fn(),
}));

const historicalAttemptNote = "Historical attempt: these issues were recorded at the time of this upload. Re-upload the workbook to check it against the current validation rules.";

afterEach(() => {
  setPreferences({ language: "en", theme: "light" });
});

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
    expect(screen.queryByText(translate("Currently active across all features"))).not.toBeInTheDocument();

    // The past file has a "Load this file" button
    expect(screen.getByRole("button", { name: new RegExp(translate("Load this file"), "i") })).toBeInTheDocument();
  });

  it("marks only the newest workbook active when history entries share the current source version", () => {
    render(<SyncStatus status={{
      ...mockStatus,
      imports: mockStatus.imports.map((batch) => ({ ...batch, source_version: mockStatus.source_version })),
    }} />);

    expect(screen.getAllByText(translate("Active snapshot"))).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: new RegExp(translate("Load this file"), "i") })).toHaveLength(1);
    expect(screen.queryByText(translate("Currently active across all features"))).not.toBeInTheDocument();
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

  it.each(["en", "my"] as const)("labels saved failures as historical in %s while retaining their issues", (language) => {
    setPreferences({ language });
    render(<SyncStatus status={mockStatus} />);

    const note = screen.getByText(translate(historicalAttemptNote));
    const history = note.closest("details")!;
    expect(history).not.toHaveAttribute("open");
    fireEvent.click(history.querySelector("summary")!);
    expect(note).toBeVisible();
    expect(screen.getByText(translate("Row belongs to another business"))).toBeVisible();
    if (language === "my") expect(translate(historicalAttemptNote)).not.toBe(historicalAttemptNote);
  });

  it("does not show a historical-failure note when there are no saved failures", () => {
    render(<SyncStatus status={{ ...mockStatus, imports: mockStatus.imports.filter((batch) => batch.status !== "failed") }} />);
    expect(screen.queryByText(translate(historicalAttemptNote))).not.toBeInTheDocument();
  });
});

describe("Issues error presentation & consolidation", () => {
  it("groups repeated validation errors by sheet and field and can show every row", () => {
    const repetitiveResult: ImportResult = {
      status: "failed",
      source_version: 0,
      row_counts: {},
      errors: [
        { sheet: "Sales", row: 2, field: "sale_id", reason: "Duplicate stable row ID" },
        { sheet: "Sales", row: 3, field: "sale_id", reason: "Duplicate stable row ID" },
        { sheet: "Sales", row: 4, field: "sale_id", reason: "Duplicate stable row ID" },
        { sheet: "Purchases", row: 2, field: "purchase_id", reason: "Duplicate stable row ID" },
      ],
      warnings: [],
    };

    render(<Issues result={repetitiveResult} />);

    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Purchases")).toBeInTheDocument();
    expect(screen.getByText("Row 2 (+2 more)")).toBeInTheDocument();
    expect(screen.getAllByText("Duplicate stable row ID")).toHaveLength(2);

    // Can toggle to view all rows if desired
    const viewAllButton = screen.getByRole("button", { name: "View all 4 rows" });
    fireEvent.click(viewAllButton);
    expect(screen.getAllByText("Duplicate stable row ID")).toHaveLength(4);
  });

  it("keeps old business-ID failures readable as ordinary history issues", () => {
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

    expect(screen.getByText("Row 2 (+1 more)")).toBeInTheDocument();
    expect(screen.getByText("Inventory would become negative on this date")).toBeInTheDocument();
    expect(screen.getAllByText("Row belongs to another business")).toHaveLength(2);
    expect(screen.queryByText(translate(historicalAttemptNote))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy.*id/i })).not.toBeInTheDocument();
  });
});
