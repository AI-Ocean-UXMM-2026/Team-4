"""P1 reporting for the current P5 workbook v1; Decimal arithmetic throughout."""
from datetime import date, timedelta
from decimal import Decimal

from .schemas import Actual, DataQuality, FinancialSnapshot, Obligation, Period, TrendPoint

ZERO = Decimal("0.00")


def amount(row, field):
    value = Decimal(str(row[field]))
    if not value.is_finite():
        raise ValueError("Invalid financial amount")
    return value


def total(rows, field):
    return sum((amount(row, field) for row in rows), ZERO)


def value(row, price):
    return amount(row, "quantity") * amount(row, price)


def calculate_platform_snapshot(ledger, period, obligations_before=None):
    tables = ledger.tables
    for rows in tables.values():
        if any(row["business_id"] != ledger.business_id for row in rows):
            raise PermissionError("Cross-business financial records")
    settings = tables.get("Settings", [])
    missing = sorted(set(("Settings", "Sales", "Purchases", "CustomerReceipts", "SupplierPayments", "Expenses", "Loans", "LoanPayments")) - set(tables))
    if not settings or not ledger.import_batch_id:
        return FinancialSnapshot(
            business_id=ledger.business_id, period=period,
            actual=Actual(**{name: None for name in Actual.model_fields}), upcoming_obligations=[],
            data_quality=DataQuality(status="missing_data", missing_sheets=missing or ["Settings"], warnings=["No successful workbook import is available."]),
            as_of=ledger.as_of, import_batch_id=ledger.import_batch_id, source_version=ledger.source_version,
        )
    if missing:
        raise ValueError("Imported ledger is missing required projections")
    if len(settings) != 1:
        raise ValueError("Expected one opening balance")
    start = settings[0]["opening_date"]
    in_period = lambda row: period.start <= row["date"] <= period.end
    as_at = lambda row: start <= row["date"] <= period.end
    rows_at = lambda name: [row for row in tables[name] if as_at(row)]
    sales, purchases = rows_at("Sales"), rows_at("Purchases")
    expenses = rows_at("Expenses")
    period_sales = [row for row in sales if in_period(row)]
    warnings = [
        "Simplified operational report; taxes and depreciation excluded.",
        "Interest uses cash-paid amounts, not accrued interest.",
        "Workbook v1 has no supplier due dates or loan schedules; obligations have unknown due dates.",
        *ledger.warnings,
    ]
    revenue = sum((value(row, "unit_price_mmk") for row in period_sales), ZERO)
    cogs = ZERO if not period_sales else None
    if cogs is None:
        warnings.append("Historical unit cost at sale is not imported. COGS and profit are unavailable; current product cost is not substituted.")
    opex = total([row for row in expenses if in_period(row)], "amount_mmk")
    interest = total([row for row in rows_at("LoanPayments") if in_period(row)], "interest_mmk")
    # Supplier/customer balances include initial partial settlement plus later events.
    receipts, payments = rows_at("CustomerReceipts"), rows_at("SupplierPayments")
    ar = sum((value(row, "unit_price_mmk") - amount(row, "cash_received_mmk") for row in sales), ZERO) - total(receipts, "amount_mmk")
    ap = sum((value(row, "unit_cost_mmk") - amount(row, "cash_paid_mmk") for row in purchases), ZERO) - total(payments, "amount_mmk")
    if ar < 0 or ap < 0:
        raise ValueError("Payments exceed recorded balances")
    cash = None
    if start <= period.end and not expenses:
        cash = amount(settings[0], "opening_cash_mmk") + total(sales, "cash_received_mmk") + total(receipts, "amount_mmk")
        cash += total(rows_at("Loans"), "principal_mmk")
        cash -= total(purchases, "cash_paid_mmk") + total(payments, "amount_mmk")
        cash -= total(rows_at("LoanPayments"), "principal_mmk") + total(rows_at("LoanPayments"), "interest_mmk")
        for row in tables.get("CashAdjustments", []):
            if as_at(row):
                cash += amount(row, "amount_mmk") * (1 if row["direction"] == "in" else -1)
    elif expenses:
        warnings.append("Expense payment status/date is not imported. Actual cash and unpaid-expense obligations cannot be determined.")
    else:
        warnings.append("Reporting end precedes the opening cash date; historical balances are unavailable.")
    if "CashAdjustments" not in tables:
        cash = None
        warnings.append("Cash adjustments are unavailable; cash balance cannot be established.")
    obligations = []
    for purchase in purchases:
        outstanding = value(purchase, "unit_cost_mmk") - amount(purchase, "cash_paid_mmk") - total(
            [row for row in payments if row["purchase_id"] == purchase["purchase_id"]], "amount_mmk")
        if outstanding > 0:
            obligations.append(Obligation(kind="supplier", reference_id=purchase["purchase_id"], due_date=None, amount_mmk=outstanding))
    if obligations_before:
        warnings.append("Undated supplier balances are included for visibility, but are not classified as due before the cutoff.")
    gross = revenue - cogs if cogs is not None else None
    operating = gross - opex if gross is not None else None
    return FinancialSnapshot(
        business_id=ledger.business_id, period=period,
        actual=Actual(revenue_mmk=revenue, cogs_mmk=cogs, gross_profit_mmk=gross,
            operating_expenses_mmk=opex, operating_profit_mmk=operating, interest_expenses_mmk=interest,
            profit_before_tax_mmk=operating - interest if operating is not None else None,
            cash_balance_mmk=cash, receivables_mmk=ar if start <= period.end else None, payables_mmk=ap if start <= period.end else None),
        upcoming_obligations=obligations, data_quality=DataQuality(status="partial", missing_sheets=[], warnings=warnings),
        as_of=ledger.as_of, import_batch_id=ledger.import_batch_id, source_version=ledger.source_version,
    )


class PlatformFinancialService:
    def __init__(self, repository):
        self.repository = repository

    def ledger(self, business_id):
        ledger = self.repository.load_ledger(business_id)
        if ledger.business_id != business_id:
            raise PermissionError("Cross-business ledger")
        return ledger

    def financial_snapshot(self, business_id, period):
        return calculate_platform_snapshot(self.ledger(business_id), period)

    def obligations(self, business_id, as_at, before):
        if before < as_at:
            raise ValueError("Cutoff precedes as_at")
        return calculate_platform_snapshot(self.ledger(business_id), Period(start=as_at, end=as_at), before)

    def trends(self, business_id, end, months):
        if not 1 <= months <= 24:
            raise ValueError("months must be between 1 and 24")
        ledger = self.ledger(business_id)
        points = []
        for offset in reversed(range(months)):
            index = end.year * 12 + end.month - 1 - offset
            year, month = divmod(index, 12)
            next_year, next_month = divmod(index + 1, 12)
            period = Period(start=date(year, month + 1, 1), end=min(end, date(next_year, next_month + 1, 1) - timedelta(days=1)))
            snapshot = calculate_platform_snapshot(ledger, period)
            points.append(TrendPoint(period=period, revenue_mmk=snapshot.actual.revenue_mmk, operating_expenses_mmk=snapshot.actual.operating_expenses_mmk))
        return {"business_id": business_id, "points": points, "source_version": ledger.source_version, "as_of": ledger.as_of, "import_batch_id": ledger.import_batch_id}
