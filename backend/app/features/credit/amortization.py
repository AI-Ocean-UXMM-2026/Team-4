"""Deterministic reducing-balance, equal-monthly-payment estimates.

Amounts are rounded to whole MMK with ROUND_HALF_UP at each posted schedule
line. The last instalment absorbs any remaining principal rounding residue.
These estimates do not replace a lender statement.
"""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

MMK = Decimal("1")
ZERO = Decimal("0")


class UnsupportedLoanModel(ValueError):
    """Raised when terms do not describe the supported amortizing model."""


def round_mmk(value: Decimal) -> Decimal:
    return value.quantize(MMK, rounding=ROUND_HALF_UP)


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


@dataclass(frozen=True)
class Installment:
    period: int
    due_date: date
    scheduled_installment_mmk: Decimal
    principal_due_mmk: Decimal
    interest_due_mmk: Decimal
    projected_principal_mmk: Decimal


def amortization_schedule(
    principal_mmk: Decimal,
    annual_rate_pct: Decimal,
    term_months: int,
    disbursement_date: date,
    repayment_model: str = "reducing_balance",
    first_payment_date: date | None = None,
    payment_frequency: str = "monthly",
) -> list[Installment]:
    if payment_frequency != "monthly":
        raise UnsupportedLoanModel("Only monthly repayments are supported. No schedule is estimated for this frequency.")
    first_due = first_payment_date or add_months(disbursement_date, 1)
    if first_due <= disbursement_date:
        raise ValueError("First payment must be after disbursement.")
    if first_due != add_months(disbursement_date, 1):
        raise UnsupportedLoanModel("The first payment creates an irregular interest period. Import the lender schedule; no schedule is estimated.")
    if repayment_model != "reducing_balance":
        raise UnsupportedLoanModel(f"Unsupported repayment model: {repayment_model}")
    if principal_mmk <= ZERO:
        raise ValueError("Principal must be greater than zero.")
    if annual_rate_pct < ZERO:
        raise ValueError("Annual rate cannot be negative.")
    if term_months <= 0:
        raise ValueError("Term must be at least one month.")

    principal = round_mmk(principal_mmk)
    monthly_rate = annual_rate_pct / Decimal("1200")
    if monthly_rate == ZERO:
        payment = round_mmk(principal / Decimal(term_months))
    else:
        payment = round_mmk(
            principal
            * monthly_rate
            / (Decimal("1") - (Decimal("1") + monthly_rate) ** (-term_months))
        )

    remaining = principal
    rows: list[Installment] = []
    for period in range(1, term_months + 1):
        interest = round_mmk(remaining * monthly_rate)
        installment = payment
        if period == term_months:
            installment = round_mmk(remaining + interest)
        principal_due = min(remaining, max(ZERO, installment - interest))
        remaining = max(ZERO, remaining - principal_due)
        rows.append(
            Installment(
                period=period,
                due_date=add_months(first_due, period - 1) if first_payment_date else add_months(disbursement_date, period),
                scheduled_installment_mmk=round_mmk(principal_due + interest),
                principal_due_mmk=principal_due,
                interest_due_mmk=interest,
                projected_principal_mmk=remaining,
            )
        )
    return rows
