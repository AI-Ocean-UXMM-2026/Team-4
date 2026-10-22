"""Allowlist only non-identifying aggregate fields for rules and model input."""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from .schemas import SnapshotBundle


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        result = Decimal(str(value))
        return result if result.is_finite() else None
    except (InvalidOperation, ValueError):
        return None


def build_context(bundle: SnapshotBundle) -> dict:
    metrics: dict[str, Decimal] = {}
    warnings: list[str] = []
    as_of: datetime | None = None
    supplied = [item for item in (bundle.financial, bundle.working_capital, bundle.credit) if item]
    synthetic = bool(supplied) and all(item.get("synthetic") is True for item in supplied)
    financial = bundle.financial or {}
    if financial and financial.get("business_id") != bundle.business_id:
        raise PermissionError("Cross-business financial snapshot")
    if financial:
        as_of = financial.get("as_of")
        actual = financial.get("actual") or {}
        for name in ("cash_balance_mmk", "receivables_mmk", "payables_mmk",
                     "revenue_mmk", "profit_before_tax_mmk"):
            value = number(actual.get(name))
            if value is not None:
                metrics[name] = value
        quality = financial.get("data_quality") or {}
        if quality.get("status") != "complete":
            warnings.append("Financial snapshot is partial or missing.")
        # Never pass arbitrary workbook or import warning text to a model.
        if quality.get("warnings"):
            warnings.append("Financial source contains data-quality warnings.")
        soon_due = Decimal(0)
        has_dated_due = False
        today = date.today()
        for item in financial.get("upcoming_obligations") or []:
            if item.get("kind") != "supplier" or not item.get("due_date"):
                continue
            try:
                due = date.fromisoformat(str(item["due_date"]))
            except ValueError:
                continue
            value = number(item.get("amount_mmk"))
            if value is not None and value >= 0 and today <= due <= date.fromordinal(today.toordinal() + 30):
                soon_due += value
                has_dated_due = True
        if has_dated_due:
            metrics["supplier_due_30d_mmk"] = soon_due
    else:
        warnings.append("Financial snapshot is unavailable.")
    working = bundle.working_capital or {}
    if working and working.get("business_id") != bundle.business_id:
        raise PermissionError("Cross-business working-capital snapshot")
    if working:
        slow_stock = number(working.get("slow_moving_stock_count"))
        if slow_stock is not None and slow_stock >= 0:
            metrics["slow_moving_stock_count"] = slow_stock
        risks = working.get("inventory_risks") or []
        count = sum(
            1 for item in risks
            if number(item.get("stock_coverage_days")) is not None
            and number(item.get("supplier_lead_days")) is not None
            and number(item["stock_coverage_days"]) < number(item["supplier_lead_days"])
        )
        metrics["stockout_review_count"] = Decimal(count)
        cycle = working.get("cash_conversion_cycle") or {}
        ccc = number(cycle.get("ccc_days"))
        if ccc is not None:
            metrics["ccc_days"] = ccc
    credit = bundle.credit or {}
    if credit and credit.get("business_id") != bundle.business_id:
        raise PermissionError("Cross-business credit snapshot")
    if credit:
        loans = credit.get("loans") or []
        metrics["loan_count"] = Decimal(len(loans))
        outstanding = number(credit.get("outstanding_principal_mmk"))
        missing_terms = number(credit.get("missing_schedule_terms_count"))
        if outstanding is not None and outstanding >= 0:
            metrics["outstanding_principal_mmk"] = outstanding
        if missing_terms is not None and missing_terms >= 0:
            metrics["missing_schedule_terms_count"] = missing_terms
        repayment = credit.get("repayment") or {}
        if loans and repayment.get("assessment") and repayment.get("assessment") != "unavailable":
            for source, target in (("available_cash_mmk", "repayment_available_cash_mmk"),
                                   ("upcoming_due_mmk", "repayment_due_mmk"),
                                   ("difference_mmk", "repayment_difference_mmk")):
                value = number(repayment.get(source))
                if value is not None:
                    metrics[target] = value
    return {
        "metrics": metrics,
        "warnings": warnings,
        "data_as_of": as_of,
        "synthetic": synthetic,
        "source_version": bundle.source_version,
    }
