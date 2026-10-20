// Browser session only. Graph and service tokens never enter this module.
const SESSION_KEY = "bizflow-session";
export function readSession(): string | null {
  return typeof window === "undefined" ? null : sessionStorage.getItem(SESSION_KEY);
}
export function saveSession(token: string | null) {
  if (token) sessionStorage.setItem(SESSION_KEY, token);
  else sessionStorage.removeItem(SESSION_KEY);
}

export async function signInSupabase(email: string, password: string): Promise<string> {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase browser sign-in has not been configured.");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token)
    throw new Error("Sign-in failed. Check your email and password.");
  return data.access_token as string;
}
