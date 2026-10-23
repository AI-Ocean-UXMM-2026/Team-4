import { useTranslation } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import {
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  Sparkles,
  UserRound,
} from "lucide-react";
export const navigation = [
  { to: "/data-source", label: "Data Source", icon: Database },
  { to: "/ai", label: "AI Analyzer", icon: Sparkles },
  { to: "/", label: "Financial Health", icon: ChartNoAxesCombined },
  { to: "/working-capital", label: "Working Capital", icon: CircleDollarSign },
  { to: "/credit", label: "Credit Hub", icon: ClipboardCheck },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;
export function Navigation({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("Main navigation")}
      className={`bf-nav flex w-full flex-col gap-2 ${collapsed ? "p-3" : "p-4"}`}
    >
      {navigation.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          aria-label={t(label)}
          title={t(label)}
          activeOptions={{ exact: true }}
          activeProps={{
            className: "bf-nav-active bg-secondary text-primary shadow-[inset_0_0_0_1px_#64280f12]",
          }}
          inactiveProps={{
            className: "text-muted-foreground hover:bg-muted hover:text-foreground",
          }}
          className={`flex min-h-11 min-w-0 items-center overflow-hidden rounded-xl py-2.5 text-[13px] font-medium transition-colors ${collapsed ? "px-3" : "gap-3 px-4"}`}
        >
          <Icon size={17} className="shrink-0" aria-hidden="true" />
          <span
            className={
              collapsed
                ? "w-0 shrink-0 whitespace-nowrap opacity-0 transition-[opacity,margin,width] duration-300 ease-in-out group-data-[expanded=true]/sidebar:ml-3 group-data-[expanded=true]/sidebar:w-44 group-data-[expanded=true]/sidebar:opacity-100 motion-reduce:transition-none"
                : ""
            }
          >
            {t(label)}
          </span>
        </Link>
      ))}
    </nav>
  );
}
