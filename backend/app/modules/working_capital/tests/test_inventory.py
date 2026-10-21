from decimal import Decimal

from app.modules.working_capital.inventory import coverage_days, inventory_risk, purchasing_budget, reorder_advice


def test_stockout_risk_uses_coverage_below_lead_plus_buffer():
    result = inventory_risk(Decimal("12"), Decimal("5"), supplier_lead_days=4, safety_buffer_days=0)
    assert result["coverage_days"] == Decimal("2.4")
    assert result["stockout_risk"] is True


def test_no_recent_sales_is_not_zero_or_infinite_coverage():
    days, status = coverage_days(Decimal("12"), Decimal("0"))
    assert days is None
    assert status == "no_recent_sales"


def test_budget_protects_obligations_and_reserve():
    assert purchasing_budget(Decimal("500"), Decimal("300"), Decimal("250"))["budget_mmk"] == Decimal("0.00")


def test_reorder_is_capped_and_does_not_break_minimum_order():
    result = reorder_advice(Decimal("5"), Decimal("0"), 4, 0, Decimal("100"), Decimal("250"), Decimal("5"))
    assert result["recommended_qty"] == Decimal("0.000")
    assert result["minimum_order_not_affordable"] is True
