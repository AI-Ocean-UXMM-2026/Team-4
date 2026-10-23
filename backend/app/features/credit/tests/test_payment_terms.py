from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.db.connection import make_engine, session_factory
from app.db.models import Base, Business, RecordedLoanBalance
from app.features.credit.recorded_balances import NextPaymentInput, update_next_payment
from app.features.credit.repository import credit_inputs


def test_payment_terms_persist_and_invalid_totals_roll_back():
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    sessions = session_factory(engine)
    with sessions.begin() as session:
        session.add(Business(id="mine", name="Shop"))
        session.flush()
        session.add(RecordedLoanBalance(id="balance", business_id="mine", lender_kind="individual", lender_name="Person", outstanding_principal_mmk=2000000, as_of_date=date(2026, 10, 1)))
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(sessions=sessions)))
    data = dict(annual_rate_pct="12", remaining_term_months=12, next_payment_date="2026-11-03", next_payment_mmk="180500", payment_frequency="monthly", outstanding_principal_mmk="1900000", as_of_date="2026-10-02", repayment_terms=dict(rate_period="monthly", entered_rate_pct="1", interest_method="reducing_balance", regular_payment_mmk="180000", next_payment_fees_mmk="500", balloon_payment_mmk="0", grace_months=0))
    stored = update_next_payment("balance", NextPaymentInput(**data), request, "mine", "owner")
    assert stored["repayment_terms"]["entered_rate_pct"] == "1"
    with sessions() as session:
        saved = credit_inputs(session, "mine")["recorded_balances"][0]
    assert saved["repayment_terms"]["next_payment_fees_mmk"] == "500"
    assert saved["outstanding_principal_mmk"] == "1900000.00"
    for change in ({"next_payment_mmk": "180000"}, {"annual_rate_pct": "1"}, {"as_of_date": "2026-12-01"}):
        with pytest.raises(HTTPException):
            update_next_payment("balance", NextPaymentInput(**{**data, **change}), request, "mine", "owner")
    engine.dispose()
