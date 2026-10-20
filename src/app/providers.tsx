import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { readSession, saveSession, signInSupabase } from "@/lib/auth";
import type { Business, PlatformConfig, Snapshot } from "@/lib/contracts";

type Platform = {
  business: Business;
  businesses: Business[];
  setBusinessId: (id: string) => void;
  signOut: () => void;
  config: PlatformConfig;
  imported: () => Promise<void>;
};
const PlatformContext = createContext<Platform | null>(null);
export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("PlatformProvider is required");
  return context;
}
export function useSnapshot() {
  const { business } = usePlatform();
  return useQuery({
    queryKey: ["snapshot", business.id],
    queryFn: () =>
      api<Snapshot>(`/api/v1/data/snapshot?business_id=${encodeURIComponent(business.id)}`),
  });
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [businessId, updateBusinessId] = useState("");
  const setBusinessId = (id: string) => {
    sessionStorage.setItem("bizflow-business", id);
    updateBusinessId(id);
  };
  useEffect(() => {
    setToken(readSession());
    updateBusinessId(sessionStorage.getItem("bizflow-business") || "");
    setHydrated(true);
  }, []);
  const signOut = () => {
    saveSession(null);
    setToken(null);
    setBusinessId("");
    queryClient.clear();
  };
  useEffect(() => {
    const expired = () => {
      saveSession(null);
      setToken(null);
      queryClient.clear();
    };
    window.addEventListener("bizflow-session-expired", expired);
    return () => window.removeEventListener("bizflow-session-expired", expired);
  }, [queryClient]);
  const config = useQuery({
    queryKey: ["platform-config"],
    queryFn: () => api<PlatformConfig>("/api/v1/config"),
    retry: false,
  });
  const businesses = useQuery({
    queryKey: ["businesses", token],
    queryFn: () => api<{ businesses: Business[] }>("/api/v1/businesses"),
    enabled: !!token,
    retry: false,
  });
  if (!hydrated || config.isPending) return <Loading />;
  if (config.isError)
    return (
      <div className="mx-auto max-w-xl p-10">
        <h1 className="text-2xl font-bold">Connect to BizFlow</h1>
        <p role="alert" className="my-4">
          {config.error.message}
        </p>
        <button className="bf-button" onClick={() => void config.refetch()}>
          Retry connection
        </button>
      </div>
    );
  if (!token)
    return (
      <SignIn
        config={config.data}
        onSignedIn={(next) => {
          saveSession(next);
          setToken(next);
        }}
      />
    );
  if (businesses.isPending) return <Loading />;
  if (businesses.isError)
    return (
      <div className="p-10">
        <p role="alert">{businesses.error.message}</p>
        <button className="bf-button mt-4" onClick={signOut}>
          Sign in again
        </button>
      </div>
    );
  const available = businesses.data?.businesses || [];
  const business = available.find((item) => item.id === businessId) || available[0];
  if (!business)
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold">No business assigned</h1>
        <p className="my-4">
          Ask your administrator to add your business membership, or seed the synthetic demo.
        </p>
        <button className="bf-button" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  return (
    <PlatformContext.Provider
      value={{
        business,
        businesses: available,
        setBusinessId,
        signOut,
        config: config.data,
        imported: async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["snapshot", business.id] }),
            queryClient.invalidateQueries({ queryKey: ["sync-status", business.id] }),
            queryClient.invalidateQueries({ queryKey: ["businesses"] }),
          ]);
        },
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function Loading() {
  return (
    <p role="status" className="p-10 text-muted-foreground">
      Loading BizFlow…
    </p>
  );
}
function SignIn({
  config,
  onSignedIn,
}: {
  config: PlatformConfig;
  onSignedIn: (token: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form
        className="bf-card w-full max-w-md space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const next =
              config.auth_mode === "demo"
                ? (
                    await api<{ access_token: string }>("/api/v1/auth/demo-login", {
                      method: "POST",
                      body: JSON.stringify({ password }),
                    })
                  ).access_token
                : await signInSupabase(email, password);
            onSignedIn(next);
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Sign-in failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="text-sm font-bold uppercase tracking-widest text-primary">BizFlow</div>
        <h1 className="text-3xl font-bold">Your business, connected.</h1>
        <p className="text-muted-foreground">
          {config.auth_mode === "demo"
            ? "Sign in to explore three synthetic SMEs and import their Excel records."
            : "Sign in with your business account."}
        </p>
        {config.auth_mode === "supabase" && (
          <label className="block text-sm font-semibold">
            Email
            <input
              className="bf-input mt-2"
              type="email"
              value={email}
              required
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        <label className="block text-sm font-semibold">
          {config.auth_mode === "demo" ? "Demo password" : "Password"}
          <input
            className="bf-input mt-2"
            type="password"
            value={password}
            required
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <button className="bf-button w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-muted-foreground">
          Excel imports are explicit. Save and upload your workbook to update your records.
        </p>
      </form>
    </main>
  );
}
