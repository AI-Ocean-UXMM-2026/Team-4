/** Decorative light layers; never intercept clicks or enter the accessibility tree. */
export function AuroraBackdrop() {
  return (
    <div className="bf-aurora" aria-hidden="true">
      <div className="bf-aurora-liquid" />
      <div className="bf-aurora-ribbon bf-aurora-violet" />
      <div className="bf-aurora-ribbon bf-aurora-blue" />
    </div>
  );
}
