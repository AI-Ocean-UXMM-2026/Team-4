import pytest
from app.features.credit.tests.test_documents import client
from app.features.credit.recorded_balances import router, LoanBalanceInput
from app.features.credit.repository import credit_inputs


def test_balance_is_saved_separately_without_fabricating_original_loan(client):
    client.app.include_router(router)
    payload = {"lender_kind": "bank", "lender_name": "KBZ Bank", "bank_id": "kbz", "loan_product_id": "kbz-term",
               "outstanding_principal_mmk": "1234000", "as_of_date": "2026-10-01", "loan_start_date": "2026-01-01"}
    result = client.post("/recorded-balances?business_id=mine", json=payload)
    assert result.status_code == 200, result.text
    assert result.json()["loan_product_id"] == "kbz-term"
    assert result.json()["loan_start_date"] == "2026-01-01"
    with client.app.state.sessions() as session:
        inputs = credit_inputs(session, "mine")
    assert inputs["loans"] == []
    assert inputs["recorded_balances"][0]["outstanding_principal_mmk"] == "1234000.00"
    endpoint = f'/recorded-balances/{result.json()["id"]}/next-payment?business_id=mine'
    payment = {"annual_rate_pct": "12", "remaining_term_months": 12,
               "next_payment_date": "2026-11-01", "next_payment_mmk": "125000", "payment_frequency": "monthly"}
    payment["repayment_terms"] = {"rate_period":"annual", "entered_rate_pct":"12", "interest_method":"reducing_balance", "regular_payment_mmk":"125000", "next_payment_fees_mmk":"0", "balloon_payment_mmk":"0", "grace_months":0}
    assert client.put(endpoint, json=payment).status_code == 200
    assert client.put(endpoint.replace("business_id=mine", "business_id=other"), json=payment).status_code == 403
    assert client.put(endpoint, json={**payment, "next_payment_date": "2026-09-30"}).status_code == 400
    with client.app.state.sessions() as session:
        updated = credit_inputs(session, "mine")
    assert updated["recorded_balances"][0]["next_payment_mmk"] == "125000.00"
    assert updated["recorded_balances"][0]["annual_rate_pct"] == "12.000"
    assert updated["recorded_balances"][0]["remaining_term_months"] == 12
    assert updated["recorded_balances"][0]["repayment_terms"]["interest_method"] == "reducing_balance"
    assert updated["recorded_balances"][0]["repayment_terms"]["entered_rate_pct"] == "12"
    assert updated["loans"] == []
    from app.features.credit.router import build_credit_snapshot
    updated["cash_context"] = {"current_cash_mmk": "1000000", "confirmed_receipts_before_due_mmk": "0", "mandatory_payments_before_due_mmk": "0", "protected_reserve_mmk": "0"}
    snapshot = build_credit_snapshot(updated, "mine")
    assert snapshot["repayment_capacity"]["repayment_gap_mmk"] == "875000.00"
    updated["recorded_balances"][0]["next_payment_date"] = None
    assert build_credit_snapshot(updated, "mine")["repayment_capacity"]["status"] == "insufficient_data"
    assert client.post("/recorded-balances?business_id=mine", json=payload).status_code == 409
    assert client.post("/recorded-balances?business_id=other", json=payload).status_code == 403
    base = f'/recorded-balances/{result.json()["id"]}?business_id=mine'
    change = {"outstanding_principal_mmk":"1200000", "as_of_date":"2026-10-02"}
    assert client.put(base, json=change).json()["outstanding_principal_mmk"] == "1200000"
    assert client.put(base.replace("business_id=mine", "business_id=other"), json=change).status_code == 403
    assert client.delete(base.replace("business_id=mine", "business_id=other")).status_code == 403
    assert client.delete(base).status_code == 200
    assert client.put(base, json=change).status_code == 404
    with client.app.state.sessions() as session:
        assert credit_inputs(session,"mine")["recorded_balances"] == []


def test_wrong_product_and_negative_balance_are_rejected():
    with pytest.raises(ValueError):
        LoanBalanceInput(lender_kind="bank", lender_name="KBZ Bank", bank_id="kbz", loan_product_id="yoma-sme",
                         outstanding_principal_mmk="1", as_of_date="2026-10-01")
    with pytest.raises(ValueError):
        LoanBalanceInput(lender_kind="individual", lender_name="Person", outstanding_principal_mmk="-1", as_of_date="2026-10-01")
