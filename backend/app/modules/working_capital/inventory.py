"""Deterministic inventory and purchasing calculations.

All returned monetary values are Decimal values quantized to 0.01 MMK.  These
helpers deliberately never turn missing observations into zero observations.
"""
from decimal import Decimal, ROUND_HALF_UP

MMK = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MMK, rounding=ROUND_HALF_UP)


def coverage_days(current_stock_qty: Decimal, average_daily_units_sold: Decimal | None):
    if average_daily_units_sold is None or average_daily_units_sold <= 0:
        return None, "no_recent_sales"
    if current_stock_qty < 0:
        raise ValueError("current_stock_qty cannot be negative")
    return (Decimal(current_stock_qty) / Decimal(average_daily_units_sold)).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP
    ), None


def inventory_risk(
    current_stock_qty: Decimal,
    average_daily_units_sold: Decimal | None,
    supplier_lead_days: int | None,
    safety_buffer_days: int,
) -> dict:
    coverage, status = coverage_days(current_stock_qty, average_daily_units_sold)
    if status:
        return {"status": status, "stockout_risk": None, "coverage_days": None}
    if supplier_lead_days is None:
        return {"status": "insufficient_data", "stockout_risk": None, "coverage_days": coverage}
    if supplier_lead_days < 0 or safety_buffer_days < 0:
        raise ValueError("lead and safety days cannot be negative")
    threshold = Decimal(supplier_lead_days + safety_buffer_days)
    return {
        "status": "observed",
        "stockout_risk": coverage < threshold,
        "coverage_days": coverage,
        "risk_threshold_days": threshold,
    }


def purchasing_budget(
    available_cash_mmk: Decimal | None,
    mandatory_payments_mmk: Decimal | None,
    protected_reserve_mmk: Decimal | None,
) -> dict:
    if any(value is None for value in (available_cash_mmk, mandatory_payments_mmk, protected_reserve_mmk)):
        return {"status": "insufficient_data", "budget_mmk": None}
    values = [Decimal(available_cash_mmk), Decimal(mandatory_payments_mmk), Decimal(protected_reserve_mmk)]
    if any(value < 0 for value in values):
        raise ValueError("cash, mandatory payments and reserve cannot be negative")
    return {"status": "observed", "budget_mmk": money(max(Decimal("0"), values[0] - values[1] - values[2]))}


def reorder_advice(
    average_daily_units_sold: Decimal | None,
    current_stock_qty: Decimal,
    supplier_lead_days: int | None,
    safety_buffer_days: int,
    unit_cost_mmk: Decimal | None,
    budget_mmk: Decimal | None,
    min_order_qty: Decimal | None = None,
) -> dict:
    """Return advisory order quantities; never claim a purchase is funded."""
    required = [average_daily_units_sold, supplier_lead_days, unit_cost_mmk, budget_mmk]
    if any(value is None for value in required):
        return {"status": "insufficient_data", "recommended_qty": None}
    daily, cost, budget = Decimal(average_daily_units_sold), Decimal(unit_cost_mmk), Decimal(budget_mmk)
    if daily <= 0 or cost <= 0:
        return {"status": "insufficient_data", "recommended_qty": None}
    target_qty = daily * Decimal(supplier_lead_days + safety_buffer_days)
    need = max(Decimal("0"), target_qty - Decimal(current_stock_qty))
    affordable = budget / cost
    recommendation = min(need, affordable)
    minimum_warning = False
    if min_order_qty is not None and recommendation > 0 and recommendation < Decimal(min_order_qty):
        minimum_warning = True
        recommendation = Decimal("0")
    return {
        "status": "advisory",
        "recommended_qty": recommendation.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP),
        "estimated_cost_mmk": money(recommendation * cost),
        "budget_limited": affordable < need,
        "minimum_order_not_affordable": minimum_warning,
    }
