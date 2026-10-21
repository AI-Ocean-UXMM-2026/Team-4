from datetime import date, datetime, timezone

import pytest

from backend.app.features.financial.calculations import REQUIRED, calculate_snapshot
from backend.app.features.financial.schemas import (
    CashAdjustment, Expense, FinancialRecords, Loan, LoanPayment, Obligation,
    Period, Purchase, Receipt, Sale, SupplierPayment,
)
from backend.app.features.financial.service import FinancialService

D = date.fromisoformat
PERIOD = Period(start=D("2026-10-01"), end=D("2026-10-20"))


def records(**changes):
    data = dict(business_id="A", opening_cash_mmk=100000, opening_cash_date=D("2026-09-01"),
                available_sheets=frozenset(REQUIRED | {"CashAdjustments"}),
                as_of=datetime(2026, 10, 20, tzinfo=timezone.utc), import_batch_id="batch-1",
                loan_schedule_available=True)
    data.update(changes)
    return FinancialRecords(**data)


def sale(**changes):
    data = dict(sale_id="S001", date=D("2026-10-01"), qty=10,
                unit_selling_price_mmk=5000, unit_cost_at_sale_mmk=4000, payment_type="cash")
    data.update(changes)
    return Sale(**data)


def test_cash_sale():
    a = calculate_snapshot(records(sales=(sale(),)), PERIOD).actual
    assert (a.revenue_mmk, a.cogs_mmk, a.operating_profit_mmk, a.cash_balance_mmk) == (50000, 40000, 10000, 150000)
    assert a.gross_profit_mmk == 10000


def test_credit_sale_then_partial_collection():
    s = sale(sale_id="S002", qty=5, unit_selling_price_mmk=8000, unit_cost_at_sale_mmk=6500, payment_type="credit", due_date=D("2026-10-15"))
    a = calculate_snapshot(records(sales=(s,)), PERIOD).actual
    assert (a.revenue_mmk, a.receivables_mmk, a.cash_balance_mmk) == (40000, 40000, 100000)
    r = Receipt(receipt_id="R001", sale_id="S002", date=D("2026-10-10"), amount_mmk=20000)
    a = calculate_snapshot(records(sales=(s,), customer_receipts=(r,)), PERIOD).actual
    assert (a.revenue_mmk, a.receivables_mmk, a.cash_balance_mmk) == (40000, 20000, 120000)


def test_credit_purchase_and_partial_payment_do_not_change_profit():
    p = Purchase(purchase_id="P001", date=D("2026-10-01"), qty=10, unit_cost_mmk=4000, payment_type="credit", due_date=D("2026-10-15"))
    pay = SupplierPayment(payment_id="SP001", purchase_id="P001", date=D("2026-10-10"), amount_mmk=10000)
    snapshot = calculate_snapshot(records(purchases=(p,), supplier_payments=(pay,)), PERIOD)
    assert (snapshot.actual.payables_mmk, snapshot.actual.cash_balance_mmk, snapshot.actual.cogs_mmk, snapshot.actual.operating_profit_mmk) == (30000, 90000, 0, 0)
    assert snapshot.upcoming_obligations[0].amount_mmk == 30000


def test_cash_purchase_is_not_cogs():
    p = Purchase(purchase_id="P", date=D("2026-10-01"), qty=2, unit_cost_mmk=10000, payment_type="cash")
    a = calculate_snapshot(records(purchases=(p,)), PERIOD).actual
    assert (a.cash_balance_mmk, a.cogs_mmk, a.operating_profit_mmk) == (80000, 0, 0)


def test_replacement_expense_and_repeat_calculation():
    def expense(amount):
        return Expense(expense_id="E001", date=D("2026-10-02"), category="rent", amount_mmk=amount, payment_status="paid")
    old = calculate_snapshot(records(expenses=(expense(50000),)), PERIOD)
    updated = records(expenses=(expense(80000),))
    new = calculate_snapshot(updated, PERIOD)
    assert new.actual.cash_balance_mmk - old.actual.cash_balance_mmk == -30000
    assert new.actual.operating_profit_mmk - old.actual.operating_profit_mmk == -30000
    assert calculate_snapshot(updated, PERIOD) == new


def test_loan_disbursement_principal_interest_and_schedule():
    loan = Loan(loan_id="L", disbursement_date=D("2026-10-01"), principal_mmk=1000000)
    pay = LoanPayment(payment_id="LP", loan_id="L", date=D("2026-10-10"), principal_paid_mmk=100000, interest_paid_mmk=5000)
    scheduled = Obligation(kind="loan", due_date=D("2026-11-01"), amount_mmk=105000, reference_id="L-Nov")
    a = calculate_snapshot(records(loans=(loan,), loan_payments=(pay,), scheduled_obligations=(scheduled,)), PERIOD).actual
    assert (a.cash_balance_mmk, a.revenue_mmk, a.operating_profit_mmk, a.profit_before_tax_mmk) == (995000, 0, 0, -5000)


def test_period_profit_and_historical_balances_have_different_boundaries():
    historical = sale(date=D("2026-09-02"))
    future = sale(sale_id="future", date=D("2026-10-25"))
    a = calculate_snapshot(records(sales=(historical, future)), PERIOD).actual
    assert (a.revenue_mmk, a.cash_balance_mmk) == (0, 150000)


def test_expense_later_paid_still_outstanding_at_historical_end():
    e = Expense(expense_id="E", date=D("2026-10-01"), amount_mmk=30000, category="rent", payment_status="paid", paid_date=D("2026-10-25"), due_date=D("2026-10-15"))
    snap = calculate_snapshot(records(expenses=(e,)), PERIOD)
    assert snap.actual.operating_expenses_mmk == 30000
    assert snap.actual.cash_balance_mmk == 100000
    assert snap.upcoming_obligations[0].amount_mmk == 30000


def test_missing_records_are_not_zero():
    snap = calculate_snapshot(records(available_sheets=frozenset({"Settings"})), PERIOD)
    assert snap.actual.revenue_mmk is None
    assert snap.actual.cash_balance_mmk is None
    assert snap.data_quality.status == "partial"
    assert "Sales" in snap.data_quality.missing_sheets


def test_empty_valid_workbook_is_zero_activity():
    a = calculate_snapshot(records(), PERIOD).actual
    assert a.revenue_mmk == 0
    assert a.cash_balance_mmk == 100000


def test_opening_cash_is_inclusive_and_prior_activity_not_recounted():
    a = calculate_snapshot(records(opening_cash_date=D("2026-10-01"), sales=(sale(date=D("2026-09-30")), sale(sale_id="S2"))), PERIOD).actual
    assert a.cash_balance_mmk == 150000


def test_adjustments_and_explicit_correction_direction():
    adjustments = tuple(CashAdjustment(adjustment_id=str(i), date=D("2026-10-01"), type=kind, amount_mmk=amount, direction=direction) for i, (kind, amount, direction) in enumerate([
        ("owner_contribution", 20000, None), ("owner_withdrawal", 5000, None), ("cash_correction", 1000, "out")]))
    assert calculate_snapshot(records(cash_adjustments=adjustments), PERIOD).actual.cash_balance_mmk == 114000
    with pytest.raises(ValueError, match="direction"):
        calculate_snapshot(records(cash_adjustments=(CashAdjustment(adjustment_id="x", date=D("2026-10-01"), type="cash_correction", amount_mmk=1),)), PERIOD)


def test_duplicate_ids_rejected_instead_of_double_counted():
    with pytest.raises(ValueError, match="duplicate"):
        calculate_snapshot(records(sales=(sale(), sale())), PERIOD)


def test_overpayment_rejected():
    s = sale(payment_type="credit", due_date=D("2026-10-15"))
    receipt = Receipt(receipt_id="r", sale_id="S001", date=D("2026-10-10"), amount_mmk=50001)
    with pytest.raises(ValueError, match="exceeds"):
        calculate_snapshot(records(sales=(s,), customer_receipts=(receipt,)), PERIOD)


def test_service_rejects_cross_business_records():
    class WrongRepository:
        def load_records(self, business_id, through):
            return records(business_id="other")
    with pytest.raises(PermissionError):
        FinancialService(WrongRepository()).financial_snapshot("A", PERIOD)


def test_trends_share_one_snapshot_and_year_boundary():
    class Repository:
        calls = 0
        def load_records(self, business_id, through):
            self.calls += 1
            return records()
    repo = Repository()
    result = FinancialService(repo).trends("A", D("2027-01-15"), 3)
    assert repo.calls == 1
    assert [x.period.start.isoformat() for x in result["points"]] == ["2026-11-01", "2026-12-01", "2027-01-01"]
    assert result["points"][-1].period.end == D("2027-01-15")


@pytest.mark.parametrize("value", [-1, 1.5, True])
def test_invalid_money_rejected(value):
    with pytest.raises(ValueError):
        sale(unit_selling_price_mmk=value)


def test_duplicate_loan_schedule_rejected():
    schedule = Obligation(kind="loan", due_date=D("2026-11-01"), amount_mmk=10000, reference_id="L-Nov")
    with pytest.raises(ValueError, match="unique loan"):
        calculate_snapshot(records(scheduled_obligations=(schedule, schedule)), PERIOD)


def test_unpaid_expense_recognized_but_not_cash_outflow():
    expense = Expense(expense_id="E", date=D("2026-10-01"), category="rent", amount_mmk=50000, payment_status="unpaid", due_date=D("2026-10-25"))
    snap = calculate_snapshot(records(expenses=(expense,)), PERIOD, obligations_before=D("2026-10-24"))
    assert snap.actual.operating_profit_mmk == -50000
    assert snap.actual.cash_balance_mmk == 100000
    assert not snap.upcoming_obligations
