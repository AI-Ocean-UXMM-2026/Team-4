import { useTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { LogoMark } from "./layout/LogoMark";

export function LoadingAnimation({
  label = "Loading Shay Sett…",
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  const { t } = useTranslation();
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
        <LogoMark className="bf-loading-logo h-24 w-24 rounded-[20px]" />
        <p className="max-w-sm text-center text-sm leading-7 text-muted-foreground">{t(label)}</p>
      </div>
    </div>
  );
}
