import { usePlatform } from "@/app/providers";
export function TopBar() {
  const { business, businesses, setBusinessId, signOut } = usePlatform();
  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
      <a href="/" className="flex items-center gap-2 font-display text-xl font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          B
        </span>
        BizFlow
      </a>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Active business
          <select
            aria-label="Active business"
            value={business.id}
            onChange={(e) => setBusinessId(e.target.value)}
            className="ml-3 rounded-lg border bg-background px-3 py-2 text-sm font-medium normal-case tracking-normal text-foreground"
          >
            {businesses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="text-sm text-muted-foreground hover:text-primary" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
