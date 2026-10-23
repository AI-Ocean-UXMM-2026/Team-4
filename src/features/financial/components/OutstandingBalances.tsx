import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  TriangleAlert,
  Truck,
} from "lucide-react";
import type { Money, Obligation } from "../types";
import { formatMmk } from "../types";

type PaymentStatus =
  "Overdue" | "Due within 7 days" | "Due within 30 days" | "Due later" | "Due date unavailable";
type SortBy = "due-date" | "amount" | "amount-asc" | "reference" | "status" | "type";
const PAGE_SIZE = 10;

function addDays(isoDate: string, count: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function statusFor(item: Obligation, asAt: string): PaymentStatus {
  if (!item.due_date) return "Due date unavailable";
  if (item.due_date < asAt) return "Overdue";
  if (item.due_date <= addDays(asAt, 7)) return "Due within 7 days";
  if (item.due_date <= addDays(asAt, 30)) return "Due within 30 days";
  return "Due later";
}

const decimalParts = (value: string | number | null | undefined) => {
  if (value == null || !/^-?\d+(\.\d+)?$/.test(String(value))) return null;
  const text = String(value);
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? text.slice(1) : text).split(".");
  return { negative, whole, fraction };
};

function scaledInteger(value: string | number, scale: number) {
  const parts = decimalParts(value);
  if (!parts) return null;
  const integer = BigInt(parts.whole + parts.fraction.padEnd(scale, "0"));
  return parts.negative ? -integer : integer;
}

function sumMmk(values: (string | number | null | undefined)[]) {
  const parts = values.map(decimalParts);
  if (parts.some((part) => part === null)) return null;
  const scale = Math.max(0, ...parts.map((part) => part!.fraction.length));
  const total = values.reduce((sum, value) => sum + (scaledInteger(value!, scale) ?? 0n), 0n);
  const negative = total < 0n;
  const digits = (negative ? -total : total).toString().padStart(scale + 1, "0");
  const formatted = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return `${negative ? "-" : ""}${formatted}`;
}

function subtractMmk(left: string | number, right: string | number) {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  if (!leftParts || !rightParts) return null;
  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const difference = scaledInteger(left, scale)! - scaledInteger(right, scale)!;
  const negative = difference < 0n;
  const digits = (negative ? -difference : difference).toString().padStart(scale + 1, "0");
  const formatted = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return `${negative ? "-" : ""}${formatted}`;
}

function compareMmk(left: string | number, right: string | number) {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  if (!leftParts || !rightParts) return 0;
  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const a = scaledInteger(left, scale)!;
  const b = scaledInteger(right, scale)!;
  return a < b ? -1 : a > b ? 1 : 0;
}

function statusClass(status: PaymentStatus) {
  if (status === "Overdue") return "bg-rose-50 text-rose-800 ring-rose-200";
  if (status === "Due within 7 days") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "Due within 30 days") return "bg-orange-50 text-orange-800 ring-orange-200";
  if (status === "Due later") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return "bg-muted text-muted-foreground ring-border";
}

export function OutstandingBalances({
  obligations,
  asAt,
  cashAvailable,
  onSaveDueDate,
}: {
  obligations: Obligation[];
  asAt: string;
  cashAvailable?: Money;
  onSaveDueDate?: ((purchaseId: string, dueDate: string, expectedDueDate: string | null) => Promise<void>) | undefined;
}) {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [minimumAmount, setMinimumAmount] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("due-date");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Obligation | null>(null);
  const [editedDate, setEditedDate] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState("");
  const dateInput = useRef<HTMLInputElement>(null);

  useEffect(() => setPage(1), [obligations, asAt]);
  useEffect(() => { if (editing) dateInput.current?.focus(); }, [editing]);

  const classified = useMemo(
    () => obligations.filter((item) => item.kind === "supplier").map((item) => ({ item, status: statusFor(item, asAt) })),
    [obligations, asAt],
  );
  const suppliersTotal = sumMmk(classified.map(({ item }) => item.amount_mmk));
  const overdueTotal = sumMmk(
    classified.filter(({ status }) => status === "Overdue").map(({ item }) => item.amount_mmk),
  );
  const due7Total = sumMmk(
    classified
      .filter(({ status }) => status === "Due within 7 days")
      .map(({ item }) => item.amount_mmk),
  );
  const due30Total = sumMmk(
    classified
      .filter(({ status }) => status === "Due within 7 days" || status === "Due within 30 days")
      .map(({ item }) => item.amount_mmk),
  );

  const financialDataAvailable =
    suppliersTotal !== null &&
    overdueTotal !== null &&
    due7Total !== null &&
    due30Total !== null;
  const minAmount = minimumAmount.trim() === "" ? null : minimumAmount.trim();
  const query = search.trim().toLocaleLowerCase();

  const supplierPayments = classified;
  const rows = supplierPayments
    .filter(
      ({ item }) =>
        query === "" ||
        item.reference_id.toLocaleLowerCase().includes(query) ||
        item.name?.toLocaleLowerCase().includes(query),
    )
    .filter(({ item, status }) => typeFilter === "all" || item.kind === typeFilter)
    .filter(({ status }) => statusFilter === "all" || status === statusFilter)
    .filter(
      ({ item }) =>
        dueDateFilter === "all" ||
        (dueDateFilter === "available" ? item.due_date !== null : item.due_date === null),
    )
    .filter(({ item }) => minAmount === null || compareMmk(item.amount_mmk, minAmount) >= 0)
    .sort((left, right) => {
      let result = 0;
      if (sortBy === "amount") result = compareMmk(right.item.amount_mmk, left.item.amount_mmk);
      else if (sortBy === "amount-asc")
        result = compareMmk(left.item.amount_mmk, right.item.amount_mmk);
      else if (sortBy === "reference")
        result = left.item.reference_id.localeCompare(right.item.reference_id);
      else if (sortBy === "status") result = left.status.localeCompare(right.status);
      else if (sortBy === "type") result = left.item.kind.localeCompare(right.item.kind);
      else
        result = (left.item.due_date ?? "9999-12-31").localeCompare(
          right.item.due_date ?? "9999-12-31",
        );
      return result || left.item.reference_id.localeCompare(right.item.reference_id);
    });
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const summary = [
    {
      label: "Outstanding supplier payments",
      value: financialDataAvailable ? formatMmk(suppliersTotal) : t("Unavailable"),
      tone: "text-foreground",
      icon: Truck,
      iconTone: "bg-secondary text-primary ring-border",
      note: "Supplier bills detailed in the table below",
    },
    {
      label: "Overdue",
      value: financialDataAvailable ? formatMmk(overdueTotal) : t("Unavailable"),
      tone:
        overdueTotal !== null && compareMmk(overdueTotal, 0) > 0
          ? "text-rose-700"
          : "text-foreground",
      icon: TriangleAlert,
      iconTone:
        overdueTotal !== null && compareMmk(overdueTotal, 0) > 0
          ? "bg-rose-50 text-rose-700 ring-rose-100"
          : "bg-secondary text-primary ring-border",
      note: "Supplier payments past their due dates",
    },
    {
      label: "Due within 7 days",
      value: financialDataAvailable ? formatMmk(due7Total) : t("Unavailable"),
      tone: "text-foreground",
      icon: CalendarClock,
      iconTone: "bg-amber-50 text-amber-700 ring-amber-100",
      note: "Also included in the 30-day amount",
    },
    {
      label: "Due within 30 days",
      value: financialDataAvailable ? formatMmk(due30Total) : t("Unavailable"),
      tone: "text-foreground",
      icon: CalendarDays,
      iconTone: "bg-orange-50 text-orange-700 ring-orange-100",
      note: "Includes payments due within 7 days",
    },
  ];

  return (
    <section
      className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_4px_18px_rgba(15,23,42,.035)] sm:p-5"
      aria-label={t("Outstanding supplier payments section")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
            {t("Business obligations")}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {t("Outstanding Supplier Payments")}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <a className="bf-button-secondary" href="/data-source">{t("Update via Excel")}</a>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary ring-1 ring-border">
            <CircleDollarSign size={18} aria-hidden="true" />
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        {t("Recorded balances through")} {asAt}.{" "}
        {t("Due dates and statuses use this reporting end date.")}
      </p>
      {editSuccess && <p role="status" className="mt-3 text-sm text-primary">{t(editSuccess)}</p>}

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="bf-metric-card min-w-0">
            <dt className="min-w-0 pr-12 text-sm font-medium text-muted-foreground">
              {t(item.label)}
            </dt>
            <span
              className={`absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-xl ring-1 ${item.iconTone}`}
            >
              <item.icon size={17} aria-hidden="true" />
            </span>
            <dd className="mt-4 min-w-0">
              <span
                className={`block break-words text-2xl font-semibold leading-tight tracking-tight tabular-nums ${item.tone}`}
              >
                {item.value}
              </span>
              <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
                {t(item.note)}
              </span>
            </dd>
          </div>
        ))}
      </dl>


      {supplierPayments.length === 0 ? (
        <div className="mt-5 rounded-xl bg-muted px-4 py-7 text-center">
          <CalendarClock size={22} className="mx-auto text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {t("No supplier payments in available records")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("This list reflects imported records and may be incomplete.")}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <label className="min-w-0 flex-[1_1_15rem] text-xs font-medium text-muted-foreground">
              {t("Search payments")}
              <input
                aria-label={t("Search payments")}
                className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm text-foreground"
                type="search"
                placeholder={t("Reference or name")}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="min-w-0 flex-[1_1_11rem] text-xs font-medium text-muted-foreground">
              {t("Type")}
              <select
                aria-label={t("Filter by type")}
                className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm text-foreground"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t("All types")}</option>
                <option value="supplier">{t("Supplier")}</option>
              </select>
            </label>
            <label className="min-w-0 flex-[1_1_11rem] text-xs font-medium text-muted-foreground">
              {t("Payment status")}
              <select
                aria-label={t("Filter by status")}
                className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm text-foreground"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t("All statuses")}</option>
                {(
                  [
                    "Overdue",
                    "Due within 7 days",
                    "Due within 30 days",
                    "Due later",
                    "Due date unavailable",
                  ] as PaymentStatus[]
                ).map((status) => (
                  <option key={status} value={status}>
                    {t(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-[1_1_11rem] text-xs font-medium text-muted-foreground">
              {t("Due date")}
              <select
                aria-label={t("Filter by due date")}
                className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm text-foreground"
                value={dueDateFilter}
                onChange={(event) => {
                  setDueDateFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t("All due dates")}</option>
                <option value="available">{t("Date recorded")}</option>
                <option value="unavailable">{t("Date unavailable")}</option>
              </select>
            </label>
            <label className="min-w-0 flex-[1_1_11rem] text-xs font-medium text-muted-foreground">
              {t("Minimum balance (MMK)")}
              <input
                aria-label={t("Minimum outstanding amount")}
                className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm text-foreground"
                type="number"
                min="0"
                value={minimumAmount}
                onChange={(event) => {
                  setMinimumAmount(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="min-w-0 flex-[1_1_11rem] text-xs font-medium text-muted-foreground">
              {t("Sort by")}
              <select
                aria-label={t("Sort payments")}
                className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm text-foreground"
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as SortBy);
                  setPage(1);
                }}
              >
                <option value="due-date">{t("Nearest known due date")}</option>
                <option value="amount">{t("Highest remaining balance")}</option>
                <option value="amount-asc">{t("Smallest remaining balance")}</option>
                <option value="reference">{t("Reference")}</option>
                <option value="status">{t("Payment status")}</option>
                <option value="type">{t("Type")}</option>
              </select>
            </label>
          </div>
          <div
            className="mt-3 max-w-full overflow-x-auto rounded-xl border border-border"
            role="region"
            aria-label={t("Scrollable outstanding payments table")}
            tabIndex={0}
          >
            <table className="w-full min-w-[850px] text-left text-xs sm:text-sm">
              <caption className="sr-only">
                {t("Outstanding business obligations and payment statuses as of")} {asAt}
              </caption>
              <thead className="bg-muted text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                <tr>
                  {[
                    "Type",
                    "Reference / name",
                    "Original amount",
                    "Amount paid",
                    "Remaining balance",
                    "Due date",
                    "Payment status",
                    ...(onSaveDueDate ? ["Actions"] : []),
                  ].map((label, index) => (
                    <th
                      key={label}
                      scope="col"
                      className={`px-3 py-2.5 ${index >= 2 && index <= 4 ? "text-right" : ""}`}
                    >
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ item, status }) => (
                  <tr
                    key={`${item.kind}-${item.reference_id}`}
                    className="border-t border-border align-top"
                  >
                    <td className="px-3 py-3 font-medium text-muted-foreground">
                      {t("Supplier")}
                    </td>
                    <td className="max-w-48 break-words px-3 py-3 text-foreground">
                      <span className="font-medium">{item.name || item.reference_id}</span>
                      {item.name && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.reference_id}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {item.original_amount_mmk == null
                        ? t("Unavailable")
                        : formatMmk(item.original_amount_mmk)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {item.amount_paid_mmk == null
                        ? t("Unavailable")
                        : formatMmk(item.amount_paid_mmk)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                      {formatMmk(item.amount_mmk)}
                    </td>
                    <td
                      aria-label={item.due_date ? undefined : t("Due date unavailable")}
                      className="whitespace-nowrap px-3 py-3 text-muted-foreground"
                    >
                      {item.due_date ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass(status)}`}
                      >
                        {t(status)}
                      </span>
                    </td>
                    {onSaveDueDate && (
                      <td className="whitespace-nowrap px-3 py-3">
                        <button type="button" className="font-semibold text-primary underline underline-offset-2"
                          onClick={() => {
                            setEditing(item);
                            setEditedDate(item.due_date ?? "");
                            setEditError("");
                            setEditSuccess("");
                          }}>
                          {t(item.due_date ? "Edit due date" : "Add due date")}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={onSaveDueDate ? 8 : 7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {t("No payments match these filters.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {editing && onSaveDueDate && (
            <div role="dialog" aria-modal="true" aria-label={t("Edit supplier due date")}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !saving) setEditing(null);
                if (event.key !== "Tab") return;
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled)"));
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
              }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <form className="bf-card w-full max-w-md space-y-4" onSubmit={async (event) => {
                event.preventDefault();
                if (!/^\d{4}-\d{2}-\d{2}$/.test(editedDate) || Number.isNaN(Date.parse(`${editedDate}T00:00:00Z`))) {
                  setEditError("Enter a valid due date.");
                  return;
                }
                setSaving(true);
                setEditError("");
                try {
                  await onSaveDueDate(editing.reference_id, editedDate, editing.due_date);
                  setEditing(null);
                  setEditSuccess("Supplier due date saved.");
                } catch (error) {
                  setEditError(error instanceof Error ? error.message : "Could not save the due date.");
                } finally {
                  setSaving(false);
                }
              }}>
                <h3 className="text-lg font-semibold">{t("Edit supplier due date")}</h3>
                <p className="text-sm text-muted-foreground">{t("Purchase reference")}: {editing.reference_id}</p>
                <p className="text-sm text-muted-foreground">{t("Remaining balance")}: {formatMmk(editing.amount_mmk)}</p>
                <p className="text-sm text-muted-foreground">{t("Current due date")}: {editing.due_date ?? t("Due date unavailable")}</p>
                <label className="block text-sm font-medium">{t("Due date")}
                  <input ref={dateInput} type="date" required value={editedDate} onChange={(event) => setEditedDate(event.target.value)}
                    className="mt-1 block w-full rounded-lg border bg-background p-2 text-foreground" />
                </label>
                {editError && <p role="alert" className="text-sm text-destructive">{t(editError)}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="bf-button-secondary" disabled={saving} onClick={() => setEditing(null)}>{t("Cancel")}</button>
                  <button type="submit" className="bf-button" disabled={saving}>{t(saving ? "Saving…" : "Save")}</button>
                </div>
              </form>
            </div>
          )}
          {rows.length > 0 && (
            <nav
              className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
              aria-label={t("Outstanding payments pages")}
            >
              <p aria-live="polite">
                {t("Showing {0}–{1} of {2} payments", {
                  "0": (currentPage - 1) * PAGE_SIZE + 1,
                  "1": Math.min(currentPage * PAGE_SIZE, rows.length),
                  "2": rows.length,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border bg-background px-3 py-2 font-medium text-foreground disabled:opacity-50"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {t("Previous")}
                </button>
                <span>{t("Page {0} of {1}", { "0": currentPage, "1": pageCount })}</span>
                <button
                  type="button"
                  className="rounded-lg border bg-background px-3 py-2 font-medium text-foreground disabled:opacity-50"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t("Next")}
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
