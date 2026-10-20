import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { BusinessDetails } from "@/lib/contracts";
import type { PasswordPolicy } from "./validation";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-10">
      <a
        href="/sign-in"
        className="mx-auto flex max-w-6xl items-center gap-3 text-lg font-bold tracking-wide"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-display text-2xl text-primary-foreground">
          B
        </span>
        BIZFLOW
      </a>
      <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-14 py-10 lg:grid-cols-2">
        <aside className="hidden space-y-7 lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Built around your business
          </p>
          <h2 className="max-w-md font-display text-5xl font-bold leading-tight">
            A clearer view.
            <br />A stronger business.
          </h2>
          <p className="max-w-sm leading-relaxed text-muted-foreground">
            Keep your finances connected, understand your cashflow, and plan your next step with
            confidence.
          </p>
          <div className="flex items-center gap-3 text-sm text-primary">
            <span className="h-px w-10 bg-primary/40" />
            Your workspace. Your business.
          </div>
        </aside>
        <section className="bf-card mx-auto w-full max-w-lg p-7 sm:p-9">{children}</section>
      </div>
    </main>
  );
}
export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm font-semibold">
      {label}
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
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={
            autoComplete === "current-password"
              ? "password"
              : label === "Confirm password"
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
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-controls={id}
          aria-pressed={visible}
          className="absolute right-3 top-2.5 rounded p-0.5 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
export function Requirements({ policy }: { policy: PasswordPolicy }) {
  const names: Record<string, string> = {
    lower: "a lowercase letter",
    upper: "an uppercase letter",
    number: "a number",
    symbol: "a symbol",
  };
  return (
    <p id="password-requirements" className="text-xs leading-relaxed text-muted-foreground">
      Use at least {policy.min_length} characters
      {policy.required_characters.length
        ? `, including ${policy.required_characters.map((kind) => names[kind]).join(", ")}`
        : ""}
      . Your account provider also checks password security.
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
  const field = (key: keyof BusinessDetails, next: string) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-4">
      <Field
        label="Company or business name"
        name="business_name"
        required
        maxLength={200}
        autoComplete="organization"
        value={value.name}
        onChange={(e) => field("name", e.target.value)}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        Your shop or trading name is welcome. No registration number is required.
      </p>
      <Field
        label="Business type or industry"
        name="industry"
        required
        maxLength={120}
        value={value.industry}
        onChange={(e) => field("industry", e.target.value)}
      />
      <Field
        label="City or township"
        name="city"
        required
        maxLength={120}
        autoComplete="address-level2"
        value={value.city}
        onChange={(e) => field("city", e.target.value)}
      />
      <Field
        label="Business phone number (optional)"
        name="phone"
        type="tel"
        maxLength={40}
        autoComplete="tel"
        value={value.phone}
        onChange={(e) => field("phone", e.target.value)}
      />
      <Field
        label="Business address (optional)"
        name="address"
        maxLength={500}
        autoComplete="street-address"
        value={value.address}
        onChange={(e) => field("address", e.target.value)}
      />
      <label className="block text-sm font-semibold">
        Preferred currency
        <select
          className="bf-input mt-2"
          name="currency"
          value={value.currency}
          onChange={() => {}}
        >
          <option value="MMK">MMK — Myanmar kyat</option>
        </select>
      </label>
    </div>
  );
}
export function FormError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
