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
