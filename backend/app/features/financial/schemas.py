"""Legacy whole-MMK inputs and exact Decimal reporting responses for workbook v1."""
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Period(Record):
    start: date
    end: date

    @model_validator(mode="after")
    def ordered(self):
        if self.end < self.start:
            raise ValueError("Period end must be on or after start")
        return self


Money = Annotated[int, Field(strict=True, ge=0)]
Quantity = Annotated[int, Field(strict=True, gt=0)]


class Sale(Record):
    sale_id: str
    date: date
    qty: Quantity
    unit_selling_price_mmk: Money
    unit_cost_at_sale_mmk: Money
    payment_type: Literal["cash", "credit"]
    due_date: date | None = None


class Receipt(Record):
    receipt_id: str
    sale_id: str
    date: date
    amount_mmk: Money


class Purchase(Record):
    purchase_id: str
    date: date
    qty: Quantity
    unit_cost_mmk: Money
    payment_type: Literal["cash", "credit"]
    due_date: date | None = None


class SupplierPayment(Record):
    payment_id: str
    purchase_id: str
    date: date
    amount_mmk: Money


class Expense(Record):
    expense_id: str
    date: date
    amount_mmk: Money
    category: str
    payment_status: Literal["paid", "unpaid"]
    due_date: date | None = None
    # Adapter extension: workbook contract has no separate payment date.
    paid_date: date | None = None


class Loan(Record):
    loan_id: str
    disbursement_date: date
    principal_mmk: Money


class LoanPayment(Record):
    payment_id: str
    loan_id: str
    date: date
    principal_paid_mmk: Money
    interest_paid_mmk: Money


class CashAdjustment(Record):
    adjustment_id: str
    date: date
    type: Literal["owner_contribution", "owner_withdrawal", "cash_correction"]
    amount_mmk: Money
    direction: Literal["in", "out"] | None = None


class Obligation(Record):
    kind: Literal["supplier", "expense", "loan"]
    due_date: date | None
    amount_mmk: Decimal = Field(ge=0)
    reference_id: str


class FinancialRecords(Record):
    business_id: str
    opening_cash_mmk: Money | None = None
    opening_cash_date: date | None = None
    sales: tuple[Sale, ...] = ()
    customer_receipts: tuple[Receipt, ...] = ()
    purchases: tuple[Purchase, ...] = ()
    supplier_payments: tuple[SupplierPayment, ...] = ()
    expenses: tuple[Expense, ...] = ()
    loans: tuple[Loan, ...] = ()
    loan_payments: tuple[LoanPayment, ...] = ()
    cash_adjustments: tuple[CashAdjustment, ...] = ()
    # P3 supplies outstanding scheduled payments, never actual cash movements.
    scheduled_obligations: tuple[Obligation, ...] = ()
    loan_schedule_available: bool = False
    available_sheets: frozenset[str] = frozenset()
    as_of: datetime
    import_batch_id: str
    synthetic: bool = True


class Actual(Record):
    revenue_mmk: Decimal | None
    cogs_mmk: Decimal | None
    gross_profit_mmk: Decimal | None
    operating_expenses_mmk: Decimal | None
    operating_profit_mmk: Decimal | None
    interest_expenses_mmk: Decimal | None
    profit_before_tax_mmk: Decimal | None
    cash_balance_mmk: Decimal | None
    receivables_mmk: Decimal | None
    payables_mmk: Decimal | None


class DataQuality(Record):
    status: Literal["complete", "partial", "missing_data"]
    missing_sheets: list[str]
    warnings: list[str]


class FinancialSnapshot(Record):
    business_id: str
    period: Period
    actual: Actual
    upcoming_obligations: list[Obligation]
    data_quality: DataQuality
    as_of: datetime | None
    import_batch_id: str | None
    source_version: int | None = None
    synthetic: bool = False


class TrendPoint(Record):
    period: Period
    revenue_mmk: Decimal | None
    operating_expenses_mmk: Decimal | None
