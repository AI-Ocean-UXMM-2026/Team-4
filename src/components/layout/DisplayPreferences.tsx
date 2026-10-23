import { Moon, Sun } from "lucide-react";
import { usePreferences, type Language } from "@/lib/preferences";
import { useTranslation } from "@/lib/i18n";

export function DisplayPreferences() {
  const { language, theme, setPreferences } = usePreferences();
  const { t } = useTranslation();
  return (
    <div className="bf-display-preferences flex shrink-0 items-center gap-1.5 rounded-full border p-1">
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(event) => setPreferences({ language: event.target.value as Language })}
        className="h-9 max-w-28 rounded-full bg-transparent px-2.5 text-xs font-semibold text-foreground outline-none"
      >
        <option value="en">English</option>
        <option value="my">မြန်မာ</option>
      </select>
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <button
        type="button"
        aria-label={t(theme === "dark" ? "Switch to light mode" : "Switch to dark mode")}
        onClick={() => setPreferences({ theme: theme === "dark" ? "light" : "dark" })}
        className="bf-theme-toggle bf-button-quiet grid h-9 w-9 place-items-center rounded-full bg-primary/5"
      >
        {theme === "dark" ? (
          <Sun key="sun" size={17} aria-hidden="true" />
        ) : (
          <Moon key="moon" size={17} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
