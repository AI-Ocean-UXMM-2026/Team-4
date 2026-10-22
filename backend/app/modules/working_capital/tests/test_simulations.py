from decimal import Decimal

from app.modules.working_capital.cash_conversion import cash_conversion_cycle, ccc_scenario
from app.modules.working_capital.reserve import reserve_plan
from app.modules.working_capital.simulations import expense_pause_projection, receivable_collection_projection, slow_stock_projection


def test_markdown_applies_to_selling_price_and_shows_loss():
    result = slow_stock_projection(10, 100, 90, 20, 100)
    assert result["discounted_unit_price_mmk"] == Decimal("80.00")
    assert result["projected_gross_result_mmk"] == Decimal("-100.00")


def test_receivable_slider_only_returns_potential_receipt():
    result = receivable_collection_projection(1000, 50)
    assert result["potential_cash_receipts_mmk"] == Decimal("500.00")
    assert "Not guaranteed" in result["warning"]


def test_paid_expense_has_no_future_savings():
    assert expense_pause_projection(500, is_paid=True, is_immutable=False)["potential_spending_avoided_mmk"] == Decimal("0.00")


def test_ccc_supplier_extension_is_hypothetical():
    current = cash_conversion_cycle(30, 12, 25)
    current |= {"dio_days": Decimal("30"), "dso_days": Decimal("12"), "dpo_days": Decimal("25")}
    result = ccc_scenario(current, supplier_extension_days=15)
    assert current["ccc_days"] == Decimal("17.0")
    assert result["proposed"]["ccc_days"] == Decimal("2.0")
    assert result["projected_only"] is True


def test_missing_ccc_inputs_are_insufficient_data():
    assert cash_conversion_cycle(None, 12, 25)["status"] == "insufficient_data"


def test_reserve_plan_matches_example_without_promising_readiness():
    result = reserve_plan(500_000, 300_000, 3, 100_000)
    assert result["target_mmk"] == Decimal("1500000.00")
    assert result["shortfall_mmk"] == Decimal("1200000.00")
    assert result["months_to_target"] == 12


def test_manual_protected_target_overrides_lower_coverage_target():
    result = reserve_plan(500_000, 300_000, 3, 100_000, 3_000_000)
    assert result["target_mmk"] == Decimal("3000000.00")
    assert result["shortfall_mmk"] == Decimal("2700000.00")
    assert result["months_to_target"] == 27
    assert reserve_plan(700_000, 300_000, 6, 100_000, 3_000_000)["target_mmk"] == Decimal("4200000.00")
