"""Versioned, business-scoped P2 aggregates for the AI analyzer."""

from ...modules.working_capital.repository import WorkingCapitalRepository


def get_ai_snapshot(business_id: str, sessions) -> dict:
    with sessions.begin() as session:
        # The repository starts the SQLite read snapshot and holds the shared
        # business lock on PostgreSQL while loading all projection tables.
        summary = WorkingCapitalRepository(session).summary(business_id)
    return {
        "business_id": summary["business_id"],
        "source_version": summary["source_version"],
        "as_of": summary["as_of"],
        "synthetic": False,
        "inventory_risks": [
            {
                "stock_coverage_days": item.get("coverage_days"),
                "supplier_lead_days": item.get("supplier_lead_days"),
            }
            for item in summary["inventory"]
        ],
        "slow_moving_stock_count": sum(
            1 for item in summary["inventory"]
            if item.get("slow_moving") and item.get("current_stock_qty", 0) > 0
        ),
    }
