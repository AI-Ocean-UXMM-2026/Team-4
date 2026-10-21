"""Export-friendly borrower preparation report composition."""

from datetime import date


DISCLAIMER = "Self-reported, synthetic demo; acceptance and eligibility depend on the lender. This is preparation support, not a credit score or loan approval."


def preparation_report(inputs: dict, categories: list[dict], loans: list[dict]) -> dict:
    missing = [item["title"] for item in categories if item["status"] == "missing"]
    dates = [row["date"] for rows in inputs.get("tables", {}).values() for row in rows if row.get("date")]
    period = {"start": min(dates) if dates else None, "end": max(dates) if dates else None}
    return {
        "business_profile": inputs.get("business"),
        "period_covered": period,
        "financial_summary": {"available": False, "note": "Waiting for the P1 financial snapshot integration; no cash or profit figures are estimated here."},
        "outstanding_loans": [{"loan_id": loan["loan_id"], "outstanding_principal_mmk": loan["outstanding_principal_mmk"]} for loan in loans],
        "missing_records": missing,
        "generated_on": date.today(),
        "disclaimer": DISCLAIMER,
    }
