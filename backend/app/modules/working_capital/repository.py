"""Read-only access to P5's typed workbook projection tables."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from ...db.models import Business, ImportBatch, PROJECTIONS
from ...features.financial.platform import calculate_platform_snapshot
from ...features.financial.platform_repository import Ledger
from ...features.financial.schemas import Period
from .inventory import inventory_risk, money, purchasing_budget


class WorkingCapitalRepository:
    def __init__(self, session):
        self.session = session

    def inventory_snapshot(self, business_id: str, safety_buffer_days: int = 3,
                           tables: dict[str, list[dict]] | None = None) -> tuple[list[dict], date | None]:
        if tables is None:
            tables = {
                name: [dict(row) for row in self.session.execute(select(PROJECTIONS[name]).where(PROJECTIONS[name].c.business_id == business_id)).mappings()]
                for name in ("Products", "Sales", "Purchases")
            }
        products, sales, purchases = (tables[name] for name in ("Products", "Sales", "Purchases"))
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
                "unit_cost_mmk": product.get("unit_cost_mmk"),
                "average_units_sold_per_day_7": average_7, "average_units_sold_per_day_30": average_30,
                "supplier_lead_days": None, "slow_moving": sales_30[product_id] == 0,
                "slow_moving_rule": "No sales in the 30-day window ending at the latest inventory activity date.", **risk,
            })
        return result, as_of

    def summary(self, business_id: str, safety_buffer_days: int = 3) -> dict:
        # Hold the business row while reading projections, matching the import lock.
        if self.session.bind.dialect.name == "sqlite":
            self.session.connection().exec_driver_sql("BEGIN")
        business = self.session.scalar(
            select(Business).where(Business.id == business_id).with_for_update(read=True)
        )
        tables = {
            name: [dict(row) for row in self.session.execute(select(table).where(table.c.business_id == business_id)).mappings()]
            for name, table in PROJECTIONS.items()
        }
        inventory, as_of = self.inventory_snapshot(business_id, safety_buffer_days, tables)
        batch = self.session.scalar(
            select(ImportBatch).where(ImportBatch.business_id == business_id, ImportBatch.status == "success")
            .order_by(ImportBatch.created_at.desc(), ImportBatch.id.desc()).limit(1)
        )
        settings = tables.get("Settings", [])
        activity_dates = [
            row["date"] for name in ("Sales", "Purchases", "CustomerReceipts", "SupplierPayments",
                                     "Expenses", "Loans", "LoanPayments", "CashAdjustments")
            for row in tables.get(name, [])
        ]
        report_date = max(activity_dates, default=settings[0]["opening_date"] if settings else None)
        stock_value = None
        receivables = None
        expense_candidates = []
        weekly_cost = None
        available_cash = None
        if batch is not None and report_date is not None:
            products_by_id = {row["product_id"]: row for row in tables["Products"]}
            if inventory and all(
                Decimal(item["current_stock_qty"]) >= 0
                and products_by_id[item["product_id"]].get("unit_cost_mmk") is not None
                for item in inventory
            ):
                stock_value = money(sum(
                    (Decimal(item["current_stock_qty"]) * Decimal(products_by_id[item["product_id"]]["unit_cost_mmk"])
                     for item in inventory), Decimal("0")
                ))
            financial = calculate_platform_snapshot(
                Ledger(business_id=business_id, source_version=business.version if business else 0,
                       tables=tables, as_of=None, import_batch_id=batch.id),
                Period(start=report_date, end=report_date),
            )
            receivables = financial.actual.receivables_mmk
            available_cash = financial.actual.cash_balance_mmk
            window_start = report_date - timedelta(days=29)
            recent_expenses = [
                row for row in tables["Expenses"] if window_start <= row["date"] <= report_date
            ]
            expense_candidates = [
                {"expense_id": row["expense_id"], "category": row["category"],
                 "description": row["description"], "amount_mmk": row["amount_mmk"]}
                for row in sorted(recent_expenses, key=lambda row: (row["date"], row["expense_id"]), reverse=True)
            ]
            if recent_expenses:
                weekly_cost = money(sum((Decimal(row["amount_mmk"]) for row in recent_expenses), Decimal("0")) * Decimal(7) / Decimal(30))
        return {
            "business_id": business_id, "source_version": business.version if business else None, "as_of": as_of,
            "status": "observed" if inventory else "insufficient_data", "inventory": inventory,
            "purchasing_budget": purchasing_budget(None, None, None),
            "available_cash_mmk": available_cash,
            "unlock_cash": {
                "as_of": report_date if batch is not None else None,
                "stock_value_mmk": stock_value,
                "receivables_mmk": receivables,
                "expense_candidates": expense_candidates,
                "average_weekly_running_cost_mmk": weekly_cost,
            },
            "warnings": ["Supplier lead times, mandatory payments and protected reserve are not in workbook v1; purchasing budget is unavailable until supplied as explicit scenario assumptions."],
        }
