import type { ReactNode } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PlatformProvider } from "./providers";
export function App({ children }: { children: ReactNode }) {
  return (
    <PlatformProvider>
      <MainLayout>{children}</MainLayout>
    </PlatformProvider>
  );
}
