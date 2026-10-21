"""Safety-reserve planner."""
from decimal import Decimal, ROUND_CEILING

from .inventory import money


def reserve_plan(monthly_essential_costs_mmk, dedicated_reserve_mmk, target_months, monthly_contribution_mmk):
    costs, reserve, contribution = Decimal(monthly_essential_costs_mmk), Decimal(dedicated_reserve_mmk), Decimal(monthly_contribution_mmk)
    if costs < 0 or reserve < 0 or contribution < 0 or not 1 <= int(target_months) <= 6:
        raise ValueError("invalid reserve inputs")
    target = money(costs * int(target_months))
    shortfall = money(max(Decimal("0"), target - reserve))
    months = None if shortfall > 0 and contribution == 0 else int((shortfall / contribution).to_integral_value(rounding=ROUND_CEILING)) if shortfall else 0
    return {"status": "projected", "target_mmk": target, "dedicated_reserve_mmk": money(reserve), "shortfall_mmk": shortfall,
            "affordable_monthly_contribution_mmk": money(contribution), "months_to_target": months,
            "warning": "This is a milestone plan, not a promise. Total cash and projected receipts are not a dedicated reserve."}
