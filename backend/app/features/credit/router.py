from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Request
from .amortization import UnsupportedLoanModel, amortization_schedule, round_mmk
from .readiness import preparation_progress, readiness_categories
from .repayment import repayment_totals
from .repayment_capacity import repayment_capacity
from .reports import preparation_report
from .repository import credit_inputs
from .schemas import CreditSnapshot
from .financial_context import financial_cash_context
from ..financial.platform_repository import SqlFinancialRepository
from ...integrations.excel.loan_products import loan_identity_errors

router = APIRouter(prefix="/api/v1/credit", tags=["credit"])
from .documents import router as documents_router
router.include_router(documents_router)


def _serialize_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _loan_items(inputs: dict) -> list[dict]:
    payments_by_loan: dict[str, list[dict]] = {}
    for payment in inputs["payments"]:
        payments_by_loan.setdefault(payment["loan_id"], []).append(payment)
    result = []
    for raw in inputs["loans"]:
        principal = Decimal(str(raw["principal_mmk"]))
        loan_id = raw["loan_id"]
        totals = repayment_totals(payments_by_loan.get(loan_id, []), principal)
        model = raw.get("loan_type") or "unknown"
        rate = raw.get("annual_rate_pct")
        term = raw.get("term_months")
        first_due = raw.get("first_payment_date")
        frequency = raw.get("payment_frequency")
        status, explanation, schedule = "missing_terms", "Supply the bank, loan product, agreed annual interest rate, term, first payment date and payment frequency to estimate repayments.", []
        if model != "reducing_balance":
            status = "unsupported_loan_model"
            if model in {"flat", "interest_only"}:
                explanation = f"The {model} repayment model is not supported for schedule estimates."
            else:
                explanation = "The imported loan type does not provide a supported repayment model; no schedule is estimated."
        elif rate is not None and term is not None and first_due and frequency and not loan_identity_errors(raw):
            try:
                schedule = amortization_schedule(principal, Decimal(str(rate)), int(term), _serialize_date(raw["date"]), model,
                                                 _serialize_date(first_due), frequency)
                status, explanation = "available", None
            except (UnsupportedLoanModel, ValueError) as error:
                status, explanation = "unsupported_loan_model", str(error)
        future = [item for item in schedule if item.due_date >= inputs["as_of"]]
        next_row = future[0] if future else None
        result.append({
            "loan_id": loan_id,
            "lender": raw.get("lender", "Not recorded"),
            "loan_product": raw.get("loan_product"),
            "bank_id": raw.get("bank_id"),
            "loan_product_id": raw.get("loan_product_id"),
            "first_payment_date": _serialize_date(first_due) if first_due else None,
            "payment_frequency": frequency,
            "repayment_model": model,
            "principal_mmk": round_mmk(principal),
            "disbursement_date": _serialize_date(raw["date"]),
            "annual_rate_pct": Decimal(str(rate)) if rate is not None else None,
            "term_months": int(term) if term is not None else None,
            **{key: Decimal(value) for key, value in totals.items()},
            "schedule_status": status,
            "schedule_explanation": explanation,
            "schedule": schedule,
            "actual_payments": [{
                "payment_id": payment["payment_id"],
                "date": _serialize_date(payment["date"]),
                "principal_mmk": round_mmk(Decimal(str(payment["principal_mmk"]))),
                "interest_mmk": round_mmk(Decimal(str(payment["interest_mmk"]))),
            } for payment in payments_by_loan.get(loan_id, [])],
            "next_due_date": next_row.due_date if next_row else None,
            "next_payment_due_mmk": next_row.scheduled_installment_mmk if next_row else None,
            # Workbook payments are actual facts but are not allocated to
            # individual schedule periods. Do not infer paid/missed state.
            "next_payment_status": "unknown" if next_row else "no_future_installment",
        })
    known_ids = {loan["loan_id"] for loan in inputs["loans"]}
    orphan_ids = {payment["loan_id"] for payment in inputs["payments"]} - known_ids
    if orphan_ids:
        raise ValueError("Imported loan payment references a loan that is not present in this business snapshot.")
    return result


def _load_inputs(request: Request, business_id: str) -> dict:
    with request.app.state.sessions() as session:
        return credit_inputs(session, business_id)


@router.get("/summary", response_model=CreditSnapshot)
def summary(request: Request, business_id: str):
    inputs = _load_inputs(request, business_id)
    if inputs["business"] is not None:
        ledger = SqlFinancialRepository(request.app.state.sessions).load_ledger(business_id)
        if ledger.source_version != inputs["source_version"]:
            raise HTTPException(409, "Financial records changed; refresh Credit Hub.")
        inputs["cash_context"] = financial_cash_context(ledger, inputs["as_of"])
    return build_credit_snapshot(inputs, business_id)


def build_credit_snapshot(inputs: dict, business_id: str) -> dict:
    if inputs["business"] is None:
        raise HTTPException(404, "Business not found.")
    try:
        loans = _loan_items(inputs)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    categories = readiness_categories(inputs)
    next_date = min((loan["next_due_date"] for loan in loans if loan["next_due_date"] is not None), default=None)
    due = sum((loan["next_payment_due_mmk"] for loan in loans if loan["next_due_date"] == next_date and loan["next_payment_due_mmk"] is not None), Decimal(0)) if next_date else None
    cash_context = inputs.get("cash_context")
    limitations = ["Imported records and uploaded supporting files remain unverified by lenders."]
    missing_data = []
    if not cash_context or cash_context.get("current_cash_mmk") is None:
        limitations.append("Financial Health is connected, but recorded cash is unavailable. Complete the opening balance and cash payment records.")
        missing_data.append("p1_cash_snapshot")
    else:
        limitations.append("Repayment planning uses Financial Health cash, reserves all outstanding supplier balances and recorded unpaid expenses, and assumes no future customer receipts. Supplier due dates and a protected cash reserve are not recorded.")
    if any(loan["schedule_status"] != "available" for loan in loans):
        limitations.append("Repayment planning is unavailable until every loan has a supported repayment schedule.")
        due = None
    if any(loan["schedule_status"] == "missing_terms" for loan in loans):
        limitations.append("Some imported loans need complete bank, product and repayment terms before a schedule can be estimated.")
        missing_data.append("loan_rate_and_term")
    has_data = bool(inputs["loans"] or any(inputs["tables"].values()))
    return {
        "business_id": business_id,
        "source_version": inputs["source_version"],
        "as_of": inputs["as_of"],
        "lender_checklist_scope": "generic_not_lender_specific",
        "data_quality": {"status": "partial" if has_data else "missing", "missing": missing_data, "limitations": limitations},
        "loans": loans,
        "readiness": categories,
        "readiness_progress": preparation_progress(categories),
        "repayment_capacity": repayment_capacity(cash_context, str(due) if due is not None else None),
        "preparation_report": preparation_report(inputs, categories, loans),
    }


@router.get("/loans")
def loans(request: Request, business_id: str):
    inputs = _load_inputs(request, business_id)
    if inputs["business"] is None:
        raise HTTPException(404, "Business not found.")
    try:
        return {"business_id": business_id, "loans": _loan_items(inputs)}
    except ValueError as error:
        raise HTTPException(409, str(error)) from error


@router.get("/loans/{loan_id}/schedule")
def loan_schedule(request: Request, loan_id: str, business_id: str):
    inputs = _load_inputs(request, business_id)
    if inputs["business"] is None:
        raise HTTPException(404, "Loan not found.")
    loan = next((row for row in inputs["loans"] if row["loan_id"] == loan_id), None)
    if loan is None:
        raise HTTPException(404, "Loan not found.")
    try:
        item = next(row for row in _loan_items(inputs) if row["loan_id"] == loan_id)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    if item["schedule_status"] != "available":
        return {"loan_id": loan_id, "status": item["schedule_status"], "explanation": item["schedule_explanation"], "schedule": []}
    return {"loan_id": loan_id, "status": "available", "schedule": item["schedule"]}


@router.get("/readiness")
def readiness(request: Request, business_id: str):
    result = summary(request, business_id)
    return {"business_id": business_id, "scope": result["lender_checklist_scope"], "data_quality": result["data_quality"],
            "readiness": result["readiness"], "progress": result["readiness_progress"], "report": result["preparation_report"]}
