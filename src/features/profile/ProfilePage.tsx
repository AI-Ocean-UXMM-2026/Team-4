import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, MapPin, Save, UserRound } from "lucide-react";
import { useAuth } from "@/app/session";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { Field, FormError } from "@/features/auth/Fields";
import { businessProblem } from "@/features/auth/validation";
import { api } from "@/lib/apiClient";
import type { BusinessDetails, ProfileUpdate, UserProfile } from "@/lib/contracts";
import { useTranslation } from "@/lib/i18n";

function editableBusiness(business: UserProfile["business"]): BusinessDetails | null {
  return business
    ? {
        name: business.name,
        industry: business.industry,
        city: business.city,
        phone: business.phone,
        address: business.address,
        currency: business.currency,
      }
    : null;
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const profile = useQuery({
    queryKey: ["profile", session?.user.id],
    queryFn: () => api<UserProfile>("/api/v1/auth/profile"),
    enabled: !!session,
    retry: false,
  });

  if (profile.isPending) return <LoadingAnimation label="Loading your profile…" />;
  if (profile.isError)
    return (
      <section className="bf-card mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">{t("Your profile")}</h1>
        <FormError message={profile.error.message || "Unable to load your profile."} />
        <button className="bf-button-secondary" onClick={() => void profile.refetch()}>
          {t("Try again")}
        </button>
      </section>
    );

  return <ProfileEditor key={profile.data.user.id} initial={profile.data} />;
}

function ProfileEditor({ initial }: { initial: UserProfile }) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [savedProfile, setSavedProfile] = useState(initial);
  const [fullName, setFullName] = useState(initial.user.full_name);
  const [business, setBusiness] = useState(() => editableBusiness(initial.business));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty =
    fullName !== savedProfile.user.full_name ||
    JSON.stringify(business) !== JSON.stringify(editableBusiness(savedProfile.business));
  const initials =
    savedProfile.user.full_name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((word) => Array.from(word)[0] || "")
      .join("")
      .toLocaleUpperCase() || "SS";

  function changeBusiness(key: keyof BusinessDetails, value: string) {
    if (business) setBusiness({ ...business, [key]: value });
    setSaved(false);
    setError("");
  }

  function cancel() {
    setFullName(savedProfile.user.full_name);
    setBusiness(editableBusiness(savedProfile.business));
    setError("");
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty) return;
    setError("");
    setSaved(false);
    if (!fullName.trim() || fullName.trim().length > 120) {
      setError("Enter your full name.");
      return;
    }
    if (business) {
      const problem = businessProblem(business);
      if (problem) {
        setError(problem);
        return;
      }
    }
    const body: ProfileUpdate = { full_name: fullName.trim() };
    if (business)
      body.business = {
        name: business.name.trim(),
        industry: business.industry.trim(),
        city: business.city.trim(),
        phone: business.phone.trim(),
        address: business.address.trim(),
        currency: business.currency,
      };
    setBusy(true);
    try {
      const result = await api<UserProfile>("/api/v1/auth/profile", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSavedProfile(result);
      setFullName(result.user.full_name);
      setBusiness(editableBusiness(result.business));
      queries.setQueryData(["profile", result.user.id], result);
      await Promise.all([
        queries.invalidateQueries({ queryKey: ["account", result.user.id] }),
        queries.invalidateQueries({ queryKey: ["businesses"] }),
        queries.invalidateQueries({ queryKey: ["credit-summary", result.business?.id] }),
        queries.invalidateQueries({ queryKey: ["working-capital", result.business?.id] }),
        queries.invalidateQueries({ queryKey: ["ai-analysis", result.business?.id] }),
      ]);
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Your changes have not been saved. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="bf-page-hero">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
          {t("Account")}
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">{t("Your profile")}</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
          {t("Manage your personal details and business information.")}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="bf-card min-w-0 space-y-6">
          <div>
            <div
              aria-hidden="true"
              className="mb-5 grid h-20 w-20 place-items-center rounded-3xl font-display text-2xl font-bold shadow-sm"
              style={{
                backgroundImage: "var(--brand-gradient)",
                color: "var(--feature-foreground)",
              }}
            >
              {initials}
            </div>
            <p className="break-words text-xl font-bold">{savedProfile.user.full_name}</p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary">
              <UserRound size={14} aria-hidden="true" />
              {t(savedProfile.business ? "Business owner" : "Account")}
            </span>
          </div>
          <div className="space-y-4 border-t pt-5 text-sm">
            <p className="flex items-start gap-3 break-all text-muted-foreground">
              <Mail size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              {savedProfile.user.email}
            </p>
            {savedProfile.business ? (
              <>
                <p className="flex items-start gap-3 break-words font-medium">
                  <Building2
                    size={17}
                    className="mt-0.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {savedProfile.business.name}
                </p>
                <p className="flex items-start gap-3 break-words text-muted-foreground">
                  <MapPin size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  {savedProfile.business.city}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                {t("No business is linked to this profile yet.")}
              </p>
            )}
          </div>
        </aside>

        <form noValidate onSubmit={(event) => void save(event)} className="min-w-0">
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <section className="bf-card space-y-5">
              <h2 className="flex items-center gap-2.5 text-lg font-bold">
                <UserRound size={20} className="text-primary" aria-hidden="true" />
                {t("Personal details")}
              </h2>
              <Field
                label="Full name"
                name="full_name"
                autoComplete="name"
                required
                maxLength={120}
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setSaved(false);
                  setError("");
                }}
              />
              <Field
                label="Email address"
                type="email"
                autoComplete="email"
                value={savedProfile.user.email}
                readOnly
                aria-describedby="profile-email-hint"
              />
              <p id="profile-email-hint" className="text-xs text-muted-foreground">
                {t("Used to sign in to your account.")}
              </p>
            </section>

            {business && (
              <section className="bf-card space-y-5">
                <div>
                  <h2 className="flex items-center gap-2.5 text-lg font-bold">
                    <Building2 size={20} className="text-primary" aria-hidden="true" />
                    {t("Business details")}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("Keep your business information up to date.")}
                  </p>
                </div>
                <Field
                  label="Company or business name"
                  name="business_name"
                  autoComplete="organization"
                  required
                  maxLength={200}
                  value={business.name}
                  onChange={(event) => changeBusiness("name", event.target.value)}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Business type or industry"
                    name="industry"
                    required
                    maxLength={120}
                    value={business.industry}
                    onChange={(event) => changeBusiness("industry", event.target.value)}
                  />
                  <Field
                    label="City or township"
                    name="city"
                    autoComplete="address-level2"
                    required
                    maxLength={120}
                    value={business.city}
                    onChange={(event) => changeBusiness("city", event.target.value)}
                  />
                  <Field
                    label="Business phone number (optional)"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={business.phone}
                    onChange={(event) => changeBusiness("phone", event.target.value)}
                  />
                  <label className="block text-sm font-semibold">
                    {t("Preferred currency")}
                    <select
                      name="currency"
                      className="bf-input mt-2"
                      value={business.currency}
                      onChange={() => {}}
                    >
                      <option value="MMK">{t("MMK — Myanmar kyat")}</option>
                    </select>
                  </label>
                </div>
                <Field
                  label="Business address (optional)"
                  name="address"
                  autoComplete="street-address"
                  maxLength={500}
                  value={business.address}
                  onChange={(event) => changeBusiness("address", event.target.value)}
                />
              </section>
            )}

            <FormError message={error} />
            {saved && (
              <p
                role="status"
                className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm font-semibold text-foreground"
              >
                {t("Profile saved.")}
              </p>
            )}
            <div className="bf-glass flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4">
              <p className="text-xs text-muted-foreground">
                {t(dirty ? "You have unsaved changes." : "All changes saved.")}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="bf-button-secondary"
                  disabled={!dirty || busy}
                  onClick={cancel}
                >
                  {t("Cancel changes")}
                </button>
                <button type="submit" className="bf-button" disabled={!dirty || busy}>
                  <Save size={16} aria-hidden="true" />
                  {t(busy ? "Saving profile…" : "Save changes")}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
