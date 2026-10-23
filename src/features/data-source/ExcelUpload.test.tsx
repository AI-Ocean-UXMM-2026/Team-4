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
  writeText: vi.fn(),
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

const mismatchHeading = "This workbook uses a different business ID.";
it("keeps standard uploads without offering complete replacement", async () => {
  mocks.api.mockResolvedValue({ status: "success", source_version: 3, row_counts: {}, errors: [], warnings: [] });
  render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);

  expect(screen.queryByRole("checkbox", { name: /complete replacement/i })).not.toBeInTheDocument();
  await submitWorkbook();

  expect(mocks.api.mock.calls[0]![0]).toBe("/api/v1/data/upload?business_id=my-shop-123");
});
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
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const ownershipIssue: RowIssue = {
  sheet: "Settings",
  row: 2,
  field: "business_id",
  reason: "Row belongs to another business",
};

function rejectWorkbook(issue = ownershipIssue) {
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
  mocks.writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.writeText },
  });
});

afterEach(() => {
  cleanup();
  setPreferences({ language: "en", theme: "light" });
  localStorage.clear();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
});

describe("Excel workbook ownership guidance", () => {
  it("copies the current business ID without resubmitting or rewriting the workbook", async () => {
    rejectWorkbook();
    render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
    const file = await submitWorkbook();

    expect(screen.getByText(mismatchHeading)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Your business ID" })).toHaveValue("my-shop-123");
    expect(screen.getByRole("textbox", { name: "Your business ID" })).toHaveAttribute("readonly");
    const [path, options] = mocks.api.mock.calls[0]!;
    expect(path).toBe("/api/v1/data/upload?business_id=my-shop-123");
    expect(options.body.get("file")).toBe(file);

    fireEvent.click(screen.getByRole("button", { name: "Copy business ID" }));
    await screen.findByText("Business ID copied");
    expect(mocks.writeText).toHaveBeenCalledExactlyOnceWith("my-shop-123");
    expect(mocks.api).toHaveBeenCalledOnce();

    selectWorkbook("corrected.xlsx");
    expect(screen.queryByText(mismatchHeading)).not.toBeInTheDocument();
    expect(screen.queryByText("Business ID copied")).not.toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledOnce();
  });

  it("keeps the business ID available for manual copying when clipboard access fails", async () => {
    rejectWorkbook();
    mocks.writeText.mockRejectedValue(new Error("Clipboard permission denied"));
    render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
    await submitWorkbook();

    fireEvent.click(screen.getByRole("button", { name: "Copy business ID" }));
    expect(
      await screen.findByText("Select the business ID above and copy it manually."),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Your business ID" })).toHaveValue("my-shop-123");
    expect(mocks.api).toHaveBeenCalledOnce();
  });

  it("shows the actual validation error without ownership guidance for other invalid fields", async () => {
    rejectWorkbook({ sheet: "Sales", row: 3, field: "sale_id", reason: "Duplicate stable row ID" });
    render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
    await submitWorkbook();

    expect(screen.getByText("Duplicate stable row ID")).toBeVisible();
    expect(screen.queryByText(mismatchHeading)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy business ID" })).not.toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledOnce();
  });

  it("translates the backend ownership reason and guide for Myanmar readers", async () => {
    setPreferences({ language: "my" });
    rejectWorkbook();
    render(<ExcelUpload maxBytes={5 * 1024 * 1024} />);
    await submitWorkbook();

    const translatedReason = translate(ownershipIssue.reason);
    expect(translatedReason).not.toBe(ownershipIssue.reason);
    expect(screen.getByText(translatedReason)).toBeVisible();
    expect(screen.getByText(translate(mismatchHeading))).toBeVisible();
    expect(screen.getByRole("textbox", { name: translate("Your business ID") })).toHaveValue(
      "my-shop-123",
    );
  });
});
