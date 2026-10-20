import { readSession } from "./auth";
import type { ImportResult, RowIssue } from "./contracts";

export const API_BASE = (import.meta.env["VITE_API_BASE_URL"] ?? "").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ImportResult[] | RowIssue[] = [],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readSession();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
  } catch {
    throw new Error("Cannot reach BizFlow. Check that the backend is running.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = data.error;
    if (response.status === 401 && error?.code === "UNAUTHENTICATED")
      window.dispatchEvent(new Event("bizflow-session-expired"));
    throw new ApiError(
      response.status,
      error?.code || "REQUEST_FAILED",
      error?.message || "Request failed. Try again.",
      error?.details || [],
    );
  }
  if (response.headers.get("content-type")?.includes("spreadsheetml"))
    return (await response.blob()) as T;
  return (await response.json()) as T;
}

export function businessPath(path: string, businessId: string) {
  return `/api/v1/data/${path}?business_id=${encodeURIComponent(businessId)}`;
}
