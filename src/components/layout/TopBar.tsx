import { useTranslation } from "@/lib/i18n";
import { usePlatform } from "@/app/providers";
import { Building2, LogOut } from "lucide-react";
import { Brand } from "./Brand";
import { DisplayPreferences } from "./DisplayPreferences";
export function TopBar() {
  const { t } = useTranslation();

  const { business, businesses, setBusinessId, signOut } = usePlatform();
  return (
    <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
      <div className="mr-auto lg:hidden">
        <Brand />
      </div>
      <DisplayPreferences />
      <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-background/70 px-3 py-2 text-sm">
          <Building2 size={16} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="sr-only">{t("Active business")}</span>
          <select
            aria-label={t("Active business")}
            value={business.id}
            onChange={(e) => setBusinessId(e.target.value)}
            className="w-full min-w-0 bg-transparent py-1 pr-2 text-sm font-semibold text-foreground sm:max-w-56"
          >
            {businesses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="bf-button-secondary min-h-11 border-transparent bg-transparent px-3 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t("Sign out")}</span>
          <span className="sr-only sm:hidden">{t("Sign out")}</span>
        </button>
      </div>
    </div>
  );
}
