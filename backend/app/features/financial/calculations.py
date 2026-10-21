"""Deterministic accounting. Inputs are a validated, revision-resolved snapshot."""
from datetime import date

from .schemas import Actual, DataQuality, FinancialRecords, FinancialSnapshot, Obligation, Period

REQUIRED = {"Settings", "Sales", "CustomerReceipts", "Purchases", "SupplierPayments", "Expenses", "Loans", "LoanPayments"}


def validate_records(r: FinancialRecords) -> None:
    for rows, key in ((r.sales, "sale_id"), (r.customer_receipts, "receipt_id"),
                      (r.purchases, "purchase_id"), (r.supplier_payments, "payment_id"),
                      (r.expenses, "expense_id"), (r.loans, "loan_id"),
                      (r.loan_payments, "payment_id"), (r.cash_adjustments, "adjustment_id")):
        ids = [getattr(row, key) for row in rows]
        if any(not value.strip() for value in ids) or len(ids) != len(set(ids)):
            raise ValueError(f"Missing or duplicate {key}")
    for source, payments, source_key, payment_key, amount in (
        (r.sales, r.customer_receipts, "sale_id", "sale_id", lambda x: x.qty * x.unit_selling_price_mmk),
        (r.purchases, r.supplier_payments, "purchase_id", "purchase_id", lambda x: x.qty * x.unit_cost_mmk),
    ):
        lookup = {getattr(x, source_key): x for x in source}
        for row in source:
            if row.payment_type == "credit" and (row.due_date is None or row.due_date < row.date):
                raise ValueError("Credit transactions require coherent due dates")
        totals: dict[str, int] = {}
        for payment in payments:
            key = getattr(payment, payment_key)
            original = lookup.get(key)
            if original is None or original.payment_type != "credit" or payment.date < original.date:
                raise ValueError("Payment must reference an earlier credit transaction")
            totals[key] = totals.get(key, 0) + payment.amount_mmk
            if totals[key] > amount(original):
                raise ValueError("Payment exceeds outstanding balance")
    loans = {x.loan_id: x for x in r.loans}
    principal: dict[str, int] = {}
    for payment in r.loan_payments:
        loan = loans.get(payment.loan_id)
        if loan is None or payment.date < loan.disbursement_date:
            raise ValueError("Invalid loan payment reference/date")
        principal[payment.loan_id] = principal.get(payment.loan_id, 0) + payment.principal_paid_mmk
        if principal[payment.loan_id] > loan.principal_mmk:
            raise ValueError("Principal payments exceed disbursement")
    for expense in r.expenses:
        if expense.payment_status == "unpaid" and expense.due_date is None:
            raise ValueError("Unpaid expense requires due date")
        if expense.due_date and expense.due_date < expense.date:
            raise ValueError("Expense due date precedes recognition date")
        if expense.paid_date and (expense.payment_status != "paid" or expense.paid_date < expense.date):
            raise ValueError("Invalid expense payment date")
    for adjustment in r.cash_adjustments:
        if adjustment.type == "cash_correction" and adjustment.direction is None:
            raise ValueError("Cash correction requires direction")
    schedule_keys = [(x.reference_id, x.due_date) for x in r.scheduled_obligations]
    if any(x.kind != "loan" for x in r.scheduled_obligations) or len(schedule_keys) != len(set(schedule_keys)):
        raise ValueError("P3 schedules must contain unique loan obligations only")
    if r.as_of.utcoffset() is None:
        raise ValueError("Snapshot timestamp must include timezone")


def calculate_snapshot(r: FinancialRecords, period: Period, obligations_before: date | None = None) -> FinancialSnapshot:
    validate_records(r)
    missing = sorted(REQUIRED - r.available_sheets)
    warnings = ["Simplified operational report; excludes taxes and depreciation.",
                "Interest uses cash-paid amounts, not accrued interest."]
    if "CashAdjustments" not in r.available_sheets:
        warnings.append("Owner movements and cash corrections are unavailable.")
    if not r.loan_schedule_available:
        warnings.append("Scheduled loan obligations are unavailable; obligations may be incomplete.")
    if any(x.payment_status == "paid" and x.paid_date is None for x in r.expenses):
        warnings.append("Expense payment date unavailable: paid expenses use their recorded date.")
    inside = lambda d: period.start <= d <= period.end
    known = lambda *sheets: set(sheets) <= r.available_sheets
    revenue = sum(x.qty * x.unit_selling_price_mmk for x in r.sales if inside(x.date)) if known("Sales") else None
    cogs = sum(x.qty * x.unit_cost_at_sale_mmk for x in r.sales if inside(x.date)) if known("Sales") else None
    expenses = sum(x.amount_mmk for x in r.expenses if inside(x.date)) if known("Expenses") else None
    interest = sum(x.interest_paid_mmk for x in r.loan_payments if inside(x.date)) if known("LoanPayments") else None
    operating = revenue - cogs - expenses if None not in (revenue, cogs, expenses) else None
    pbt = operating - interest if operating is not None and interest is not None else None
    ar = sum(x.qty * x.unit_selling_price_mmk for x in r.sales if x.payment_type == "credit" and x.date <= period.end) - sum(x.amount_mmk for x in r.customer_receipts if x.date <= period.end) if known("Sales", "CustomerReceipts") else None
    ap = sum(x.qty * x.unit_cost_mmk for x in r.purchases if x.payment_type == "credit" and x.date <= period.end) - sum(x.amount_mmk for x in r.supplier_payments if x.date <= period.end) if known("Purchases", "SupplierPayments") else None
    cash = None
    if not missing and r.opening_cash_mmk is not None and r.opening_cash_date is not None and r.opening_cash_date <= period.end:
        cash_date = lambda d: r.opening_cash_date <= d <= period.end
        cash = r.opening_cash_mmk
        cash += sum(x.qty * x.unit_selling_price_mmk for x in r.sales if x.payment_type == "cash" and cash_date(x.date))
        cash += sum(x.amount_mmk for x in r.customer_receipts if cash_date(x.date))
        cash += sum(x.principal_mmk for x in r.loans if cash_date(x.disbursement_date))
        cash -= sum(x.qty * x.unit_cost_mmk for x in r.purchases if x.payment_type == "cash" and cash_date(x.date))
        cash -= sum(x.amount_mmk for x in r.supplier_payments if cash_date(x.date))
        cash -= sum(x.amount_mmk for x in r.expenses if x.payment_status == "paid" and cash_date(x.paid_date or x.date))
        cash -= sum(x.principal_paid_mmk + x.interest_paid_mmk for x in r.loan_payments if cash_date(x.date))
        cash += sum(x.amount_mmk * (1 if x.type == "owner_contribution" or (x.type == "cash_correction" and x.direction == "in") else -1) for x in r.cash_adjustments if cash_date(x.date))
    else:
        warnings.append("Cash balance unavailable: complete ledger and dated opening cash required.")
    obligations: list[Obligation] = []
    if known("Purchases", "SupplierPayments"):
        for purchase in r.purchases:
            if purchase.payment_type != "credit" or purchase.date > period.end:
                continue
            remaining = purchase.qty * purchase.unit_cost_mmk - sum(x.amount_mmk for x in r.supplier_payments if x.purchase_id == purchase.purchase_id and x.date <= period.end)
            if remaining:
                obligations.append(Obligation(kind="supplier", due_date=purchase.due_date, amount_mmk=remaining, reference_id=purchase.purchase_id))
    if known("Expenses"):
        for expense in r.expenses:
            if expense.date <= period.end and (expense.payment_status == "unpaid" or (expense.paid_date and expense.paid_date > period.end)):
                if expense.due_date:
                    obligations.append(Obligation(kind="expense", due_date=expense.due_date, amount_mmk=expense.amount_mmk, reference_id=expense.expense_id))
                else:
                    warnings.append(f"Expense {expense.expense_id} has no historical due date.")
    if known("Loans", "LoanPayments"):
        obligations.extend(r.scheduled_obligations)
    obligations = sorted((x for x in obligations if x.amount_mmk and (obligations_before is None or x.due_date <= obligations_before)), key=lambda x: (x.due_date, x.kind, x.reference_id))
    if missing:
        warnings.append("Missing sheets are unavailable, not zero activity.")
    return FinancialSnapshot(business_id=r.business_id, period=period,
        actual=Actual(revenue_mmk=revenue, cogs_mmk=cogs, gross_profit_mmk=revenue - cogs if revenue is not None and cogs is not None else None, operating_expenses_mmk=expenses,
            operating_profit_mmk=operating, interest_expenses_mmk=interest, profit_before_tax_mmk=pbt,
            cash_balance_mmk=cash, receivables_mmk=ar, payables_mmk=ap),
        upcoming_obligations=obligations,
        data_quality=DataQuality(status="missing_data" if not r.available_sheets else "partial" if missing or cash is None or not r.loan_schedule_available else "complete", missing_sheets=missing, warnings=warnings),
        as_of=r.as_of, import_batch_id=r.import_batch_id)
