import { useTranslation } from "@/lib/i18n";
import { useEffect, useId, useState } from "react";

export function LoadingAnimation({
  label = "Loading Shay Sett…",
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  const { t } = useTranslation();
  const gradientId = useId();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible)
    return (
      <span role="status" className="sr-only">
        {t(label)}
      </span>
    );
  return (
    <div
      role="status"
      data-loading-screen={fullScreen ? "" : undefined}
      className={
        fullScreen
          ? "bf-loading-screen fixed inset-0 z-[100] grid place-items-center bg-background px-6"
          : "grid min-h-64 place-items-center px-6 py-10"
      }
    >
      <div className="flex flex-col items-center gap-6">
        <svg
          viewBox="0 0 100 100"
          className="h-24 w-24 text-violet-600 dark:text-violet-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0" stopColor="#c4b5fd" />
              <stop offset="0.45" stopColor="#a78bfa" />
              <stop offset="1" stopColor="currentColor" />
            </linearGradient>
          </defs>
          <g fill={`url(#${gradientId})`} stroke="none">
            <rect
              className="bf-loading-bar bf-loading-bar-one"
              x="17"
              y="56"
              width="17"
              height="27"
              rx="3"
            />
            <rect
              className="bf-loading-bar bf-loading-bar-two"
              x="42"
              y="36"
              width="17"
              height="47"
              rx="3"
            />
            <rect
              className="bf-loading-bar bf-loading-bar-three"
              x="67"
              y="16"
              width="17"
              height="67"
              rx="3"
            />
          </g>
        </svg>
        <p className="max-w-sm text-center text-sm leading-7 text-muted-foreground">{t(label)}</p>
      </div>
    </div>
  );
}
