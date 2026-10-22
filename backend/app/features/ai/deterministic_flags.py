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
            "Check the dated supplier payments in Data Source, confirm each payment date, and discuss timing with suppliers before committing to new purchases.",
            "Other cash flows and undated obligations may change this comparison.")

    receivables = values.get("receivables_mmk")
    if receivables is not None and receivables > 0:
        add("receivables-followup", "liquidity", "medium",
            "Review outstanding receivables",
            "The financial snapshot records unpaid customer balances.",
            ["receivables_mmk"],
            "Check unpaid sales and customer receipts in your workbook, confirm expected payment dates with customers, then import updated receipts after collection.",
            "The workbook does not establish whether these balances are overdue.")

    payables = values.get("payables_mmk")
    if payables is not None and payables > 0:
        add("supplier-balances", "working_capital", "medium",
            "Review outstanding supplier balances",
            "The financial snapshot records unpaid purchase balances.",
            ["payables_mmk"],
            "Check unpaid purchases and supplier payments in your workbook, confirm due dates with suppliers, then import updated payments when made.",
            "The workbook does not contain supplier due dates.")

    slow_stock = values.get("slow_moving_stock_count")
    if slow_stock is not None and slow_stock > 0:
        add("slow-stock-review", "working_capital", "medium",
            "Review stock with no recent sales",
            "The inventory module found stock on hand with no sales in its observed thirty-day window.",
            ["slow_moving_stock_count"],
            "Open Working Capital to identify stock with no recent sales, check demand, and test a small promotion before buying more stock.",
            "No recent sales does not establish that the stock is unsellable.")

    stock = values.get("stockout_review_count")
    if stock is not None and stock > 0:
        add("stockout-review", "working_capital", "medium",
            "Review stock coverage",
            "Some products have recorded coverage below their supplied lead time.",
            ["stockout_review_count"],
            "Open Working Capital to review low stock coverage, then confirm demand and supplier lead times before placing an order.",
            "Coverage and lead-time estimates may change.")

    loan_count = values.get("loan_count")
    gap = values.get("repayment_difference_mmk")
    if loan_count is not None and loan_count > 0 and gap is not None and gap < 0:
        add("repayment-review", "credit", "high",
            "Review scheduled loan payment",
            "The credit module reports a negative cash comparison for a scheduled payment.",
            ["repayment_available_cash_mmk", "repayment_due_mmk", "repayment_difference_mmk"],
            "Open Credit Hub, compare the recorded repayment with the lender statement, and discuss a cash plan with the lender.",
            "This is a planning indicator, not a default or eligibility finding.")

    outstanding = values.get("outstanding_principal_mmk")
    missing_terms = values.get("missing_schedule_terms_count")
    if outstanding is not None and outstanding > 0 and missing_terms is not None and missing_terms > 0:
        add("loan-terms-review", "credit", "medium",
            "Complete the loan terms for repayment planning",
            "Recorded principal remains outstanding, but the credit module lacks terms for a repayment schedule.",
            ["outstanding_principal_mmk", "missing_schedule_terms_count"],
            "Open Credit Hub to review recorded repayments, then check the loan agreement for its rate and term before using a future payment estimate.",
            "Recorded payments do not establish the future schedule or lender eligibility.")

    if context["warnings"] and values:
        metric = next(iter(values))
        add("data-quality", "data_quality", "low",
            "Check incomplete source data",
            "Some source information is missing or has quality warnings.",
            [metric], "Open Data Source to review import warnings, correct the source workbook where possible, and import it again before relying on missing figures.",
            "Insights use only fields that the source modules supplied.")
    return found[:5]
