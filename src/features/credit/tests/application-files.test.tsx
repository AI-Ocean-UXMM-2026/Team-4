import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationFiles } from "../components/ApplicationFiles";

const mocked = vi.hoisted(() => ({api: vi.fn()}));
vi.mock("@/lib/apiClient", () => ({api: mocked.api}));
vi.mock("@/lib/i18n", () => ({useTranslation: () => ({language: "en", t: (text: string) => text})}));
afterEach(() => { cleanup(); mocked.api.mockReset(); });

it("uploads supporting files for the selected application without checkboxes", async () => {
  let uploaded = false;
  mocked.api.mockImplementation(async (_path: string, options?: RequestInit) => {
    if (options?.method === "POST") { uploaded = true; return {id: "file-1"}; }
    return {documents: uploaded ? [{id: "file-1", requirement_key: "doc-0", filename: "license.pdf", size: 100}] : []};
  });
  const query = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  render(<QueryClientProvider client={query}><ApplicationFiles businessId="mine" bank="kbz" productId="term" documents={[["Business license", "လိုင်စင်"]]} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText("Business license")).not.toBeDisabled());
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.change(screen.getByLabelText("Business license"), {target: {files: [new File(["%PDF-1.4"], "license.pdf", {type: "application/pdf"})]}});
  await screen.findByText(/license.pdf/);
  expect(mocked.api.mock.calls.some(([path, options]) => path.includes("product_id=kbz-term") && path.includes("requirement_key=doc-0") && options?.body instanceof FormData)).toBe(true);
  query.clear();
});
