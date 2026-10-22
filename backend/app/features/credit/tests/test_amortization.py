from datetime import date
from decimal import Decimal

import pytest

from app.features.credit.amortization import UnsupportedLoanModel, amortization_schedule


def test_reducing_balance_schedule_reconciles_after_whole_mmk_rounding():
    rows = amortization_schedule(Decimal("3000000"), Decimal("12"), 12, date(2026, 1, 31))
    assert len(rows) == 12
    assert rows[0].scheduled_installment_mmk == Decimal("266546")
    assert rows[-1].projected_principal_mmk == Decimal("0")
    assert sum(row.principal_due_mmk for row in rows) == Decimal("3000000")
    assert all(row.scheduled_installment_mmk == row.principal_due_mmk + row.interest_due_mmk for row in rows)
    assert rows[0].due_date == date(2026, 2, 28)


def test_zero_interest_has_no_division_by_zero_and_reconciles():
    rows = amortization_schedule(Decimal("1000"), Decimal("0"), 3, date(2026, 1, 1))
    assert [row.scheduled_installment_mmk for row in rows] == [Decimal("333"), Decimal("333"), Decimal("334")]
    assert rows[-1].projected_principal_mmk == Decimal("0")


def test_unsupported_model_is_explicit():
    with pytest.raises(UnsupportedLoanModel):
        amortization_schedule(Decimal("1000"), Decimal("10"), 12, date(2026, 1, 1), "flat")


def test_explicit_first_payment_anchors_monthly_due_dates():
    rows = amortization_schedule(Decimal("1200000"), Decimal("12"), 12, date(2026, 10, 20),
                                 first_payment_date=date(2026, 11, 20), payment_frequency="monthly")
    assert rows[0].due_date == date(2026, 11, 20)
    assert rows[-1].due_date == date(2027, 10, 20)
    assert rows[0].scheduled_installment_mmk == Decimal("106619")
    assert sum(row.principal_due_mmk for row in rows) == Decimal("1200000")


@pytest.mark.parametrize("frequency", ["weekly", "quarterly"])
def test_unsupported_frequency_is_never_estimated_as_monthly(frequency):
    with pytest.raises(UnsupportedLoanModel, match="Only monthly"):
        amortization_schedule(Decimal("1000"), Decimal("12"), 12, date(2026, 1, 1), payment_frequency=frequency)


def test_irregular_first_period_is_not_silently_given_monthly_interest():
    with pytest.raises(UnsupportedLoanModel, match="irregular"):
        amortization_schedule(Decimal("1000"), Decimal("12"), 12, date(2026, 1, 1), first_payment_date=date(2026, 3, 1))
