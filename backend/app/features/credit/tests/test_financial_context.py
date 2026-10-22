from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.features.credit.financial_context import financial_cash_context
from app.features.credit.repayment_capacity import repayment_capacity
from app.features.financial.platform_repository import Ledger


def ledger():
    tables = {name: [] for name in ("Sales", "Purchases", "CustomerReceipts", "SupplierPayments", "Expenses", "Loans", "LoanPayments", "CashAdjustments")}
    tables["Settings"] = [{"business_id": "a", "opening_date": date(2026, 10, 1), "opening_cash_mmk": "1000"}]
    tables["Purchases"] = [{"business_id": "a", "purchase_id": "p", "date": date(2026, 10, 1), "quantity": "1", "unit_cost_mmk": "200", "cash_paid_mmk": "0"}]
    tables["Expenses"] = [{"business_id": "a", "date": date(2026, 10, 2), "amount_mmk": "100", "amount_paid_mmk": "0", "paid_date": None}]
    return Ledger("a", 1, tables, None, "batch")


def test_financial_cash_reserves_payables_and_unpaid_expenses():
    context = financial_cash_context(ledger(), date(2026, 10, 22))
    assert context["current_cash_mmk"] == Decimal("1000")
    assert context["outstanding_supplier_balances_mmk"] == Decimal("200")
    assert context["unpaid_expenses_mmk"] == Decimal("100")
    result = repayment_capacity(context, "800")
    assert result["status"] == "potential_shortfall"
    assert Decimal(result["projected_cash_available_before_loan_mmk"]) == 700
    assert Decimal(result["repayment_gap_mmk"]) == -100
    assert Decimal(result["recorded_cash_mmk"]) == 1000
    assert Decimal(result["outstanding_supplier_balances_mmk"]) == 200
    assert Decimal(result["unpaid_expenses_mmk"]) == 100
    assert Decimal(result["next_loan_payment_mmk"]) == 800


def test_incomplete_cash_is_unavailable_instead_of_zero():
    data = ledger()
    data.tables["Expenses"][0]["amount_paid_mmk"] = None
    assert financial_cash_context(data, date(2026, 10, 22)) is None


def test_no_successful_import_has_no_cash_context():
    data = ledger()
    data = Ledger("a", 1, data.tables, None, None)
    assert financial_cash_context(data, date(2026, 10, 22)) is None


def test_credit_summary_uses_cash_and_combines_same_date_payments(monkeypatch):
    from app.features.credit import router

    loans = [{"loan_id": str(i), "schedule_status": "available", "next_due_date": date(2026, 11, day), "next_payment_due_mmk": Decimal(due), "outstanding_principal_mmk": Decimal(due)} for i, (day, due) in enumerate([(1, "400"), (1, "400"), (2, "100")])]
    monkeypatch.setattr(router, "_loan_items", lambda inputs: loans)
    inputs = {"business": {"id": "a"}, "source_version": 1, "tables": {}, "loans": [], "as_of": date(2026, 10, 22), "cash_context": financial_cash_context(ledger(), date(2026, 10, 22))}
    result = router.build_credit_snapshot(inputs, "a")
    assert Decimal(result["repayment_capacity"]["repayment_gap_mmk"]) == -100
    assert "p1_cash_snapshot" not in result["data_quality"]["missing"]
    assert not any("not connected" in item for item in result["data_quality"]["limitations"])
    loans[0]["schedule_status"] = "missing_terms"
    assert router.build_credit_snapshot(inputs, "a")["repayment_capacity"]["status"] == "insufficient_data"


def test_summary_loads_financial_ledger_and_rejects_mixed_versions(monkeypatch):
    from app.features.credit import router
    from fastapi import HTTPException

    inputs = {"business": {"id": "a"}, "source_version": 1, "tables": {}, "loans": [], "payments": [], "as_of": date(2026, 10, 22)}
    monkeypatch.setattr(router, "_load_inputs", lambda request, business_id: dict(inputs))
    monkeypatch.setattr(router, "SqlFinancialRepository", lambda sessions: SimpleNamespace(load_ledger=lambda business_id: ledger()))
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(sessions=None)))
    result = router.summary(request, "a")
    assert "p1_cash_snapshot" not in result["data_quality"]["missing"]
    inputs["source_version"] = 2
    with pytest.raises(HTTPException) as error:
        router.summary(request, "a")
    assert error.value.status_code == 409
