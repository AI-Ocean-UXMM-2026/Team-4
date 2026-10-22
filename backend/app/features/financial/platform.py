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
            synthetic=ledger.synthetic,
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
        "Supplier due dates are optional in the workbook. Loan principal is not shown as due unless an installment schedule is recorded.",
        *ledger.warnings,
    ]
    revenue = sum((value(row, "unit_price_mmk") for row in period_sales), ZERO)
    cogs = ZERO
    cogs_complete = True
    for row in period_sales:
        supplied = row.get("cogs_mmk")
        unit_cost = row.get("unit_cost_at_sale_mmk")
        if supplied is None and unit_cost is None:
            cogs_complete = False
            break
        row_cogs = amount(row, "cogs_mmk") if supplied is not None else amount(row, "quantity") * amount(row, "unit_cost_at_sale_mmk")
        if supplied is not None and unit_cost is not None and row_cogs != amount(row, "quantity") * amount(row, "unit_cost_at_sale_mmk"):
            raise ValueError("Supplied COGS does not match historical unit cost")
        cogs += row_cogs
    if not cogs_complete:
        cogs = None
        warnings.append("Historical cost is missing for one or more sales in this period. COGS and operating profit are unavailable; current product cost is not substituted.")
    else:
        warnings.append("COGS uses supplied historical row totals, or quantity × historical unit cost when row totals are absent; it is counted once per sale.")
    opex = total([row for row in expenses if in_period(row)], "amount_mmk")
    interest = total([row for row in rows_at("LoanPayments") if in_period(row)], "interest_mmk")
    # Supplier/customer balances include initial partial settlement plus later events.
    receipts, payments = rows_at("CustomerReceipts"), rows_at("SupplierPayments")
    ar = sum((value(row, "unit_price_mmk") - amount(row, "cash_received_mmk") for row in sales), ZERO) - total(receipts, "amount_mmk")
    ap = sum((value(row, "unit_cost_mmk") - amount(row, "cash_paid_mmk") for row in purchases), ZERO) - total(payments, "amount_mmk")
    if ar < 0 or ap < 0:
        raise ValueError("Payments exceed recorded balances")
    cash = None
    if start <= period.end:
        cash = amount(settings[0], "opening_cash_mmk") + total(sales, "cash_received_mmk") + total(receipts, "amount_mmk")
        cash += total(rows_at("Loans"), "principal_mmk")
        cash -= total(purchases, "cash_paid_mmk") + total(payments, "amount_mmk")
        cash -= total(rows_at("LoanPayments"), "principal_mmk") + total(rows_at("LoanPayments"), "interest_mmk")
        for row in tables.get("CashAdjustments", []):
            if as_at(row):
                cash += amount(row, "amount_mmk") * (1 if row["direction"] == "in" else -1)
        # Completeness is evaluated only through the report's as-of date. A future
        # expense cannot make an earlier cash balance unknowable.
        all_expenses = [
            row
            for row in tables["Expenses"]
            if row["date"] <= period.end
            or (
                row.get("paid_date") is not None
                and start <= row["paid_date"] <= period.end
            )
        ]
        cash_expenses = [
            row
            for row in all_expenses
            if row.get("amount_paid_mmk") is None
            or (amount(row, "amount_paid_mmk") > 0 and row.get("paid_date") is None)
        ]
        if cash_expenses:
            cash = None
            warnings.append("Expense cash movements are incomplete: import payment status, paid date, and amount paid for every expense to calculate cash available.")
        else:
            cash -= sum(
                (
                    amount(row, "amount_paid_mmk")
                    for row in all_expenses
                    if row.get("paid_date") is not None
                    and start <= row["paid_date"] <= period.end
                ),
                ZERO,
            )
            warnings.append(f"Cash balance uses opening cash plus recorded cash inflows, less recorded payments through {period.end.isoformat()}, including expenses by paid date.")
    else:
        warnings.append("Reporting end precedes the opening cash date; historical balances are unavailable.")
    if "CashAdjustments" not in tables:
        cash = None
        warnings.append("Cash adjustments are unavailable; cash balance cannot be established.")
    obligations = []
    for purchase in purchases:
        original = value(purchase, "unit_cost_mmk")
        paid = amount(purchase, "cash_paid_mmk") + total(
            [row for row in payments if row["purchase_id"] == purchase["purchase_id"]], "amount_mmk")
        outstanding = original - paid
        if outstanding > 0:
            obligations.append(Obligation(
                kind="supplier",
                reference_id=purchase["purchase_id"],
                due_date=purchase.get("due_date"),
                amount_mmk=outstanding,
                original_amount_mmk=original,
                amount_paid_mmk=paid,
            ))
    loan_principal = sum(
        (amount(row, "principal_mmk") for row in tables["Loans"] if start <= row["date"] <= period.end), ZERO
    ) - sum(
        (amount(row, "principal_mmk") for row in tables["LoanPayments"] if start <= row["date"] <= period.end), ZERO
    )
    if loan_principal < 0:
        raise ValueError("Principal payments exceed recorded loans")
    if any(item.due_date is None for item in obligations):
        warnings.append("Some supplier balances have no recorded due date and are excluded from dated payment categories.")
    if obligations_before:
        warnings.append("Only obligations with recorded due dates are classified against the requested cutoff.")
    gross = revenue - cogs if cogs is not None else None
    operating = gross - opex if gross is not None and opex is not None else None
    return FinancialSnapshot(
        business_id=ledger.business_id, period=period,
        actual=Actual(revenue_mmk=revenue, cogs_mmk=cogs, gross_profit_mmk=gross,
            operating_expenses_mmk=opex, operating_profit_mmk=operating, interest_expenses_mmk=interest,
            profit_before_tax_mmk=operating - interest if operating is not None else None,
            cash_balance_mmk=cash, receivables_mmk=ar if start <= period.end else None, payables_mmk=ap if start <= period.end else None),
        upcoming_obligations=obligations, data_quality=DataQuality(status="partial", missing_sheets=[], warnings=warnings),
        as_of=ledger.as_of, import_batch_id=ledger.import_batch_id, source_version=ledger.source_version,
        synthetic=ledger.synthetic,
        loan_principal_outstanding_mmk=loan_principal,
        loan_schedule_available=False,
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

    def trends(self, business_id, end, months=3, *, start=None, granularity=None):
        if start is not None:
            if start > end or granularity not in ("weekly", "monthly"):
                raise ValueError("Invalid trend period")
            return self._range_trends(business_id, start, end, granularity)
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
            settings = ledger.tables.get("Settings", [])
            if not settings or not ledger.import_batch_id:
                revenue_count = expense_count = None
            else:
                opening_date = settings[0]["opening_date"]
                in_period = lambda row: opening_date <= row["date"] and period.start <= row["date"] <= period.end
                revenue_count = sum(1 for row in ledger.tables.get("Sales", []) if in_period(row))
                expense_count = sum(1 for row in ledger.tables.get("Expenses", []) if in_period(row))
            points.append(TrendPoint(
                period=period,
                revenue_mmk=snapshot.actual.revenue_mmk,
                operating_expenses_mmk=snapshot.actual.operating_expenses_mmk,
                revenue_record_count=revenue_count,
                operating_expense_record_count=expense_count,
                is_partial=period.start.day != 1 or period.end.day != (date(period.end.year + (period.end.month == 12), period.end.month % 12 + 1, 1) - timedelta(days=1)).day,
            ))
        return {"business_id": business_id, "points": points, "granularity": "monthly", "source_version": ledger.source_version, "as_of": ledger.as_of, "import_batch_id": ledger.import_batch_id, "synthetic": ledger.synthetic}

    def _range_trends(self, business_id, start, end, granularity):
        ledger = self.ledger(business_id)
        points = []
        cursor = start
        while cursor <= end:
            if granularity == "weekly":
                bucket_end = min(end, cursor + timedelta(days=6))
                partial = (bucket_end - cursor).days < 6
            else:
                next_month = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
                bucket_end = min(end, next_month - timedelta(days=1))
                partial = cursor.day != 1 or bucket_end.day != (next_month - timedelta(days=1)).day
            period = Period(start=cursor, end=bucket_end)
            snapshot = calculate_platform_snapshot(ledger, period)
            settings = ledger.tables.get("Settings", [])
            if not settings or not ledger.import_batch_id:
                revenue_count = expense_count = None
            else:
                opening_date = settings[0]["opening_date"]
                revenue_count = sum(1 for row in ledger.tables.get("Sales", []) if opening_date <= row["date"] and cursor <= row["date"] <= bucket_end)
                expense_count = sum(1 for row in ledger.tables.get("Expenses", []) if opening_date <= row["date"] and cursor <= row["date"] <= bucket_end)
            points.append(TrendPoint(
                period=period,
                revenue_mmk=snapshot.actual.revenue_mmk,
                operating_expenses_mmk=snapshot.actual.operating_expenses_mmk,
                revenue_record_count=revenue_count,
                operating_expense_record_count=expense_count,
                is_partial=partial,
            ))
            cursor = bucket_end + timedelta(days=1)
        return {"business_id": business_id, "points": points, "granularity": granularity, "source_version": ledger.source_version, "as_of": ledger.as_of, "import_batch_id": ledger.import_batch_id, "synthetic": ledger.synthetic}
