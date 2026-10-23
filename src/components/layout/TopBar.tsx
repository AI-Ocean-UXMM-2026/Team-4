import { useTranslation } from "@/lib/i18n";
import { usePlatform } from "@/app/providers";
import { Link } from "@tanstack/react-router";
import { Building2, LogOut, UserRound } from "lucide-react";
import { Brand } from "./Brand";
import { DisplayPreferences } from "./DisplayPreferences";
export function TopBar() {
  const { t } = useTranslation();
  const { business, signOut } = usePlatform();

  return (
    <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-8">
      {/* Left side: Brand (on mobile) + Active Business Badge */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="lg:hidden shrink-0">
          <Brand />
        </div>
        <div
          title={business.name}
          aria-label={t("Active business")}
          className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-semibold shadow-xs sm:text-sm"
        >
          <Building2 size={15} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="max-w-[180px] truncate sm:max-w-[260px] text-foreground">
            {business.name}
          </span>
        </div>
      </div>

      {/* Right side: Utilities (Language & Theme) + User Profile + Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3">
        <DisplayPreferences />
        <span aria-hidden="true" className="h-5 w-px bg-border/60" />
        <Link
          to="/profile"
          aria-label={t("Your profile")}
          title={t("Your profile")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary transition-all hover:bg-primary/20 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UserRound size={17} aria-hidden="true" />
        </Link>
        <button
          className="bf-button-secondary min-h-9 px-3 py-1.5 text-xs font-medium"
          onClick={signOut}
        >
          <LogOut size={14} aria-hidden="true" />
          <span className="hidden sm:inline">{t("Sign out")}</span>
          <span className="sr-only sm:hidden">{t("Sign out")}</span>
        </button>
      </div>
    </div>
  );
}
