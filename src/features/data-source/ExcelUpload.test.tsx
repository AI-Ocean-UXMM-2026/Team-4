import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import type { ImportResult, RowIssue } from "@/lib/contracts";
import { translate } from "@/lib/i18n";
import { setPreferences } from "@/lib/preferences";
import { ExcelUpload } from "./ExcelUpload";

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
    business: { id: "my-shop-123", name: "My Shop", source_version: 2 },
    imported: mocks.imported,
  }),
}));

it("shows the last successful workbook after reopening without enabling another import", async () => {
  mocks.api.mockResolvedValue({ status: "success", source_version: 3, row_counts: {}, errors: [], warnings: [] });
  const view = render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
  await submitWorkbook();
  view.unmount();
  render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
  expect(screen.getByText("Last imported workbook:", { exact: false })).toHaveTextContent("sample.xlsx");
  expect(screen.getByRole("button", { name: translate("Import workbook") })).toBeDisabled();
});

it("does not replace the last successful workbook when an upload fails", async () => {
  localStorage.setItem("bizflow-last-workbook:my-shop-123", "previous.xlsx");
  rejectWorkbook();
  const view = render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
  await submitWorkbook();
  view.unmount();
  render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
  expect(screen.getByText(/previous.xlsx/)).toBeVisible();
});

it("selects a dropped workbook and retains it when the picker is cancelled", () => {
  render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
  fireEvent.drop(screen.getByRole("group", {name: translate("Paste Excel file here")}), {dataTransfer: {files: [new File(["demo"], "dropped.xlsx")]}});
  expect(screen.getByText(/dropped.xlsx/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(translate("Excel workbook")), {target: {files: []}});
  expect(screen.getByText(/dropped.xlsx/)).toBeTruthy();
  expect(screen.getByRole("button", {name: translate("Import workbook")})).not.toBeDisabled();
});

it("selects a pasted workbook and keeps import explicit", () => {
  render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
  const file = new File(["demo"], "pasted.xlsx");
  fireEvent.paste(screen.getByRole("group", {name: translate("Paste Excel file here")}), {clipboardData: {files: [file], items: []}});
  expect(screen.getByText(/pasted.xlsx/)).toBeTruthy();
  expect(screen.getByRole("button", {name: translate("Import workbook")})).not.toBeDisabled();
});

it("rejects pasted files that are not Excel workbooks", () => {
  render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
  fireEvent.paste(screen.getByRole("group", {name: translate("Paste Excel file here")}), {clipboardData: {files: [new File(["demo"], "wrong.png")], items: []}});
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", {name: translate("Import workbook")})).toBeDisabled();
});

it("requires an explicit choice when workbook dates conflict with manual supplier dates", async () => {
  mocks.api.mockRejectedValueOnce(new ApiError(409, "DUE_DATE_CONFLICT", "Choose which dates to keep.",
    [{ purchase_id: "PUR-1", manual_due_date: "2026-10-25", workbook_due_date: "2026-10-27" }] as never));
  mocks.api.mockResolvedValueOnce({ status: "success", source_version: 4, row_counts: {}, errors: [], warnings: [] });
  render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
  selectWorkbook("updated.xlsx");
  fireEvent.click(screen.getByRole("button", { name: translate("Import workbook") }));
  expect(await screen.findByText(/PUR-1:/)).toHaveTextContent("2026-10-25");
  expect(screen.getByRole("button", { name: translate("Keep manual dates") })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: translate("Keep manual dates") }));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
  expect(mocks.api.mock.calls[1]![0]).toBe("/api/v1/data/upload?business_id=my-shop-123&due_date_resolution=keep_manual");
  expect(await screen.findByText(/Imported:/)).toBeVisible();
});

const duplicateIssue: RowIssue = {
  sheet: "Sales",
  row: 3,
  field: "sale_id",
  reason: "Duplicate stable row ID",
};

function rejectWorkbook(issue = duplicateIssue) {
  const result: ImportResult = {
    status: "failed",
    source_version: 2,
    row_counts: {},
    errors: [issue],
    warnings: [],
  };
  mocks.api.mockRejectedValue(
    new ApiError(400, "WORKBOOK_INVALID", "Workbook rejected. No business records were changed.", [
      result,
    ]),
  );
}

function selectWorkbook(name = "sample.xlsx") {
  const file = new File(["test workbook"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  fireEvent.change(screen.getByLabelText(translate("Excel workbook")), {
    target: { files: [file] },
  });
  return file;
}

async function submitWorkbook() {
  const file = selectWorkbook();
  fireEvent.click(screen.getByRole("button", { name: translate("Import workbook") }));
  await waitFor(() => expect(mocks.imported).toHaveBeenCalledOnce());
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  setPreferences({ language: "en", theme: "light" });
  mocks.imported.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  setPreferences({ language: "en", theme: "light" });
  localStorage.clear();
});

describe("Excel workbook import", () => {
  it("sends the selected file to the current business without asking the owner for an ID", async () => {
    mocks.api.mockResolvedValue({ status: "success", source_version: 3, row_counts: {}, errors: [], warnings: [] });
    render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
    const file = await submitWorkbook();

    const [path, options] = mocks.api.mock.calls[0]!;
    expect(path).toBe("/api/v1/data/upload?business_id=my-shop-123");
    expect(options.body.get("file")).toBe(file);
    expect(mocks.api).toHaveBeenCalledOnce();
  });

  it("shows validation errors and clears them when a corrected workbook is selected", async () => {
    rejectWorkbook();
    render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
    await submitWorkbook();

    expect(screen.getByText("Duplicate stable row ID")).toBeVisible();
    expect(screen.queryByRole("button", { name: /copy.*id/i })).not.toBeInTheDocument();

    selectWorkbook("corrected.xlsx");
    expect(screen.queryByText("Duplicate stable row ID")).not.toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledOnce();
  });
});
