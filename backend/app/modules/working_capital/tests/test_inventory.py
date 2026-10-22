from datetime import date
from decimal import Decimal

from app.db.connection import make_engine, session_factory
from app.db.models import Base, Business, ImportBatch, PROJECTIONS, WorkbookSource
from app.modules.working_capital.inventory import coverage_days, inventory_risk, purchasing_budget, reorder_advice
from app.modules.working_capital.repository import WorkingCapitalRepository
from app.modules.working_capital.schemas import WorkingCapitalSnapshot


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


def test_unlock_cash_inputs_use_only_selected_business_records(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'unlock-cash.db'}")
    Base.metadata.create_all(engine)
    sessions = session_factory(engine)
    with sessions.begin() as session:
        for business_id in ("biz-a", "biz-b"):
            session.add(Business(id=business_id, name=business_id, industry="Retail", city="Yangon"))
            session.flush()
            session.add(WorkbookSource(id=f"source-{business_id}", business_id=business_id))
            session.flush()
            session.add(ImportBatch(id=f"batch-{business_id}", source_id=f"source-{business_id}",
                                    business_id=business_id, actor_id="owner", status="success",
                                    row_counts={}, errors=[], warnings=[]))
            session.flush()
            session.execute(PROJECTIONS["Settings"].insert().values(
                source_id=f"source-{business_id}", business_id=business_id,
                business_name=business_id, currency="MMK", opening_date=date(2026, 10, 1),
                opening_cash_mmk=1000 if business_id == "biz-a" else 0, batch_id=f"batch-{business_id}",
            ))
        session.execute(PROJECTIONS["Products"].insert().values(
            source_id="source-biz-a", business_id="biz-a", product_id="P1", name="Product",
            opening_stock=10, unit_cost_mmk=100, batch_id="batch-biz-a",
        ))
        session.execute(PROJECTIONS["Sales"].insert().values(
            source_id="source-biz-a", business_id="biz-a", sale_id="S1", date=date(2026, 10, 15),
            product_id="P1", quantity=2, unit_price_mmk=150, payment_type="credit",
            cash_received_mmk=0, batch_id="batch-biz-a",
        ))
        session.execute(PROJECTIONS["CustomerReceipts"].insert().values(
            source_id="source-biz-a", business_id="biz-a", receipt_id="R1", date=date(2026, 10, 16),
            sale_id="S1", amount_mmk=50, batch_id="batch-biz-a",
        ))
        for expense_id, amount, business_id in (("E1", 300, "biz-a"), ("E2", 600, "biz-a"),
                                                ("OTHER", 9999, "biz-b")):
            session.execute(PROJECTIONS["Expenses"].insert().values(
                source_id=f"source-{business_id}", business_id=business_id,
                expense_id=expense_id, date=date(2026, 10, 16), category="Marketing",
                description=expense_id, amount_mmk=amount, payment_status="paid",
                paid_date=date(2026, 10, 16), amount_paid_mmk=amount,
                batch_id=f"batch-{business_id}",
            ))
    with sessions() as session:
        summary = WorkingCapitalRepository(session).summary("biz-a")
    inputs = summary["unlock_cash"]
    assert inputs["as_of"] == date(2026, 10, 16)
    assert inputs["stock_value_mmk"] == Decimal("800.00")
    assert inputs["receivables_mmk"] == Decimal("250.00")
    assert inputs["average_weekly_running_cost_mmk"] == Decimal("210.00")
    assert summary["inventory"][0]["unit_cost_mmk"] == Decimal("100.00000")
    assert summary["available_cash_mmk"] == Decimal("150.00")
    assert {item["expense_id"] for item in inputs["expense_candidates"]} == {"E1", "E2"}
    payload = WorkingCapitalSnapshot.model_validate(summary).model_dump(mode="json")
    assert payload["unlock_cash"]["receivables_mmk"] == "250.00000"
    engine.dispose()


def test_unlock_cash_inputs_are_unavailable_without_an_import(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'empty-unlock.db'}")
    Base.metadata.create_all(engine)
    sessions = session_factory(engine)
    with sessions.begin() as session:
        session.add(Business(id="empty", name="Empty", industry="Retail", city="Yangon"))
    with sessions() as session:
        inputs = WorkingCapitalRepository(session).summary("empty")["unlock_cash"]
    assert inputs == {
        "as_of": None, "stock_value_mmk": None, "receivables_mmk": None,
        "expense_candidates": [], "average_weekly_running_cost_mmk": None,
    }
    engine.dispose()
