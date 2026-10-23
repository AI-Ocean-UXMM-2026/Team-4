import { createContext, useContext, useState, type ReactNode } from "react";

export type ManualWorkingCapitalInputs = {
  availableCashMmk: string | null;
  supplierLeadDays: number;
  mandatoryMonthlyPaymentsMmk: string;
  monthlyEssentialCostsMmk: string;
  protectedReserveMmk: string;
  dedicatedReserveMmk: string;
  stockLevels: Record<string, string>;
};

type ManualContext = {
  inputs: ManualWorkingCapitalInputs | null;
  save: (inputs: ManualWorkingCapitalInputs) => void;
};

const Context = createContext<ManualContext | null>(null);

function readStored(key: string): ManualWorkingCapitalInputs | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const input = value as Partial<ManualWorkingCapitalInputs>;
    if (
      !Number.isInteger(input.supplierLeadDays) ||
      input.supplierLeadDays! < 0 ||
      typeof input.mandatoryMonthlyPaymentsMmk !== "string" ||
      typeof input.protectedReserveMmk !== "string" ||
      !input.stockLevels ||
      typeof input.stockLevels !== "object"
    )
      return null;
    return {
      ...input,
      availableCashMmk: typeof input.availableCashMmk === "string" ? input.availableCashMmk : null,
      monthlyEssentialCostsMmk:
        typeof input.monthlyEssentialCostsMmk === "string"
          ? input.monthlyEssentialCostsMmk
          : input.mandatoryMonthlyPaymentsMmk,
      dedicatedReserveMmk:
        typeof input.dedicatedReserveMmk === "string" ? input.dedicatedReserveMmk : "0",
    } as ManualWorkingCapitalInputs;
  } catch {
    return null;
  }
}

export function WorkingCapitalManualProvider({
  storageKey,
  children,
}: {
  storageKey: string;
  children: ReactNode;
}) {
  const [inputs, setInputs] = useState<ManualWorkingCapitalInputs | null>(() =>
    typeof window === "undefined" ? null : readStored(storageKey),
  );
  const save = (next: ManualWorkingCapitalInputs) => {
    setInputs(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The current session still works when local storage is unavailable.
    }
  };
  return <Context.Provider value={{ inputs, save }}>{children}</Context.Provider>;
}

export function useWorkingCapitalManualInputs() {
  const context = useContext(Context);
  if (!context) throw new Error("WorkingCapitalManualProvider is required");
  return context;
}
