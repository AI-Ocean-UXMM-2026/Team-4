/** Shared Forward Steps mark; its parent supplies the accessible brand/action name. */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img
      src="/shay-sett-mark.svg"
      width={144}
      height={144}
      className={`shrink-0 ${className}`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
