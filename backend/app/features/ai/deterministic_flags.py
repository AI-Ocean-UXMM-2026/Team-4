"""Conservative, auditable flags built only from allowlisted snapshot metrics."""
from decimal import Decimal

from .schemas import Evidence, Insight


def flags(context: dict) -> list[Insight]:
    values: dict[str, Decimal] = context["metrics"]
    found: list[Insight] = []

    def add(identifier, category, priority, title, explanation, names, action, assumption):
        found.append(Insight(
            id=identifier, category=category, priority=priority, title=title,
            explanation=explanation,
            evidence=[Evidence(metric=name, value=values[name]) for name in names],
            suggested_actions=[action], assumptions=[assumption],
        ))

    cash, due = values.get("cash_balance_mmk"), values.get("supplier_due_30d_mmk")
    if cash is not None and due is not None and due > 0 and cash < due:
        add("supplier-shortfall", "liquidity", "high",
            "Review upcoming supplier payments",
            "Recorded cash is below dated supplier obligations within the next month.",
            ["cash_balance_mmk", "supplier_due_30d_mmk"],
            "Confirm payment dates and discuss timing options with suppliers.",
            "Other cash flows and undated obligations may change this comparison.")

    receivables = values.get("receivables_mmk")
    if receivables is not None and receivables > 0:
        add("receivables-followup", "liquidity", "medium",
            "Review outstanding receivables",
            "The financial snapshot records unpaid customer balances.",
            ["receivables_mmk"],
            "Check invoice terms and confirm expected collection dates.",
            "The workbook does not establish whether these balances are overdue.")

    stock = values.get("stockout_review_count")
    if stock is not None and stock > 0:
        add("stockout-review", "working_capital", "medium",
            "Review stock coverage",
            "Some products have recorded coverage below their supplied lead time.",
            ["stockout_review_count"],
            "Check demand and supplier lead times before changing purchase plans.",
            "Coverage and lead-time estimates may change.")

    loan_count = values.get("loan_count")
    gap = values.get("repayment_difference_mmk")
    if loan_count is not None and loan_count > 0 and gap is not None and gap < 0:
        add("repayment-review", "credit", "high",
            "Review scheduled loan payment",
            "The credit module reports a negative cash comparison for a scheduled payment.",
            ["repayment_available_cash_mmk", "repayment_due_mmk", "repayment_difference_mmk"],
            "Verify the repayment schedule and review cash plans with the lender.",
            "This is a planning indicator, not a default or eligibility finding.")

    if context["warnings"] and values:
        metric = next(iter(values))
        add("data-quality", "data_quality", "low",
            "Check incomplete source data",
            "Some source information is missing or has quality warnings.",
            [metric], "Review the source module before relying on this analysis.",
            "Insights use only fields that the source modules supplied.")
    return found[:5]
