import { useEffect, useSyncExternalStore } from "react";

export type Language = "en" | "my";
export type Theme = "light" | "dark";
type Preferences = { language: Language; theme: Theme };
const key = "shay-sett.preferences.v1";
const defaults: Preferences = { language: "en", theme: "light" };
let current = defaults;
let initialized = false;
const listeners = new Set<() => void>();

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      language: stored.language === "my" ? "my" : "en",
      theme:
        stored.theme === "dark" ||
        (stored.theme !== "light" && window.matchMedia?.("(prefers-color-scheme: dark)").matches)
          ? "dark"
          : "light",
    };
  } catch {
    return defaults;
  }
}

function apply(next: Preferences) {
  current = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next.language;
    document.documentElement.classList.toggle("dark", next.theme === "dark");
    document.documentElement.style.colorScheme = next.theme;
  }
  listeners.forEach((listener) => listener());
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  apply(readPreferences());
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) apply(readPreferences());
  });
}

export function setPreferences(update: Partial<Preferences>) {
  initialize();
  const next = { ...current, ...update };
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* Preferences also work without browser storage. */
  }
  apply(next);
}

export function getPreferences() {
  return current;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function usePreferences() {
  const preferences = useSyncExternalStore(subscribe, getPreferences, () => defaults);
  useEffect(initialize, []);
  return { ...preferences, setPreferences };
}

// Apply the saved appearance before the first paint. Values are strictly allowlisted.
export const preferenceBootScript = `try{const p=JSON.parse(localStorage.getItem('${key}')||'{}');const d=p.theme==='dark'||(p.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';document.documentElement.lang=p.language==='my'?'my':'en';}catch{}`;
