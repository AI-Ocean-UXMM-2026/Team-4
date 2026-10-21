import { useTranslation } from "@/lib/i18n";
import type { ReactNode } from "react";
import { usePlatform } from "@/app/providers";
import { Navigation } from "./Navigation";
import { TopBar } from "./TopBar";
export function MainLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const { business } = usePlatform();
  return (
    <div className="bf-app min-h-screen">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-xl bg-primary px-4 py-3 font-semibold text-white focus:not-sr-only"
      >
        {t("Skip to content")}
      </a>
      <header className="bf-app-header border-b">
        <TopBar />
        <Navigation />
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        key={business.id}
        className="mx-auto max-w-[1280px] px-4 py-7 outline-none sm:px-8 sm:py-9"
      >
        {children}
      </main>
      <footer className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 border-t px-4 py-6 text-xs text-muted-foreground sm:px-8">
        <span className="font-semibold text-primary">{t("ရှေ့ဆက် — Shay Sett")}</span>
        <span>{t("Your workspace updates after each successful import.")}</span>
      </footer>
    </div>
  );
}
