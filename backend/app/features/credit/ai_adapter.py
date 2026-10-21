"""Versioned credit aggregates for P4; no lender or borrower identifiers."""

from sqlalchemy import select

from ...db.models import Business
from .repository import credit_inputs
from .router import build_credit_snapshot


def get_ai_snapshot(business_id: str, sessions) -> dict:
    with sessions.begin() as session:
        if session.bind.dialect.name == "sqlite":
            session.connection().exec_driver_sql("BEGIN")
        session.scalar(select(Business).where(Business.id == business_id).with_for_update(read=True))
        inputs = credit_inputs(session, business_id)
    snapshot = build_credit_snapshot(inputs, business_id)
    capacity = snapshot["repayment_capacity"]
    due = next((loan["next_payment_due_mmk"] for loan in snapshot["loans"]
                if loan["next_payment_due_mmk"] is not None), None)
    available = capacity.get("projected_cash_available_before_loan_mmk")
    return {
        "business_id": business_id,
        "source_version": snapshot["source_version"],
        "as_of": snapshot["as_of"],
        "synthetic": False,
        "loans": [{} for _ in snapshot["loans"]],
        "repayment": {
            "assessment": "unavailable" if available is None or due is None else capacity["status"],
            "available_cash_mmk": available,
            "upcoming_due_mmk": due,
            "difference_mmk": capacity.get("repayment_gap_mmk"),
        },
    }
