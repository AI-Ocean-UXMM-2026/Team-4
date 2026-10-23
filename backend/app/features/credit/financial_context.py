"""Reuse Financial Health cash and conservatively reserve operating balances."""
from decimal import Decimal

from ..financial.platform import amount, calculate_platform_snapshot
from ..financial.schemas import Period


def financial_cash_context(ledger, as_of):
    snapshot = calculate_platform_snapshot(ledger, Period(start=as_of, end=as_of))
    cash = snapshot.actual.cash_balance_mmk
    if cash is None:
        return None
    # Workbook supplier due dates are unknown: reserve every outstanding balance.
    supplier_balances = snapshot.actual.payables_mmk
    if supplier_balances is None:
        return None
    unpaid_expenses = Decimal(0)
    for row in ledger.tables.get("Expenses", []):
        paid = row.get("amount_paid_mmk")
        if paid is None:
            return None
        paid_by_now = amount(row, "amount_paid_mmk") if row.get("paid_date") and row["paid_date"] <= as_of else Decimal(0)
        unpaid_expenses += max(Decimal(0), amount(row, "amount_mmk") - paid_by_now)
    mandatory = supplier_balances + unpaid_expenses
    return {
        "current_cash_mmk": cash,
        "outstanding_supplier_balances_mmk": supplier_balances,
        "unpaid_expenses_mmk": unpaid_expenses,
        "mandatory_operating_payments_due_before_next_payment_mmk": mandatory,
        "confirmed_receipts_due_before_next_payment_mmk": Decimal(0),
        "protected_reserve_mmk": Decimal(0),
    }
