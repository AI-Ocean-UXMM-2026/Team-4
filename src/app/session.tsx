import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { authClient, authConfigurationMatches } from "@/lib/auth";
import { api } from "@/lib/apiClient";
import type { AccountStatus, PlatformConfig } from "@/lib/contracts";

type AuthState = {
  session: Session | null;
  ready: boolean;
  recoveryReady: boolean;
  setRecoveryReady: (ready: boolean) => void;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
export function useConfig() {
  return useQuery({
    queryKey: ["platform-config"],
    queryFn: async () => {
      const config = await api<PlatformConfig>("/api/v1/config");
      if (
        config.auth_status.ready &&
        !(await authConfigurationMatches(config.auth_url, config.auth_key_fingerprint))
      ) {
        config.auth_status = {
          ready: false,
          code: "AUTH_CLIENT_MISMATCH",
          message: "Account access is being configured. Please try again later.",
        };
      }
      return config;
    },
    staleTime: 0,
    retry: false,
  });
}
export function useAccount() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["account", session?.user.id],
    queryFn: () => api<AccountStatus>("/api/v1/auth/me"),
    enabled: !!session,
    retry: false,
  });
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const queries = useQueryClient();
  const activeUser = useRef<string | null>(null);
  useEffect(() => {
    const client = authClient();
    // Retire the old custom session; it can no longer authenticate against the API.
    sessionStorage.removeItem("bizflow-session");
    if (!client) {
      setReady(true);
      return;
    }
    let active = true;
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (activeUser.current && activeUser.current !== next?.user.id) {
        queries.clear();
        sessionStorage.removeItem("bizflow-business");
        setRecoveryReady(false);
      }
      activeUser.current = next?.user.id || null;
      setSession(next);
      setReady(true);
      if (event === "SIGNED_OUT") {
        setRecoveryReady(false);
        queries.clear();
      }
    });
    void client.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setSession(null);
          setReady(true);
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queries]);
  const signOut = async () => {
    const client = authClient();
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) await client.auth.signOut({ scope: "local" });
    }
    setSession(null);
    setRecoveryReady(false);
    sessionStorage.removeItem("bizflow-business");
    queries.clear();
  };
  return (
    <AuthContext.Provider value={{ session, ready, recoveryReady, setRecoveryReady, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
