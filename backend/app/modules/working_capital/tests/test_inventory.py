from datetime import date
from decimal import Decimal

from app.db.connection import make_engine, session_factory
from app.db.models import Base, Business, ImportBatch, PROJECTIONS, WorkbookSource
from app.modules.working_capital.inventory import coverage_days, inventory_risk, purchasing_budget, reorder_advice
from app.modules.working_capital.repository import WorkingCapitalRepository


def test_stockout_risk_uses_coverage_below_lead_plus_buffer():
    result = inventory_risk(Decimal("12"), Decimal("5"), supplier_lead_days=4, safety_buffer_days=0)
    assert result["coverage_days"] == Decimal("2.4")
    assert result["stockout_risk"] is True


def test_no_recent_sales_is_not_zero_or_infinite_coverage():
    days, status = coverage_days(Decimal("12"), Decimal("0"))
    assert days is None
    assert status == "no_recent_sales"


def test_budget_protects_obligations_and_reserve():
    assert purchasing_budget(Decimal("500"), Decimal("300"), Decimal("250"))["budget_mmk"] == Decimal("0.00")


def test_reorder_is_capped_and_does_not_break_minimum_order():
    result = reorder_advice(Decimal("5"), Decimal("0"), 4, 0, Decimal("100"), Decimal("250"), Decimal("5"))
    assert result["recommended_qty"] == Decimal("0.000")
    assert result["minimum_order_not_affordable"] is True


def test_inventory_as_of_uses_latest_sale_or_purchase_activity(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'inventory.db'}")
    Base.metadata.create_all(engine)
    sessions = session_factory(engine)
    with sessions.begin() as session:
        session.add(Business(id="biz", name="Business", industry="Retail", city="Yangon"))
        session.flush()
        session.add(WorkbookSource(id="source", business_id="biz"))
        session.flush()
        session.add(ImportBatch(id="batch", source_id="source", business_id="biz", actor_id="owner",
                                status="success", row_counts={}, errors=[], warnings=[]))
        session.flush()
        session.execute(PROJECTIONS["Products"].insert().values(
            source_id="source", business_id="biz", product_id="P1", name="Product",
            opening_stock=10, unit_cost_mmk=100, batch_id="batch",
        ))
        session.execute(PROJECTIONS["Sales"].insert().values(
            source_id="source", business_id="biz", sale_id="S1", date=date(2026, 10, 1),
            product_id="P1", quantity=2, unit_price_mmk=150, payment_type="cash",
            cash_received_mmk=300, batch_id="batch",
        ))
        session.execute(PROJECTIONS["Purchases"].insert().values(
            source_id="source", business_id="biz", purchase_id="B1", date=date(2026, 10, 15),
            product_id="P1", quantity=5, unit_cost_mmk=100, payment_type="cash",
            cash_paid_mmk=500, batch_id="batch",
        ))
    with sessions() as session:
        items, as_of = WorkingCapitalRepository(session).inventory_snapshot("biz")
    assert as_of == date(2026, 10, 15)
    assert items[0]["current_stock_qty"] == Decimal("13.000")
    engine.dispose()
