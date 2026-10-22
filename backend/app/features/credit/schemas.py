from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class DataQuality(BaseModel):
    status: Literal["complete", "partial", "missing"]
    missing: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class ScheduleLine(BaseModel):
    period: int
    due_date: date
    scheduled_installment_mmk: Decimal
    principal_due_mmk: Decimal
    interest_due_mmk: Decimal
    projected_principal_mmk: Decimal


class ActualPayment(BaseModel):
    payment_id: str
    date: date
    principal_mmk: Decimal
    interest_mmk: Decimal


class LoanSummary(BaseModel):
    loan_id: str
    lender: str
    loan_product: str | None = None
    bank_id: str | None = None
    loan_product_id: str | None = None
    first_payment_date: date | None = None
    payment_frequency: str | None = None
    repayment_model: str
    principal_mmk: Decimal
    disbursement_date: date
    annual_rate_pct: Decimal | None = None
    term_months: int | None = None
    actual_principal_paid_mmk: Decimal
    actual_interest_paid_mmk: Decimal
    outstanding_principal_mmk: Decimal
    schedule_status: Literal["available", "unsupported_loan_model", "missing_terms"]
    schedule_explanation: str | None = None
    schedule: list[ScheduleLine] = Field(default_factory=list)
    actual_payments: list[ActualPayment] = Field(default_factory=list)
    next_due_date: date | None = None
    next_payment_due_mmk: Decimal | None = None
    next_payment_status: Literal["unpaid", "no_future_installment", "unknown"]


class ReadinessCategory(BaseModel):
    category: str
    title: str
    status: Literal["missing", "uploaded_unverified", "reviewed", "not_applicable"]
    source: Literal["excel_imported", "user_entered", "lender_verified", "none"]
    record_count: int
    period_start: date | None = None
    period_end: date | None = None
    coverage_months: int = 0
    months_without_records: list[str] = Field(default_factory=list)
    note: str | None = None


class CreditSnapshot(BaseModel):
    recorded_balances: list[dict] = Field(default_factory=list)
    business_id: str
    source_version: int
    as_of: date
    lender_checklist_scope: Literal["generic_not_lender_specific"]
    data_quality: DataQuality
    loans: list[LoanSummary]
    readiness: list[ReadinessCategory]
    readiness_progress: dict
    repayment_capacity: dict
    preparation_report: dict
