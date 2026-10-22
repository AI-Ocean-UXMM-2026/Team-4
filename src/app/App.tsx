import type { ReactNode } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PlatformProvider } from "./providers";
import { AccountGate } from "./providers";
import { AuthProvider } from "./session";
import { useRouterState } from "@tanstack/react-router";
export function App({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const publicPage = [
    "/sign-in",
    "/register",
    "/forgot-password",
    "/verify-email",
    "/auth/callback",
    "/reset-password",
  ].includes(path);
  return (
    <AuthProvider>
      {publicPage ? (
        children
      ) : path === "/onboarding" ? (
        <AccountGate onboarding>{children}</AccountGate>
      ) : (
        <AccountGate>
          <PlatformProvider>
            <MainLayout path={path}>{children}</MainLayout>
          </PlatformProvider>
        </AccountGate>
      )}
    </AuthProvider>
  );
}
