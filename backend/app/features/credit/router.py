from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Request
from .amortization import UnsupportedLoanModel, amortization_schedule, round_mmk
from .readiness import readiness_categories
from .repayment import repayment_totals
from .repayment_capacity import repayment_capacity
from .reports import preparation_report
from .repository import credit_inputs
from .schemas import CreditSnapshot

router = APIRouter(prefix="/api/v1/credit", tags=["credit"])


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
        status, explanation, schedule = "missing_terms", "The imported workbook does not include interest rate and term, so no repayment schedule is estimated.", []
        if model != "reducing_balance":
            status, explanation = "unsupported_loan_model", f"The {model} repayment model is not supported for schedule estimates."
        elif rate is not None and term is not None:
            try:
                schedule = amortization_schedule(principal, Decimal(str(rate)), int(term), _serialize_date(raw["date"]), model)
                status, explanation = "available", None
            except (UnsupportedLoanModel, ValueError) as error:
                status, explanation = "unsupported_loan_model", str(error)
        future = [item for item in schedule if item.due_date >= inputs["as_of"]]
        next_row = future[0] if future else None
        result.append({
            "loan_id": loan_id,
            "lender": raw.get("lender", "Not recorded"),
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
    if inputs["business"] is None:
        raise HTTPException(404, "Business not found.")
    try:
        loans = _loan_items(inputs)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    categories = readiness_categories(inputs)
    prepared = sum(item["status"] != "missing" for item in categories)
    due = next((loan["next_payment_due_mmk"] for loan in loans if loan["next_payment_due_mmk"] is not None), None)
    limitations = ["No credit-document metadata store exists yet; imported records remain unverified.",
                   "P1 cash context is not available in the current repository integration."]
    missing_data = ["p1_cash_snapshot", "document_metadata"]
    if any(loan["schedule_status"] == "missing_terms" for loan in loans):
        limitations.append("The workbook v1 loan columns do not include interest rate or term; schedules are unavailable until those terms are supplied.")
        missing_data.append("loan_rate_and_term")
    has_data = bool(inputs["loans"] or any(inputs["tables"].values()))
    return {
        "business_id": business_id,
        "as_of": inputs["as_of"],
        "lender_checklist_scope": "generic_not_lender_specific",
        "data_quality": {"status": "partial" if has_data else "missing", "missing": missing_data, "limitations": limitations},
        "loans": loans,
        "readiness": categories,
        "readiness_progress": {"prepared_categories": prepared, "total_categories": len(categories), "label": "Record preparation progress", "credit_score": None, "approval_probability": None},
        "repayment_capacity": repayment_capacity(None, str(due) if due is not None else None),
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
