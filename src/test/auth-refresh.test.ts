import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ accessToken: vi.fn(), refresh: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  accessToken: auth.accessToken,
  authClient: () => ({ auth: { refreshSession: auth.refresh, signOut: auth.signOut } }),
}));
import { api, retryAfterSeconds } from "@/lib/apiClient";
beforeEach(() => {
  vi.clearAllMocks();
  auth.accessToken.mockResolvedValue("expired");
});
it("uses provider refresh and retries an expired API session once", async () => {
  auth.refresh.mockResolvedValue({ data: { session: {} }, error: null });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED" } }), { status: 401 }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  expect(await api("/api/v1/auth/me")).toEqual({ ok: true });
  expect(auth.refresh).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("ends the local provider session when refresh is invalid", async () => {
  auth.refresh.mockResolvedValue({ data: { session: null }, error: new Error("refresh expired") });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Sign in again" } }),
          { status: 401 },
        ),
      ),
  );
  await expect(api("/api/v1/auth/me")).rejects.toThrow("Sign in again");
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("reads explicit retry timing and leaves unknown timing unset", async () => {
  const now = Date.parse("2026-10-21T00:00:00Z");
  expect(retryAfterSeconds("125", now)).toBe(125);
  expect(retryAfterSeconds("Wed, 21 Oct 2026 00:03:00 GMT", now)).toBe(180);
  for (const value of [null, "", "later", "-1", "99999999999999999999999999"]) {
    expect(retryAfterSeconds(value, now)).toBeUndefined();
  }
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: { code: "AUTH_RATE_LIMITED", message: "Wait" } }), {
      status: 429,
      headers: { "Retry-After": "125" },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(api("/api/v1/auth/resend-verification", { method: "POST" })).rejects.toMatchObject({
    status: 429,
    retryAfterSeconds: 125,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("does not retry signup or invent success when its response is lost", async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError("network error"));
  vi.stubGlobal("fetch", fetch);
  await expect(api("/api/v1/auth/register", { method: "POST" })).rejects.toMatchObject({
    code: "AUTH_REQUEST_UNCONFIRMED",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
