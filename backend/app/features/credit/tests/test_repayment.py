from decimal import Decimal

import pytest

from app.features.credit.repayment import repayment_totals


def test_actual_principal_and_interest_stay_separate():
    result = repayment_totals([
        {"principal_mmk": "90000", "interest_mmk": "10000"},
        {"principal_mmk": "50000", "interest_mmk": "7000"},
    ], Decimal("300000"))
    assert result == {
        "actual_principal_paid_mmk": "140000",
        "actual_interest_paid_mmk": "17000",
        "outstanding_principal_mmk": "160000",
    }


def test_repayments_cannot_reduce_outstanding_below_zero():
    with pytest.raises(ValueError, match="exceed"):
        repayment_totals([{"principal_mmk": "101", "interest_mmk": "0"}], Decimal("100"))
