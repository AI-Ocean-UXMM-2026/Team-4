"""Generic record-preparation checklist. Presence is never verification."""

from datetime import date


CHECKLIST = (
    ("business_profile", "Business profile and registration", None),
    ("sales_history", "Sales history", "Sales"),
    ("expense_history", "Expense history", "Expenses"),
    ("cashflow_history", "Cash-flow history", None),
    ("receivables_payables", "Customer receivables and supplier payables", None),
    ("existing_debt", "Existing debt and repayment records", "Loans"),
    ("lender_documents", "Other lender-requested documents", None),
)


def _period(rows: list[dict]) -> tuple[date | None, date | None]:
    dates = [row["date"] for row in rows if row.get("date")]
    return (min(dates), max(dates)) if dates else (None, None)


def _coverage(rows: list[dict]) -> tuple[int, list[str]]:
    observed = {row["date"].strftime("%Y-%m") for row in rows if row.get("date")}
    if not observed:
        return 0, []
    first, last = min(observed), max(observed)
    start_year, start_month = map(int, first.split("-"))
    end_year, end_month = map(int, last.split("-"))
    span = (end_year - start_year) * 12 + end_month - start_month + 1
    calendar_months = [
        f"{(start_year + (start_month - 1 + offset) // 12):04d}-{((start_month - 1 + offset) % 12 + 1):02d}"
        for offset in range(span)
    ]
    return len(observed), [month for month in calendar_months if month not in observed]


def readiness_categories(inputs: dict) -> list[dict]:
    tables = inputs.get("tables", {})
    business = inputs.get("business")
    categories = []
    for key, title, sheet in CHECKLIST:
        rows = tables.get(sheet, []) if sheet else []
        if key == "business_profile":
            # A profile is useful context, but it does not establish that a
            # registration document has been supplied.
            present, source = False, "none"
        elif key == "cashflow_history":
            rows = tables.get("Sales", []) + tables.get("CustomerReceipts", []) + tables.get("Purchases", []) + tables.get("SupplierPayments", []) + tables.get("Expenses", [])
            present, source = bool(rows), "excel_imported" if rows else "none"
        elif key == "receivables_payables":
            rows = tables.get("Sales", []) + tables.get("Purchases", []) + tables.get("CustomerReceipts", []) + tables.get("SupplierPayments", [])
            present, source = bool(rows), "excel_imported" if rows else "none"
        elif key == "existing_debt":
            present = bool(rows)
            source = "excel_imported" if present else "none"
        else:
            present = bool(rows)
            source = "excel_imported" if present else "none"
        start, end = _period(rows)
        coverage_months, missing_months = _coverage(rows)
        # There is no document metadata/file store in this branch. Imported
        # business records are evidence of records only, never verified docs.
        status = "not_applicable" if key == "existing_debt" and not present else "uploaded_unverified" if present else "missing"
        note = "Imported record presence does not verify a lender document." if present else None
        if key == "business_profile" and business:
            note = "Business profile details are recorded, but no registration document metadata is available."
        categories.append({"category": key, "title": title, "status": status, "source": source,
                           "record_count": len(rows), "period_start": start, "period_end": end,
                           "coverage_months": coverage_months, "months_without_records": missing_months, "note": note})
    return categories
