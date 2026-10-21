"""Read-only scenario formulas.  No function writes imported facts."""
from decimal import Decimal

from .inventory import money


def slow_stock_projection(quantity, selling_price_mmk, unit_cost_mmk, discount_pct, sell_through_pct, expected_date=None):
    quantity, price, cost = Decimal(quantity), Decimal(selling_price_mmk), Decimal(unit_cost_mmk)
    discount, sell_through = Decimal(discount_pct), Decimal(sell_through_pct)
    if quantity < 0 or price < 0 or cost < 0 or not (0 <= discount <= 100) or not (0 <= sell_through <= 100):
        raise ValueError("quantities and prices must be non-negative; percentages must be 0..100")
    expected_units = (quantity * sell_through / 100).quantize(Decimal("0.001"))
    reduced_price = money(price * (1 - discount / 100))
    receipts, booked_cost = money(expected_units * reduced_price), money(expected_units * cost)
    return {
        "status": "projected", "expected_units": expected_units, "discounted_unit_price_mmk": reduced_price,
        "potential_cash_receipts_mmk": receipts, "associated_cogs_mmk": booked_cost,
        "projected_gross_result_mmk": money(receipts - booked_cost), "expected_date": expected_date,
        "warning": "Scenario only. Actual inventory and cash change only after a confirmed imported sale.",
    }


def receivable_collection_projection(outstanding_mmk, collection_pct, expected_date=None):
    outstanding, percentage = Decimal(outstanding_mmk), Decimal(collection_pct)
    if outstanding < 0 or not 0 <= percentage <= 100:
        raise ValueError("receivable must be non-negative and percentage must be 0..100")
    return {"status": "projected", "potential_cash_receipts_mmk": money(outstanding * percentage / 100),
            "expected_date": expected_date, "warning": "Not guaranteed. Cash changes only after CustomerReceipts is imported."}


def expense_pause_projection(amount_mmk, is_paid, is_immutable, expected_date=None, business_impact=None):
    amount = Decimal(amount_mmk)
    if amount < 0:
        raise ValueError("amount cannot be negative")
    eligible = not is_paid and not is_immutable
    return {"status": "projected" if eligible else "ineligible", "potential_spending_avoided_mmk": money(amount if eligible else Decimal("0")),
            "expected_date": expected_date, "business_impact": business_impact or "Review possible operational impact before pausing spending.",
            "warning": "Already-paid, historical, salary and rent expenses do not release future cash."}


def unlock_cash_summary(actual_recovered_mmk, slow_stock=None, receivables=None, expense_pauses=None):
    slow_stock, receivables, expense_pauses = slow_stock or [], receivables or [], expense_pauses or []
    receipts = sum((Decimal(item["potential_cash_receipts_mmk"]) for item in [*slow_stock, *receivables]), Decimal("0"))
    avoided = sum((Decimal(item["potential_spending_avoided_mmk"]) for item in expense_pauses), Decimal("0"))
    return {"actual_recovered_mmk": money(Decimal(actual_recovered_mmk)), "potential_cash_receipts_mmk": money(receipts),
            "potential_spending_avoided_mmk": money(avoided), "scenario_cash_relief_if_assumptions_hold_mmk": money(receipts + avoided),
            "warning": "Projected liquidity is not actual cash and is not added to the cash balance."}
