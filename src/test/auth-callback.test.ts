import { beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  getUser: vi.fn(),
  getClaims: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: sdk }) }));
import { completeEmailCallback, authConfigurationMatches } from "@/lib/auth";
import { createHash, webcrypto } from "node:crypto";
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.example.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.clearAllMocks();
  sdk.verifyOtp.mockResolvedValue({ error: null });
  sdk.exchangeCodeForSession.mockResolvedValue({ error: null });
  sdk.setSession.mockResolvedValue({ error: null });
  sdk.getClaims.mockResolvedValue({ error: null, data: { claims: {} } });
  sdk.getUser.mockResolvedValue({
    data: { user: { email_confirmed_at: "2026-10-20" } },
    error: null,
  });
});
describe("Provider email callbacks", () => {
  it("requires the browser and backend project URL and public key to match", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const fingerprint = createHash("sha256").update("public-test-key").digest("hex");
    expect(await authConfigurationMatches("https://auth.example.test", fingerprint)).toBe(true);
    expect(await authConfigurationMatches("https://other.example.test", fingerprint)).toBe(false);
    expect(await authConfigurationMatches("https://auth.example.test", "wrong-key")).toBe(false);
  });
  it("verifies signup hashes with the provider and removes credentials from the URL", async () => {
    history.replaceState(
      {},
      "",
      "/auth/callback?token_hash=signup-hash&type=signup&next=https://attacker.example",
    );
    expect(await completeEmailCallback()).toEqual({ recovery: false });
    expect(sdk.verifyOtp).toHaveBeenCalledWith({ token_hash: "signup-hash", type: "signup" });
    expect(location.pathname + location.search + location.hash).toBe("/auth/callback");
  });
  it("marks recovery only after the provider verifies its one-use token", async () => {
    history.replaceState({}, "", "/auth/callback?token_hash=reset-hash&type=recovery");
    expect(await completeEmailCallback()).toEqual({ recovery: true });
    sdk.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    history.replaceState({}, "", "/auth/callback?token_hash=expired&type=recovery");
    await expect(completeEmailCallback()).rejects.toThrow("invalid or has expired");
  });
  it("supports the provider's standard fragment redirect without trusting its identity", async () => {
    history.replaceState(
      {},
      "",
      "/auth/callback#access_token=access&refresh_token=refresh&type=recovery",
    );
    expect(await completeEmailCallback()).toEqual({ recovery: true });
    expect(sdk.setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(sdk.getUser).toHaveBeenCalled();
  });
  it("rejects absent, invalid or unconfirmed sessions", async () => {
    history.replaceState({}, "", "/auth/callback?flow=recovery");
    await expect(completeEmailCallback()).rejects.toThrow("expired");
    sdk.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: null } }, error: null });
    history.replaceState({}, "", "/auth/callback?code=auth-code");
    await expect(completeEmailCallback()).rejects.toThrow("expired");
  });
  it("does not renew an expired recovery URL using its refresh token", async () => {
    sdk.getClaims.mockResolvedValue({ error: { code: "jwt_expired" } });
    history.replaceState(
      {},
      "",
      "/auth/callback#access_token=expired&refresh_token=still-valid&type=recovery",
    );
    await expect(completeEmailCallback()).rejects.toThrow("expired");
    expect(sdk.setSession).not.toHaveBeenCalled();
  });
});
