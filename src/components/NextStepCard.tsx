import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "@/lib/i18n";

type Destination = "/" | "/working-capital" | "/credit" | "/ai";

export function NextStepCard({
  heading,
  description,
  action,
  to,
  secondary,
}: {
  heading?: string;
  description: string;
  action: string;
  to: Destination;
  secondary?: { label: string; to: Destination };
}) {
  const { t } = useTranslation();
  const headingId = useId();

  return (
    <section
      className="bf-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : t(action)}
    >
      <div className="min-w-0">
        {heading && (
          <h2 id={headingId} className="text-lg font-semibold">
            {t(heading)}
          </h2>
        )}
        <p className={`${heading ? "mt-1 " : ""}text-sm text-muted-foreground`}>{t(description)}</p>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-3 lg:shrink-0">
        <Link
          to={to}
          className="bf-button inline-flex max-w-full items-center justify-center gap-2 text-center"
        >
          {t(action)} <ArrowRight aria-hidden="true" size={16} />
        </Link>
        {secondary && (
          <Link
            to={secondary.to}
            className="bf-button-secondary inline-flex max-w-full items-center justify-center gap-2 text-center"
          >
            {t(secondary.label)} <ArrowRight aria-hidden="true" size={16} />
          </Link>
        )}
      </div>
    </section>
  );
}
