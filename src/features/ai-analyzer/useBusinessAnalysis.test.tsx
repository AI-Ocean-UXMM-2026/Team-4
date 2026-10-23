import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIAnalysis } from "./types";
import { useBusinessAnalysis } from "./useBusinessAnalysis";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  business: { id: "shop-a", source_version: 1 },
}));

vi.mock("@/app/providers", () => ({ usePlatform: () => ({ business: mocks.business }) }));
vi.mock("@/lib/apiClient", () => ({ api: mocks.api }));

function analysis(businessId: string, sourceVersion: number, outdated = false): AIAnalysis {
  return {
    business_id: businessId,
    status: "rules_only",
    data_as_of: null,
    source_version: sourceVersion,
    import_batch_id: `batch-${businessId}-${sourceVersion}`,
    generated_at: "2026-10-22T00:00:00Z",
    outdated,
    insights: [],
    warnings: [],
    disclaimer: "Decision support only.",
  };
}

describe("business-scoped AI analysis", () => {
  let client: QueryClient;
  const latest: Record<string, AIAnalysis | null> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.business = { id: "shop-a", source_version: 1 };
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest["shop-a"] = analysis("shop-a", 1);
    latest["shop-b"] = analysis("shop-b", 1);
    mocks.api.mockImplementation((url: string, options?: { method?: string; body?: string }) => {
      const businessId = new URLSearchParams(url.split("?")[1]).get("business_id") || "";
      if (url.includes("/insights/latest")) return Promise.resolve(latest[businessId]);
      if (url.includes("/analyze") && options?.method === "POST") {
        const version = JSON.parse(options.body || "{}").source_version as number;
        return Promise.resolve(analysis(businessId, version));
      }
      throw new Error(`Unexpected AI request: ${url}`);
    });
  });

  afterEach(() => {
    cleanup();
    client.clear();
  });

  function mount() {
    return renderHook(() => useBusinessAnalysis(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
  }

  it("only requests the latest report on opening and never reuses another business's mutation result", async () => {
    const view = mount();
    await waitFor(() => expect(view.result.current.report?.business_id).toBe("shop-a"));
    expect(mocks.api.mock.calls.every(([, options]) => !options || options.method !== "POST")).toBe(true);

    act(() => view.result.current.run(true));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/ai/analyze?business_id=shop-a"),
      expect.objectContaining({ method: "POST" }),
    ));

    mocks.business = { id: "shop-b", source_version: 1 };
    view.rerender();
    expect(view.result.current.report?.business_id).not.toBe("shop-a");
    await waitFor(() => expect(view.result.current.report?.business_id).toBe("shop-b"));
  });

  it("hides findings from an older workbook version until the user analyzes again", async () => {
    const view = mount();
    await waitFor(() => expect(view.result.current.report?.source_version).toBe(1));

    mocks.business = { id: "shop-a", source_version: 2 };
    latest["shop-a"] = analysis("shop-a", 1, true);
    view.rerender();
    await waitFor(() => expect(view.result.current.isOutdated).toBe(true));
    expect(view.result.current.report).toBeNull();
    expect(mocks.api.mock.calls.every(([, options]) => !options || options.method !== "POST")).toBe(true);

    act(() => view.result.current.run(true));
    await waitFor(() => expect(view.result.current.report?.source_version).toBe(2));
    expect(view.result.current.isOutdated).toBe(false);
  });
});
