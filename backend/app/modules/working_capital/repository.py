"""Read-only access to P5's typed workbook projection tables."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from ...db.models import Business, PROJECTIONS
from .inventory import inventory_risk, purchasing_budget


class WorkingCapitalRepository:
    def __init__(self, session):
        self.session = session

    def inventory_snapshot(self, business_id: str, safety_buffer_days: int = 3) -> tuple[list[dict], date | None]:
        products = self.session.execute(select(PROJECTIONS["Products"]).where(PROJECTIONS["Products"].c.business_id == business_id)).mappings().all()
        sales = self.session.execute(select(PROJECTIONS["Sales"]).where(PROJECTIONS["Sales"].c.business_id == business_id)).mappings().all()
        purchases = self.session.execute(select(PROJECTIONS["Purchases"]).where(PROJECTIONS["Purchases"].c.business_id == business_id)).mappings().all()
        as_of = max((row["date"] for row in [*sales, *purchases]), default=None)
        sold_total, purchased_total, sales_30, sales_7 = defaultdict(lambda: Decimal("0")), defaultdict(lambda: Decimal("0")), defaultdict(lambda: Decimal("0")), defaultdict(lambda: Decimal("0"))
        for row in sales:
            quantity = Decimal(row["quantity"])
            sold_total[row["product_id"]] += quantity
            if as_of and row["date"] > as_of - timedelta(days=30): sales_30[row["product_id"]] += quantity
            if as_of and row["date"] > as_of - timedelta(days=7): sales_7[row["product_id"]] += quantity
        for row in purchases:
            purchased_total[row["product_id"]] += Decimal(row["quantity"])
        result = []
        for product in products:
            product_id = product["product_id"]
            stock = Decimal(product["opening_stock"]) + purchased_total[product_id] - sold_total[product_id]
            average_30 = sales_30[product_id] / Decimal("30") if as_of and sales_30[product_id] else None
            average_7 = sales_7[product_id] / Decimal("7") if as_of and sales_7[product_id] else None
            risk = inventory_risk(stock, average_30, None, safety_buffer_days)
            result.append({
                "product_id": product_id, "name": product["name"], "current_stock_qty": stock,
                "average_units_sold_per_day_7": average_7, "average_units_sold_per_day_30": average_30,
                "supplier_lead_days": None, "slow_moving": sales_30[product_id] == 0,
                "slow_moving_rule": "No sales in the 30-day window ending at the latest inventory activity date.", **risk,
            })
        return result, as_of

    def summary(self, business_id: str, safety_buffer_days: int = 3) -> dict:
        business = self.session.get(Business, business_id)
        inventory, as_of = self.inventory_snapshot(business_id, safety_buffer_days)
        return {
            "business_id": business_id, "source_version": business.version if business else None, "as_of": as_of,
            "status": "observed" if inventory else "insufficient_data", "inventory": inventory,
            "purchasing_budget": purchasing_budget(None, None, None),
            "warnings": ["Supplier lead times, mandatory payments and protected reserve are not in workbook v1; purchasing budget is unavailable until supplied as explicit scenario assumptions."],
        }
