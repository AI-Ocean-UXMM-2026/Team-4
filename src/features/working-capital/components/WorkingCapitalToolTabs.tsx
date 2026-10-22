import { useId, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { useTranslation } from "@/lib/i18n";
import { UnlockCashSimulator } from "./UnlockCashSimulator";
import { CashGapSimulator } from "./CashGapSimulator";
import { ReservePlanner } from "./ReservePlanner";

type Tab = "find-cash" | "cash-gap" | "safety-reserve";
const tabs: { id: Tab; label: string; description: string }[] = [
  { id: "find-cash", label: "Find Cash", description: "Unlock hidden cash" },
  { id: "cash-gap", label: "Cash Gap", description: "Explore the cash gap" },
  { id: "safety-reserve", label: "Safety Reserve", description: "Build a safety reserve" },
];

export function WorkingCapitalToolTabs({
  unlockInputs,
  cashGapInputs,
  manualStock,
  manualInputs,
  simulate,
  planReserve,
}: {
  unlockInputs: ComponentProps<typeof UnlockCashSimulator>["inputs"];
  cashGapInputs: ComponentProps<typeof CashGapSimulator>["inputs"];
  manualStock: boolean;
  manualInputs: ComponentProps<typeof ReservePlanner>["inputs"];
  simulate: ComponentProps<typeof CashGapSimulator>["simulate"];
  planReserve: ComponentProps<typeof ReservePlanner>["planReserve"];
}) {
  const { t } = useTranslation();
  const baseId = useId();
  const [active, setActive] = useState<Tab>("find-cash");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(tabs[next]!.id);
    buttons.current[next]?.focus();
  }

  return (
    <section className="space-y-4" aria-label={t("Working Capital tools")}>
      <div
        role="tablist"
        aria-label={t("Working Capital tools")}
        className="grid gap-2 sm:grid-cols-3"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(button) => {
              buttons.current[index] = button;
            }}
            id={`${baseId}-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`${baseId}-${tab.id}-panel`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            className={`min-w-0 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              active === tab.id
                ? "border-primary bg-primary/10 text-primary"
                : "bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <span className="block text-sm font-semibold">{t(tab.label)}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t(tab.description)}</span>
          </button>
        ))}
      </div>
      <div
        id={`${baseId}-find-cash-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-find-cash-tab`}
        tabIndex={0}
        hidden={active !== "find-cash"}
      >
        <UnlockCashSimulator inputs={unlockInputs} manualStock={manualStock} />
      </div>
      <div
        id={`${baseId}-cash-gap-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-cash-gap-tab`}
        tabIndex={0}
        hidden={active !== "cash-gap"}
      >
        <CashGapSimulator simulate={simulate} inputs={cashGapInputs} />
      </div>
      <div
        id={`${baseId}-safety-reserve-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-safety-reserve-tab`}
        tabIndex={0}
        hidden={active !== "safety-reserve"}
      >
        <ReservePlanner planReserve={planReserve} inputs={manualInputs} />
      </div>
    </section>
  );
}
