"""Interpret actual repayment facts separately from modelled obligations."""

from decimal import Decimal

from .amortization import ZERO, round_mmk


def repayment_totals(payments: list[dict], principal_mmk: Decimal) -> dict:
    principal_paid = sum((Decimal(str(row["principal_mmk"])) for row in payments), ZERO)
    interest_paid = sum((Decimal(str(row["interest_mmk"])) for row in payments), ZERO)
    if principal_paid < ZERO or interest_paid < ZERO:
        raise ValueError("Recorded repayments cannot be negative.")
    if principal_paid > principal_mmk:
        raise ValueError("Recorded principal repayments exceed the original principal.")
    return {
        "actual_principal_paid_mmk": str(round_mmk(principal_paid)),
        "actual_interest_paid_mmk": str(round_mmk(interest_paid)),
        "outstanding_principal_mmk": str(round_mmk(max(ZERO, principal_mmk - principal_paid))),
    }
