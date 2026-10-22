"""Business-scoped readers for typed imported projections."""

from datetime import date

from sqlalchemy import select

from ...db.models import Business, ImportedRow, PROJECTIONS


def projection_rows(session, sheet: str, business_id: str) -> list[dict]:
    table = PROJECTIONS[sheet]
    return [dict(row) for row in session.execute(select(table).where(table.c.business_id == business_id)).mappings()]


def credit_inputs(session, business_id: str) -> dict:
    business = session.scalar(select(Business).where(Business.id == business_id))
    if business is None:
        return {"business": None, "source_version": None, "loans": [], "payments": [], "tables": {}}
    sheets = ("Loans", "LoanPayments", "Sales", "CustomerReceipts", "Purchases", "SupplierPayments", "Expenses")
    tables = {sheet: projection_rows(session, sheet, business_id) for sheet in sheets}
    # Additional contract terms live in the versioned imported payload, keeping
    # existing projection tables compatible with older workbooks/databases.
    loan_terms = {row.row_id: row.payload for row in session.scalars(
        select(ImportedRow).where(ImportedRow.business_id == business_id, ImportedRow.sheet_name == "Loans")
    )}
    for loan in tables["Loans"]:
        payload = loan_terms.get(loan["loan_id"], {})
        for key in ("bank_id", "loan_product_id", "loan_product", "annual_rate_pct", "term_months", "first_payment_date", "payment_frequency"):
            loan[key] = payload.get(key)
    return {
        "business": {"id": business.id, "name": business.name, "industry": business.industry, "city": business.city},
        "source_version": business.version,
        "loans": tables["Loans"],
        "payments": tables["LoanPayments"],
        "tables": tables,
        "as_of": date.today(),
    }
