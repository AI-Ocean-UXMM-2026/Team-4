import { useTranslation } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import {
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  Sparkles,
} from "lucide-react";
export const navigation = [
  { to: "/", label: "Financial Health", icon: ChartNoAxesCombined },
  { to: "/working-capital", label: "Working Capital", icon: CircleDollarSign },
  { to: "/credit", label: "Credit Hub", icon: ClipboardCheck },
  { to: "/ai", label: "AI Analyzer", icon: Sparkles },
  { to: "/data-source", label: "Data Source", icon: Database },
] as const;
export function Navigation() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("Main navigation")}
      className="mx-auto flex max-w-[1280px] gap-1.5 overflow-x-auto px-4 pb-3 sm:px-8"
    >
      {navigation.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: true }}
          activeProps={{
            className: "bg-secondary text-primary shadow-[inset_0_0_0_1px_#6d28d912]",
          }}
          inactiveProps={{
            className: "text-muted-foreground hover:bg-muted hover:text-foreground",
          }}
          className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
        >
          <Icon size={17} aria-hidden="true" />
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}
