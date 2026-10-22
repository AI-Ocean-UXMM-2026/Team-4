from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select

from ...core.dependencies import authorize_business
from ...db.models import RecordedLoanBalance
from ...integrations.excel.import_service import lock_business
from ...integrations.excel.loan_products import normalize, BANKS
from .repository import credit_inputs

router = APIRouter()


class LoanBalanceInput(BaseModel):
    lender_kind: Literal["bank", "individual"]
    lender_name: str = Field(min_length=1, max_length=200)
    outstanding_principal_mmk: Decimal = Field(gt=0, le=999999999999, decimal_places=2)
    as_of_date: date
    loan_start_date: date | None = None
    loan_end_date: date | None = None
    bank_id: str | None = None
    loan_product_id: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def matching_bank_product(self):
        if self.loan_start_date and self.loan_start_date > self.as_of_date:
            raise ValueError("Loan start date cannot be after the balance date.")
        if self.loan_end_date and self.loan_start_date and self.loan_end_date < self.loan_start_date:
            raise ValueError("Loan end date cannot be before the loan start date.")
        if self.loan_end_date and self.loan_end_date < self.as_of_date:
            raise ValueError("Loan end date cannot be before the balance date.")
        if self.lender_kind == "individual":
            if self.bank_id or self.loan_product_id:
                raise ValueError("Bank products do not apply to an individual lender.")
        elif self.bank_id:
            bank = BANKS.get(self.bank_id)
            if not bank or normalize(self.lender_name) not in bank["aliases"]:
                raise ValueError("Select a valid bank.")
            catalog_product_ids = {product["id"] for item in BANKS.values() for product in item["products"]}
            bank_product_ids = {product["id"] for product in bank["products"]}
            if self.loan_product_id in catalog_product_ids and self.loan_product_id not in bank_product_ids:
                raise ValueError("Loan product does not belong to the selected bank.")
            # Catalog products retain their stable IDs. A non-catalog value is a
            # user-entered product name for a bank or product not in the catalog.
        return self

    @field_validator("lender_name")
    @classmethod
    def name_not_blank(cls, value):
        if not value.strip():
            raise ValueError("Enter the lender name.")
        return value.strip()

    @field_validator("as_of_date")
    @classmethod
    def date_not_future(cls, value):
        if value > datetime.now(timezone(timedelta(hours=6, minutes=30))).date():
            raise ValueError("Balance date cannot be in the future.")
        return value


def balance_item(row):
    return {"id": row.id, "lender_kind": row.lender_kind, "lender_name": row.lender_name,
            "loan_start_date": row.loan_start_date.isoformat() if row.loan_start_date else None,
            "loan_end_date": row.loan_end_date.isoformat() if row.loan_end_date else None,
            "bank_id": row.bank_id, "loan_product_id": row.loan_product_id,
            "next_payment_date": row.next_payment_date.isoformat() if row.next_payment_date else None,
            "next_payment_mmk": str(row.next_payment_mmk) if row.next_payment_mmk is not None else None,
            "payment_frequency": row.payment_frequency,
            "annual_rate_pct": str(row.annual_rate_pct) if row.annual_rate_pct is not None else None,
            "remaining_term_months": row.remaining_term_months,
            "repayment_terms": row.repayment_terms,
            "outstanding_principal_mmk": str(row.outstanding_principal_mmk), "as_of_date": row.as_of_date.isoformat()}


@router.post("/recorded-balances")
def record_balance(payload: LoanBalanceInput, request: Request, business_id: str, _user=Depends(authorize_business)):
    with request.app.state.sessions.begin() as session:
        lock_business(session, business_id)
        existing = session.scalars(select(RecordedLoanBalance).where(RecordedLoanBalance.business_id == business_id)).all()
        if any(row.lender_kind == payload.lender_kind and normalize(row.lender_name) == normalize(payload.lender_name) for row in existing):
            raise HTTPException(409, "A balance for this lender is already recorded. Review the existing record before adding another.")
        row = RecordedLoanBalance(business_id=business_id, **payload.model_dump())
        session.add(row)
        session.flush()
        return balance_item(row)


class RepaymentTerms(BaseModel):
    rate_period: Literal["annual", "monthly"]
    entered_rate_pct: Decimal = Field(ge=0, le=1000, decimal_places=3)
    interest_method: Literal["reducing_balance", "flat", "interest_only", "other"]
    regular_payment_mmk: Decimal = Field(gt=0, le=999999999999, decimal_places=2)
    next_payment_fees_mmk: Decimal = Field(ge=0, le=999999999999, decimal_places=2)
    balloon_payment_mmk: Decimal = Field(ge=0, le=999999999999, decimal_places=2)
    grace_months: int = Field(ge=0, le=1200)


class NextPaymentInput(BaseModel):
    repayment_terms: RepaymentTerms | None = None
    outstanding_principal_mmk: Decimal | None = Field(default=None, gt=0, le=999999999999, decimal_places=2)
    as_of_date: date | None = None
    annual_rate_pct: Decimal = Field(ge=0, le=1000, decimal_places=3)
    remaining_term_months: int = Field(ge=1, le=1200)
    next_payment_date: date
    next_payment_mmk: Decimal = Field(gt=0, le=999999999999, decimal_places=2)
    payment_frequency: Literal["monthly", "biweekly", "weekly", "one_time", "other"]


class BalanceUpdate(BaseModel):
    outstanding_principal_mmk: Decimal = Field(gt=0, le=999999999999, decimal_places=2)
    as_of_date: date
    loan_start_date: date | None = None
    loan_end_date: date | None = None
    final_payment_date: date | None = None

    @field_validator("as_of_date")
    @classmethod
    def date_not_future(cls, value):
        return LoanBalanceInput.date_not_future(value)


@router.put("/recorded-balances/{balance_id}")
def edit_balance(balance_id: str, payload: BalanceUpdate, request: Request, business_id: str, _user=Depends(authorize_business)):
    with request.app.state.sessions.begin() as session:
        lock_business(session, business_id)
        row = session.scalar(select(RecordedLoanBalance).where(RecordedLoanBalance.id == balance_id, RecordedLoanBalance.business_id == business_id))
        if row is None:
            raise HTTPException(404, "Loan balance not found.")
        effective_start_date = payload.loan_start_date if "loan_start_date" in payload.model_fields_set else row.loan_start_date
        effective_end_date = payload.loan_end_date if "loan_end_date" in payload.model_fields_set else row.loan_end_date
        if effective_start_date and payload.as_of_date < effective_start_date:
            raise HTTPException(400, "Balance date cannot precede the loan start date.")
        if effective_end_date and effective_start_date and effective_end_date < effective_start_date:
            raise HTTPException(400, "Loan end date cannot precede the loan start date.")
        if effective_end_date and effective_end_date < payload.as_of_date:
            raise HTTPException(400, "Loan end date cannot precede the balance date.")
        if row.next_payment_date and payload.as_of_date > row.next_payment_date:
            raise HTTPException(400, "Update the next payment date before moving the balance date beyond it.")
        if "final_payment_date" in payload.model_fields_set:
            if not payload.final_payment_date or row.payment_frequency != "monthly" or not row.next_payment_date:
                raise HTTPException(400, "A final payment date requires a monthly payment schedule.")
            remaining_months = ((payload.final_payment_date.year - row.next_payment_date.year) * 12
                                + payload.final_payment_date.month - row.next_payment_date.month + 1)
            if remaining_months < 1 or remaining_months > 1200:
                raise HTTPException(400, "Final payment date must be on or after the next payment date.")
            row.remaining_term_months = remaining_months
        row.outstanding_principal_mmk = payload.outstanding_principal_mmk
        row.as_of_date = payload.as_of_date
        if "loan_start_date" in payload.model_fields_set:
            row.loan_start_date = payload.loan_start_date
        if "loan_end_date" in payload.model_fields_set:
            row.loan_end_date = payload.loan_end_date
        session.flush()
        return balance_item(row)


@router.delete("/recorded-balances/{balance_id}")
def delete_balance(balance_id: str, request: Request, business_id: str, _user=Depends(authorize_business)):
    with request.app.state.sessions.begin() as session:
        lock_business(session, business_id)
        row = session.scalar(select(RecordedLoanBalance).where(RecordedLoanBalance.id == balance_id, RecordedLoanBalance.business_id == business_id))
        if row is None:
            raise HTTPException(404, "Loan balance not found.")
        session.delete(row)
    return {"deleted": True}


@router.put("/recorded-balances/{balance_id}/next-payment")
def update_next_payment(balance_id: str, payload: NextPaymentInput, request: Request, business_id: str, _user=Depends(authorize_business)):
    with request.app.state.sessions.begin() as session:
        lock_business(session, business_id)
        row = session.scalar(select(RecordedLoanBalance).where(RecordedLoanBalance.id == balance_id, RecordedLoanBalance.business_id == business_id))
        if row is None:
            raise HTTPException(404, "Loan balance not found.")
        effective_date = payload.as_of_date or row.as_of_date
        if effective_date > datetime.now(timezone(timedelta(hours=6, minutes=30))).date():
            raise HTTPException(400, "Balance date cannot be in the future.")
        if payload.next_payment_date < effective_date:
            raise HTTPException(400, "Next payment date cannot precede the recorded balance date.")
        if payload.repayment_terms:
            terms = payload.repayment_terms
            expected_rate = terms.entered_rate_pct * (12 if terms.rate_period == "monthly" else 1)
            if expected_rate != payload.annual_rate_pct:
                raise HTTPException(400, "Interest rate does not match its stated period.")
            if terms.regular_payment_mmk + terms.next_payment_fees_mmk != payload.next_payment_mmk:
                raise HTTPException(400, "Next payment must equal the regular instalment plus fees.")
            if terms.balloon_payment_mmk > (payload.outstanding_principal_mmk or row.outstanding_principal_mmk):
                raise HTTPException(400, "Final principal payment cannot exceed outstanding principal.")
            if terms.grace_months > payload.remaining_term_months:
                raise HTTPException(400, "Grace period cannot exceed remaining term.")
            row.repayment_terms = terms.model_dump(mode="json")
        else:
            row.repayment_terms = None
        if payload.outstanding_principal_mmk is not None:
            row.outstanding_principal_mmk = payload.outstanding_principal_mmk
        row.as_of_date = effective_date
        row.next_payment_date = payload.next_payment_date
        row.next_payment_mmk = payload.next_payment_mmk
        row.payment_frequency = payload.payment_frequency
        row.annual_rate_pct = payload.annual_rate_pct
        row.remaining_term_months = payload.remaining_term_months
        session.flush()
        return balance_item(row)
