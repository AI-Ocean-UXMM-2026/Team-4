import { accessToken, authClient } from "./auth";
import type { ImportResult, RowIssue } from "./contracts";

export const API_BASE = (import.meta.env["VITE_API_BASE_URL"] ?? "").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ImportResult[] | RowIssue[] = [],
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export function retryAfterSeconds(value: string | null, now = Date.now()): number | undefined {
  if (value === null || !value.trim()) return undefined;
  value = value.trim();
  if (/^\d+$/.test(value)) return Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /i.test(value)) return undefined;
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : undefined;
}

export async function api<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = await accessToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
  } catch {
    if (path === "/api/v1/auth/register") {
      throw new ApiError(
        0,
        "AUTH_REQUEST_UNCONFIRMED",
        "The signup response was not received. Try signing in before registering again.",
      );
    }
    throw new Error("Cannot reach Shay Sett. Check your connection and try again.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = data.error;
    if (response.status === 401 && error?.code === "UNAUTHENTICATED") {
      const client = authClient();
      if (!retried && client) {
        const refreshed = await client.auth.refreshSession();
        if (!refreshed.error && refreshed.data.session) return api<T>(path, options, true);
      }
      await client?.auth.signOut({ scope: "local" });
    }
    throw new ApiError(
      response.status,
      error?.code || "REQUEST_FAILED",
      error?.message || (typeof data.detail === "string" ? data.detail : "Request failed. Try again."),
      error?.details || [],
      retryAfterSeconds(response.headers.get("Retry-After")),
    );
  }
  if (response.headers.get("content-type")?.includes("spreadsheetml") || response.headers.get("content-type")?.includes("application/octet-stream"))
    return (await response.blob()) as T;
  return (await response.json()) as T;
}

export function businessPath(path: string, businessId: string) {
  return `/api/v1/data/${path}?business_id=${encodeURIComponent(businessId)}`;
}
