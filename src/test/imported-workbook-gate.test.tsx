import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ImportedWorkbookGate } from "@/components/layout/ImportedWorkbookGate";

vi.mock("@/lib/i18n", () => ({useTranslation: () => ({t: (text: string) => text})}));
vi.mock("@tanstack/react-router", () => ({Link: ({to, children}: {to: string; children: ReactNode}) => <a href={to}>{children}</a>}));
afterEach(cleanup);

it.each(["/", "/working-capital", "/ai"])("does not mount data on %s before a successful import", path => {
  const mounted = vi.fn();
  function DataPage() { mounted(); return <p>Stored financial data</p>; }
  render(<ImportedWorkbookGate sourceVersion={0} path={path}><DataPage /></ImportedWorkbookGate>);
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.getByText("No workbook imported yet")).toBeTruthy();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/data-source");
});

it("retains imported data after reload without a staged upload", () => {
  render(<ImportedWorkbookGate sourceVersion={1} path="/credit"><p>Saved loan records</p></ImportedWorkbookGate>);
  expect(screen.getByText("Saved loan records")).toBeTruthy();
  expect(screen.queryByText("No workbook imported yet")).toBeNull();
});

it("keeps the upload page available before the first import", () => {
  render(<ImportedWorkbookGate sourceVersion={0} path="/data-source"><p>Upload controls</p></ImportedWorkbookGate>);
  expect(screen.getByText("Upload controls")).toBeTruthy();
});

it("clears the previous business view when switching to a business with no import", () => {
  const view = render(<ImportedWorkbookGate sourceVersion={3} path="/"><p>Previous business cash</p></ImportedWorkbookGate>);
  view.rerender(<ImportedWorkbookGate sourceVersion={0} path="/"><p>Previous business cash</p></ImportedWorkbookGate>);
  expect(screen.queryByText("Previous business cash")).toBeNull();
  expect(screen.getByText("No workbook imported yet")).toBeTruthy();
});
