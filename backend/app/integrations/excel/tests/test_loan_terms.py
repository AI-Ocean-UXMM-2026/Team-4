from app.integrations.excel.workbook_parser import parse_workbook
from app.integrations.excel.validators import validate_workbook
from conftest import ROOT, edit_workbook


def with_terms(workbook):
    sheet = workbook["Loans"]
    if sheet["A2"].value is None:
        for column, value in enumerate(["TERM-LOAN", "tea-shop", "2026-10-20", "KBZ Bank", "reducing_balance", 1200000], 1):
            sheet.cell(2, column, value)
    for column, header in enumerate(("loan_product", "annual_rate_pct", "term_months"), 7):
        sheet.cell(1, column, header)
    sheet.cell(2, 7, "SME Term Loan")
    sheet.cell(2, 8, 0)
    sheet.cell(2, 9, 24)
    for column, (header, value) in enumerate((("bank_id", "kbz"), ("loan_product_id", "kbz-term"), ("first_payment_date", "2026-11-20"), ("payment_frequency", "monthly")), 10):
        sheet.cell(1, column, header)
        sheet.cell(2, column, value)


def test_terms_survive_import_and_reach_credit_summary(tmp_path, workbook_bytes):
    import pytest
    from app.core.errors import APIError
    from app.db.connection import make_engine, session_factory
    from app.db.models import Base, Business
    from app.integrations.excel.import_service import import_validated_snapshot
    from app.features.credit.repository import credit_inputs
    from app.features.credit.router import build_credit_snapshot
    engine = make_engine(f"sqlite:///{tmp_path / 'terms.db'}")
    Base.metadata.create_all(engine)
    sessions = session_factory(engine)
    with sessions.begin() as session:
        session.add(Business(id="tea-shop", name="Tea Shop", industry="Food", city="Yangon"))
    def summary():
        with sessions() as session:
            return build_credit_snapshot(credit_inputs(session, "tea-shop"), "tea-shop")["loans"]
    content = edit_workbook(workbook_bytes, with_terms)
    import_validated_snapshot(sessions, "tea-shop", "tester", content)
    loans = summary()
    assert loans[0]["loan_product"] == "SME Term Loan"
    assert float(loans[0]["annual_rate_pct"]) == 0
    assert loans[0]["term_months"] == 24
    assert loans[0]["schedule_status"] == "available"
    # Omitted rows are retained: a second file cannot bypass the bank rule.
    def another_bank(workbook):
        with_terms(workbook)
        workbook["Loans"]["A2"] = "SECOND-LOAN"
        workbook["Loans"]["D2"] = "Yoma Bank"
        workbook["Loans"]["G2"] = "SME Business Loan"
        workbook["Loans"]["J2"] = "yoma"
        workbook["Loans"]["K2"] = "yoma-sme"
    with pytest.raises(APIError):
        import_validated_snapshot(sessions, "tea-shop", "tester", edit_workbook(workbook_bytes, another_bank))
    unchanged = summary()
    assert len(unchanged) == 1
    assert unchanged[0]["lender"] == "KBZ Bank"
    engine.dispose()


def test_partial_terms_and_fractional_months_rejected(workbook_bytes):
    def partial(workbook):
        with_terms(workbook)
        workbook["Loans"]["I2"] = None
    errors = validate_workbook(parse_workbook(edit_workbook(workbook_bytes, partial)), "tea-shop")
    assert any(error["field"] == "term_months" for error in errors)
    def fractional(workbook):
        with_terms(workbook)
        workbook["Loans"]["I2"] = 2.5
    assert any(error["field"] == "term_months" for error in parse_workbook(edit_workbook(workbook_bytes, fractional)).errors)


def test_second_outstanding_bank_rejected_but_settled_history_allowed():
    content = (ROOT / "database/seed/grocery.xlsx").read_bytes()
    def second_bank(workbook):
        sheet = workbook["Loans"]
        sheet.append(["OTHER-LOAN", "grocery", sheet["C2"].value, "Other Bank", "reducing_balance", 100])
    parsed = parse_workbook(edit_workbook(content, second_bank))
    assert any(error["field"] == "lender" for error in validate_workbook(parsed, "grocery"))
    from app.integrations.excel.schemas import WorkbookRow
    parsed.sheets["LoanPayments"].append(WorkbookRow(99, {
        "payment_id": "SETTLED", "business_id": "grocery", "date": parsed.sheets["Loans"][-1].values["date"],
        "loan_id": "OTHER-LOAN", "principal_mmk": "100", "interest_mmk": "0",
    }))
    assert validate_workbook(parsed, "grocery") == []


def test_product_and_bank_must_match(workbook_bytes):
    def mismatched(workbook):
        with_terms(workbook)
        workbook["Loans"]["K2"] = "yoma-sme"
    errors = validate_workbook(parse_workbook(edit_workbook(workbook_bytes, mismatched)), "tea-shop")
    assert any(error["field"] == "loan_product_id" for error in errors)


def test_lender_and_first_payment_are_validated(workbook_bytes):
    def invalid(workbook):
        with_terms(workbook)
        workbook["Loans"]["D2"] = "Yoma Bank"
        workbook["Loans"]["L2"] = "2026-10-19"
    errors = validate_workbook(parse_workbook(edit_workbook(workbook_bytes, invalid)), "tea-shop")
    assert {error["field"] for error in errors} >= {"lender", "first_payment_date"}
