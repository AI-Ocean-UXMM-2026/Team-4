from sqlalchemy import select
from app.db.models import PROJECTIONS
from app.integrations.excel.workbook_parser import parse_workbook
from app.integrations.excel.validators import validate_workbook
from conftest import edit_workbook


def add_balance(workbook):
    sheet = workbook.create_sheet("CashBalances")
    sheet.append(["balance_id", "business_id", "as_of_date", "cash_on_hand_mmk", "bank_balance_mmk"])
    sheet.append(["CB-20261022", "tea-shop", "2026-10-22", 500000, 1500000])


def test_cash_balances_validate_and_legacy_files_still_work(workbook_bytes):
    assert validate_workbook(parse_workbook(workbook_bytes), "tea-shop") == []
    content = edit_workbook(workbook_bytes, add_balance)
    parsed = parse_workbook(content)
    assert validate_workbook(parsed, "tea-shop") == []
    assert parsed.sheets["CashBalances"][0].values["cash_on_hand_mmk"] == "500000.00"


def test_negative_amount_and_duplicate_date_rejected(workbook_bytes):
    def negative(workbook):
        add_balance(workbook)
        workbook["CashBalances"]["D2"] = -1
    assert parse_workbook(edit_workbook(workbook_bytes, negative)).errors
    def duplicate(workbook):
        add_balance(workbook)
        workbook["CashBalances"].append(["CB-SECOND", "tea-shop", "2026-10-22", 0, 1])
    errors = validate_workbook(parse_workbook(edit_workbook(workbook_bytes, duplicate)), "tea-shop")
    assert any(item["field"] == "as_of_date" for item in errors)


def test_balance_is_stored_without_changing_calculated_cash(tmp_path, workbook_bytes):
    from app.db.connection import make_engine, session_factory
    from app.db.models import Base, Business
    from app.integrations.excel.import_service import import_validated_snapshot
    from app.features.financial.platform_repository import SqlFinancialRepository
    from app.features.financial.platform import calculate_platform_snapshot
    from app.features.financial.schemas import Period
    from datetime import date
    engine = make_engine(f"sqlite:///{tmp_path / 'balances.db'}")
    Base.metadata.create_all(engine)
    sessions = session_factory(engine)
    with sessions.begin() as session:
        session.add(Business(id="tea-shop", name="Tea Shop", industry="Retail", city="Yangon"))
    import_validated_snapshot(sessions, "tea-shop", "tester", workbook_bytes)
    repository = SqlFinancialRepository(sessions)
    period = Period(start=date(2026, 10, 1), end=date(2026, 10, 22))
    before = calculate_platform_snapshot(repository.load_ledger("tea-shop"), period).actual.cash_balance_mmk
    import_validated_snapshot(sessions, "tea-shop", "tester", edit_workbook(workbook_bytes, add_balance))
    with sessions() as session:
        row = session.execute(select(PROJECTIONS["CashBalances"])).mappings().one()
        assert row["bank_balance_mmk"] == 1500000
    after = calculate_platform_snapshot(repository.load_ledger("tea-shop"), period).actual.cash_balance_mmk
    assert before == after
    engine.dispose()
