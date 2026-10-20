import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { api, ApiError } from "@/lib/apiClient";
import type { Business, PlatformConfig, Snapshot } from "@/lib/contracts";
import { useAccount, useAuth, useConfig } from "./session";

type Platform = {
  business: Business;
  businesses: Business[];
  setBusinessId: (id: string) => void;
  signOut: () => Promise<void>;
  config: PlatformConfig;
  imported: () => Promise<void>;
};
const PlatformContext = createContext<Platform | null>(null);
export function usePlatform() {
  const value = useContext(PlatformContext);
  if (!value) throw new Error("PlatformProvider is required");
  return value;
}
export function useSnapshot() {
  const { business } = usePlatform();
  return useQuery({
    queryKey: ["snapshot", business.id],
    queryFn: () =>
      api<Snapshot>(`/api/v1/data/snapshot?business_id=${encodeURIComponent(business.id)}`),
  });
}
export function AccountGate({
  children,
  onboarding = false,
}: {
  children: ReactNode;
  onboarding?: boolean;
}) {
  const { session, ready, signOut } = useAuth();
  const account = useAccount();
  if (!ready) return <Loading />;
  if (!session) return <Navigate to="/sign-in" replace />;
  if (account.isPending) return <Loading />;
  if (account.isError) {
    if (account.error instanceof ApiError && account.error.code === "EMAIL_UNVERIFIED")
      return <Navigate to="/verify-email" replace />;
    return (
      <div className="bf-card mx-auto my-12 max-w-md">
        <p role="alert">{account.error.message}</p>
        <button className="bf-button mt-4" onClick={() => void signOut()}>
          Return to sign in
        </button>
      </div>
    );
  }
  if (!onboarding && !account.data?.onboarding_complete)
    return <Navigate to="/onboarding" replace />;
  if (onboarding && account.data?.onboarding_complete) return <Navigate to="/" replace />;
  return children;
}
export function PlatformProvider({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const queries = useQueryClient();
  const config = useConfig();
  const [businessId, updateBusinessId] = useState("");
  useEffect(() => {
    updateBusinessId(sessionStorage.getItem("bizflow-business") || "");
  }, []);
  const setBusinessId = (id: string) => {
    sessionStorage.setItem("bizflow-business", id);
    updateBusinessId(id);
  };
  const businesses = useQuery({
    queryKey: ["businesses", session?.user.id],
    queryFn: () => api<{ businesses: Business[] }>("/api/v1/businesses"),
    enabled: !!session,
  });
  if (config.isPending || businesses.isPending) return <Loading />;
  if (config.isError || businesses.isError)
    return (
      <p role="alert" className="p-10">
        {config.error?.message || businesses.error?.message}
      </p>
    );
  const available = businesses.data?.businesses || [];
  const business = available.find((item) => item.id === businessId) || available[0];
  if (!business) return <Navigate to="/onboarding" replace />;
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
            queries.invalidateQueries({ queryKey: ["snapshot", business.id] }),
            queries.invalidateQueries({ queryKey: ["sync-status", business.id] }),
            queries.invalidateQueries({ queryKey: ["businesses"] }),
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
      Loading BIZFLOW…
    </p>
  );
}
