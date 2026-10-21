import { ArrowUpRight } from "lucide-react";
import { APP_NAME } from "@/lib/i18n";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <a href={href} aria-label={APP_NAME} className="bf-brand flex min-w-0 items-center gap-2.5">
      <span className="bf-brand-mark">
        <ArrowUpRight size={25} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="flex flex-wrap items-baseline gap-x-1.5 font-semibold tracking-tight text-foreground">
        <span className="font-myanmar text-lg leading-relaxed sm:text-xl">ရှေ့ဆက်</span>
        <span className="whitespace-nowrap font-display text-xs text-muted-foreground sm:text-sm">
          — Shay Sett
        </span>
      </span>
    </a>
  );
}
