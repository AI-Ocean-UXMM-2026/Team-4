import { getPreferences, usePreferences, type Language } from "./preferences";
import { my } from "./locales/my";

export const APP_NAME = "ရှေ့ဆက် — Shay Sett";
type Values = Record<string, string | number>;
export function translate(
  text: string,
  values: Values = {},
  language: Language = getPreferences().language,
): string {
  let source = text.replace(/BIZFLOW|BizFlow/g, "Shay Sett");
  const minimum = /^Use at least (\d+) characters\.$/.exec(source);
  if (minimum) {
    source = "Use at least {0} characters.";
    values = { ...values, 0: minimum[1]! };
  }
  const quantity = /^(-?[\d,.]+) (MMK|days)$/.exec(source);
  if (quantity) {
    source = `{0} ${quantity[2]}`;
    values = { ...values, 0: quantity[1]! };
  }
  const translated = language === "my" ? my[source] || source : source;
  return translated.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
export function useTranslation() {
  const { language } = usePreferences();
  return { language, t: (text: string, values?: Values) => translate(text, values, language) };
}
