import { useTranslation } from "@/lib/i18n";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Eye,
  EyeOff,
  Layers3,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { BusinessDetails } from "@/lib/contracts";
import type { PasswordPolicy } from "./validation";
import { Brand } from "@/components/layout/Brand";
import { DisplayPreferences } from "@/components/layout/DisplayPreferences";
import { AuroraBackdrop } from "@/components/layout/AuroraBackdrop";

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <main className="bf-auth min-h-screen px-5 py-6 sm:px-10">
      <AuroraBackdrop />
      <header className="mx-auto flex max-w-[1220px] flex-wrap items-center justify-between gap-4">
        <Brand href="/sign-in" />
        <DisplayPreferences />
      </header>
      <div className="mx-auto grid min-h-[calc(100svh-100px)] max-w-[1220px] items-center gap-10 py-8 lg:grid-cols-[1.05fr_1fr] lg:py-7">
        <aside className="bf-auth-story">
          <p className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-inherit">
            <Sparkles size={13} aria-hidden="true" />
            {t("Built around your business")}
          </p>
          <h2 className="max-w-md font-display text-[2.8rem] font-bold leading-[1.12] tracking-[-0.045em] xl:text-[3.3rem]">
            {t("A clearer view.")}
            <br />
            {t("A stronger")}
            <br />
            <span className="text-inherit">{t("business.")}</span>
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[var(--feature-muted)]">
            {t(
              "Keep your finances connected, understand your cashflow, and plan your next step with confidence.",
            )}
          </p>
          <div className="bf-flow-visual" aria-hidden="true">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Layers3 size={17} />
                {t("One connected workspace")}
              </span>
              <ArrowUpRight size={17} className="text-inherit" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-inherit">
              {[
                { Icon: Wallet, label: "Cash flow" },
                { Icon: ChartNoAxesCombined, label: "Insights" },
                { Icon: Layers3, label: "Planning" },
              ].map(({ Icon, label }) => (
                <div key={label} className="bf-flow-tile rounded-xl border px-2 py-4">
                  <Icon size={21} strokeWidth={1.5} className="mx-auto mb-2 text-inherit" />
                  {t(label)}
                </div>
              ))}
            </div>
          </div>
          <svg
            className="bf-flow-path mt-6 h-10 w-full text-inherit"
            viewBox="0 0 440 40"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 29H122C150 29 154 11 180 11H260C288 11 294 29 322 29H432"
              stroke="currentColor"
              strokeOpacity=".2"
            />
            <path
              className="bf-flow-trace"
              d="M8 29H122C150 29 154 11 180 11H260C288 11 294 29 322 29H432"
              stroke="currentColor"
              strokeWidth="2"
              pathLength="1"
            />
            <circle cx="8" cy="29" r="3" fill="currentColor" />
            <circle cx="220" cy="11" r="4" fill="currentColor" />
            <circle cx="432" cy="29" r="3" fill="currentColor" />
          </svg>
          <div className="mt-8 flex items-center gap-3 text-xs text-[var(--feature-muted)]">
            <span className="h-px w-8 bg-current/30" />
            {t("Less guesswork. More confidence.")}
          </div>
        </aside>
        <section className="bf-auth-form">{children}</section>
      </div>
    </main>
  );
}
export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useTranslation();

  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm font-semibold">
      {t(label)}
      <input id={id} {...props} className="bf-input mt-2" />
    </label>
  );
}
export function PasswordField({
  label = "Password",
  autoComplete = "current-password",
  value,
  onChange,
}: {
  label?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {t(label)}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={
            autoComplete === "current-password"
              ? "password"
              : label === t("Confirm password")
                ? "confirm_password"
                : "new_password"
          }
          className="bf-input pr-12"
          type={visible ? "text" : "password"}
          required
          maxLength={128}
          autoComplete={autoComplete}
          aria-describedby={autoComplete === "new-password" ? "password-requirements" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={
            visible
              ? t("Hide {0}", { "0": t(label).toLocaleLowerCase() })
              : t("Show {0}", { "0": t(label).toLocaleLowerCase() })
          }
          aria-controls={id}
          aria-pressed={visible}
          className="bf-button-quiet absolute right-1 top-1 flex h-10 w-10 items-center justify-center focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
export function Requirements({ policy }: { policy: PasswordPolicy }) {
  const { t } = useTranslation();

  const names: Record<string, string> = {
    lower: "a lowercase letter",
    upper: "an uppercase letter",
    number: "a number",
    symbol: "a symbol",
  };
  return (
    <p id="password-requirements" className="text-xs leading-relaxed text-muted-foreground">
      {t("Use at least")} {policy.min_length} {t("characters")}
      {policy.required_characters.length
        ? t(", including {0}", {
            "0": policy.required_characters.map((kind) => t(names[kind] || kind)).join(", "),
          })
        : ""}
      {t(". Your account provider also checks password security.")}
    </p>
  );
}
export function BusinessFields({
  value,
  onChange,
}: {
  value: BusinessDetails;
  onChange: (value: BusinessDetails) => void;
}) {
  const { t } = useTranslation();

  const field = (key: keyof BusinessDetails, next: string) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-4">
      <Field
        label={t("Company or business name")}
        name="business_name"
        required
        maxLength={200}
        autoComplete="organization"
        value={value.name}
        onChange={(e) => field("name", e.target.value)}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        {t("Your shop or trading name is welcome. No registration number is required.")}
      </p>
      <Field
        label={t("Business type or industry")}
        name="industry"
        required
        maxLength={120}
        value={value.industry}
        onChange={(e) => field("industry", e.target.value)}
      />
      <Field
        label={t("City or township")}
        name="city"
        required
        maxLength={120}
        autoComplete="address-level2"
        value={value.city}
        onChange={(e) => field("city", e.target.value)}
      />
      <Field
        label={t("Business phone number (optional)")}
        name="phone"
        type="tel"
        maxLength={40}
        autoComplete="tel"
        value={value.phone}
        onChange={(e) => field("phone", e.target.value)}
      />
      <Field
        label={t("Business address (optional)")}
        name="address"
        maxLength={500}
        autoComplete="street-address"
        value={value.address}
        onChange={(e) => field("address", e.target.value)}
      />
      <label className="block text-sm font-semibold">
        {t("Preferred currency")}
        <select
          className="bf-input mt-2"
          name="currency"
          value={value.currency}
          onChange={() => {}}
        >
          <option value="MMK">{t("MMK — Myanmar kyat")}</option>
        </select>
      </label>
    </div>
  );
}
export function FormError({ message }: { message: string }) {
  const { t } = useTranslation();
  return message ? (
    <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
      {t(message)}
    </p>
  ) : null;
}
