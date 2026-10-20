import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
export async function authConfigurationMatches(url: string, fingerprint: string): Promise<boolean> {
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (
    !key ||
    !url ||
    url.replace(/\/$/, "") !== import.meta.env["VITE_SUPABASE_URL"]?.replace(/\/$/, "")
  )
    return false;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return (
    Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("") ===
    fingerprint
  );
}
export function authClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  try {
    client ??= createClient(url, key, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
  return client;
}
export function requireAuthClient(): SupabaseClient {
  const current = authClient();
  if (!current)
    throw new Error("Account access is not configured yet. Contact your administrator.");
  return current;
}
export async function accessToken(): Promise<string | null> {
  const current = authClient();
  if (!current) return null;
  const { data, error } = await current.auth.getSession();
  if (error) return null;
  return data.session?.access_token || null;
}
export async function completeEmailCallback(): Promise<{ recovery: boolean }> {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  // Clear one-use credentials before rendering or making any unrelated requests.
  window.history.replaceState({}, "", "/auth/callback");
  const failure = () =>
    new Error("This link is invalid or has expired. Request a new email and try again.");
  if (url.searchParams.has("error") || fragment.has("error")) throw failure();
  const current = requireAuthClient();
  const hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let recovery = false;
  if (hash && (type === "signup" || type === "recovery")) {
    const { error } = await current.auth.verifyOtp({ token_hash: hash, type });
    if (error) throw failure();
    recovery = type === "recovery";
  } else if (url.searchParams.get("code")) {
    const { error } = await current.auth.exchangeCodeForSession(url.searchParams.get("code")!);
    if (error) throw failure();
    recovery = url.searchParams.get("flow") === "recovery";
  } else if (fragment.get("access_token") && fragment.get("refresh_token")) {
    // Compatibility with Supabase's standard confirmation/recovery email templates.
    // Reject expired redirect credentials; setSession alone could refresh an old URL.
    const checked = await current.auth.getClaims(fragment.get("access_token")!);
    if (checked.error || !checked.data?.claims) throw failure();
    const { error } = await current.auth.setSession({
      access_token: fragment.get("access_token")!,
      refresh_token: fragment.get("refresh_token")!,
    });
    if (error) throw failure();
    recovery = fragment.get("type") === "recovery";
  } else throw failure();
  const { data, error } = await current.auth.getUser();
  if (error || !data.user?.email_confirmed_at) throw failure();
  return { recovery };
}
