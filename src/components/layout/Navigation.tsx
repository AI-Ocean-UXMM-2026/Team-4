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
  return (
    <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
      {navigation.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: true }}
          activeProps={{ className: "border-primary text-primary" }}
          inactiveProps={{
            className: "border-transparent text-muted-foreground hover:text-foreground",
          }}
          className="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold"
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
