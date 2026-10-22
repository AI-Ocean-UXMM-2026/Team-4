"""Conservative repayment planning based on an upstream P1 cash snapshot."""


def repayment_capacity(p1_cash_context: dict | None, next_payment_due_mmk: str | None) -> dict:
    if not p1_cash_context or p1_cash_context.get("current_cash_mmk") is None or next_payment_due_mmk is None:
        return {
            "status": "insufficient_data",
            "projected_cash_available_before_loan_mmk": None,
            "repayment_gap_mmk": None,
            "explanation": "Cash balances and operating payments from Financial Health are not available yet. Repayment planning uses cash, not profit.",
        }
    # Receipt rows must be explicitly marked confirmed by the upstream owner.
    from decimal import Decimal

    current = Decimal(str(p1_cash_context["current_cash_mmk"]))
    receipts = Decimal(str(p1_cash_context.get("confirmed_receipts_due_before_next_payment_mmk", "0")))
    mandatory = Decimal(str(p1_cash_context.get("mandatory_operating_payments_due_before_next_payment_mmk", "0")))
    reserve = Decimal(str(p1_cash_context.get("protected_reserve_mmk", "0")))
    due = Decimal(next_payment_due_mmk)
    available = current + receipts - mandatory - reserve
    gap = available - due
    return {
        "status": "appears_covered_from_recorded_cash" if gap >= 0 else "potential_shortfall",
        "projected_cash_available_before_loan_mmk": str(available),
        "repayment_gap_mmk": str(gap),
        "explanation": "Planning estimate from recorded cash and confirmed items; it is not an approval or affordability assessment.",
    }
