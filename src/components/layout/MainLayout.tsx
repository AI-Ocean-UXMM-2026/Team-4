import { useTranslation } from "@/lib/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { usePlatform } from "@/app/providers";
import { Navigation } from "./Navigation";
import { TopBar } from "./TopBar";
import { ArrowUpRight, Menu, PanelLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
type SidebarMode = "expanded" | "collapsed" | "hover";
export function MainLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("hover");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("shay-sett-sidebar-mode");
      if (saved === "expanded" || saved === "collapsed" || saved === "hover") setSidebarMode(saved);
    } catch {
      /* Use the default when browser storage is unavailable. */
    }
  }, []);
  const expanded =
    sidebarMode === "expanded" ||
    (sidebarMode === "hover" && (sidebarOpen || sidebarHovered || sidebarFocused));
  function changeSidebarMode(value: string) {
    if (value !== "expanded" && value !== "collapsed" && value !== "hover") return;
    setSidebarMode(value);
    setSidebarOpen(false);
    setSidebarFocused(false);
    setSidebarHovered(false);
    try {
      localStorage.setItem("shay-sett-sidebar-mode", value);
    } catch {
      /* Keep the selection for this session. */
    }
  }

  const { business } = usePlatform();
  return (
    <div className="bf-app min-h-screen">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-xl bg-primary px-4 py-3 font-semibold text-white focus:not-sr-only"
      >
        {t("Skip to content")}
      </a>
      <aside
        data-expanded={expanded}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        onFocus={(event) => {
          if (event.target.matches(":focus-visible")) setSidebarFocused(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSidebarFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setSidebarOpen(false);
            setSidebarHovered(false);
            setSidebarFocused(false);
          }
        }}
        className="group/sidebar fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col overflow-x-hidden border-r bg-card transition-[width] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] data-[expanded=true]:w-64 motion-reduce:transition-none lg:flex"
      >
        <div className="flex min-h-24 items-center gap-3 border-b px-3">
          <button
            type="button"
            aria-label={"Main navigation"}
            aria-expanded={expanded}
            title={expanded ? "Collapsed" : "Expanded"}
            onClick={() => changeSidebarMode(expanded ? "collapsed" : "expanded")}
            className="bf-brand-mark grid h-12 w-11 shrink-0 place-items-center rounded-xl"
          >
            <ArrowUpRight size={21} aria-hidden="true" />
          </button>
          <div className="w-40 shrink-0 opacity-0 transition-opacity duration-300 group-data-[expanded=true]/sidebar:opacity-100 motion-reduce:transition-none">
            <span className="block text-base font-semibold">ရှေ့ဆက်</span>
            <span className="text-xs text-muted-foreground">Shay Sett</span>
          </div>
        </div>
        <div className="flex-1 overflow-x-hidden overflow-y-auto py-4">
          <Navigation collapsed onNavigate={() => setSidebarOpen(false)} />
        </div>
        <p className="pointer-events-none w-64 border-t px-5 py-5 text-xs leading-6 text-muted-foreground opacity-0 transition-opacity duration-300 group-data-[expanded=true]/sidebar:opacity-100 motion-reduce:transition-none">
          {t("Your workspace updates after each successful import.")}
        </p>
        <div className="border-t p-3">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={"Sidebar control"}
                title={"Sidebar control"}
                className="flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-muted-foreground hover:bg-secondary hover:text-primary"
              >
                <PanelLeft size={17} className="shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-300 group-data-[expanded=true]/sidebar:opacity-100">
                  {"Sidebar control"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={10}
              className="w-52 shadow-xl [&_[role=menuitemradio]]:text-[13px]"
            >
              <DropdownMenuLabel>{"Sidebar control"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sidebarMode} onValueChange={changeSidebarMode}>
                <DropdownMenuRadioItem value="expanded">{"Expanded"}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="collapsed">{"Collapsed"}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="hover">{"Expand on hover"}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <div
        data-expanded={expanded}
        className="min-w-0 transition-[padding-left] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:pl-[72px] lg:data-[expanded=true]:pl-64"
        onPointerDown={() => setSidebarOpen(false)}
      >
        <header className="bf-app-header border-b">
          <TopBar />
          <details className="group px-4 pb-3 lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-primary">
              <Menu size={18} aria-hidden="true" />
              {"Main navigation"}
            </summary>
            <Navigation
              onNavigate={() => {
                document
                  .querySelector<HTMLDetailsElement>("header details[open]")
                  ?.removeAttribute("open");
              }}
            />
          </details>
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
    </div>
  );
}
