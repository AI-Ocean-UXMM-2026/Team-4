import type { ReactNode } from "react";
import { usePlatform } from "@/app/providers";
import { Navigation } from "./Navigation";
import { TopBar } from "./TopBar";
export function MainLayout({ children }: { children: ReactNode }) {
  const { business } = usePlatform();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <TopBar />
        <Navigation />
      </header>
      <main key={business.id} className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl border-t px-6 py-5 text-xs text-muted-foreground">
        BIZFLOW · Changes appear after a successful import. OneDrive syncing requires an authorized
        cloud workbook.
      </footer>
    </div>
  );
}
