"""Business-scoped readers for typed imported projections."""

from datetime import date

from sqlalchemy import select

from ...db.models import Business, PROJECTIONS


def projection_rows(session, sheet: str, business_id: str) -> list[dict]:
    table = PROJECTIONS[sheet]
    return [dict(row) for row in session.execute(select(table).where(table.c.business_id == business_id)).mappings()]


def credit_inputs(session, business_id: str) -> dict:
    business = session.scalar(select(Business).where(Business.id == business_id))
    if business is None:
        return {"business": None, "loans": [], "payments": [], "tables": {}}
    sheets = ("Loans", "LoanPayments", "Sales", "CustomerReceipts", "Purchases", "SupplierPayments", "Expenses")
    tables = {sheet: projection_rows(session, sheet, business_id) for sheet in sheets}
    return {
        "business": {"id": business.id, "name": business.name, "industry": business.industry, "city": business.city},
        "loans": tables["Loans"],
        "payments": tables["LoanPayments"],
        "tables": tables,
        "as_of": date.today(),
    }
