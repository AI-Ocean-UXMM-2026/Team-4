from app.integrations.excel.workbook_parser import parse_workbook
from app.integrations.excel.validators import validate_workbook
from conftest import ROOT, edit_workbook


def test_all_three_workbooks_follow_contract():
    for path in (ROOT / "database/seed").glob("*.xlsx"):
        assert validate_workbook(parse_workbook(path.read_bytes()), path.stem) == []


def test_row_errors_include_coordinates(workbook_bytes):
    data = edit_workbook(workbook_bytes, lambda w: setattr(w["Expenses"]["E2"], "value", -1))
    errors = validate_workbook(parse_workbook(data), "tea-shop")
    assert any(e["sheet"] == "Expenses" and e["row"] == 2 and e["field"] == "amount_mmk" for e in errors)


def test_formula_inputs_rejected(workbook_bytes):
    data = edit_workbook(workbook_bytes, lambda w: setattr(w["Expenses"]["E2"], "value", "=50000+30000"))
    assert "Formula inputs" in str(parse_workbook(data).errors)


def test_missing_sheet_rejected(workbook_bytes):
    data = edit_workbook(workbook_bytes, lambda w: w.remove(w["Sales"]))
    assert any(e["sheet"] == "Sales" for e in parse_workbook(data).errors)


def test_unknown_enums_and_invalid_dates_rejected(workbook_bytes):
    def change(w):
        w["Sales"]["G2"] = "mixed"
        w["Expenses"]["C2"] = "01/02/26"
    errors = parse_workbook(edit_workbook(workbook_bytes, change)).errors
    assert {e["field"] for e in errors} >= {"payment_type", "date"}


def test_zip_expansion_limit(monkeypatch, workbook_bytes):
    monkeypatch.setattr("app.integrations.excel.workbook_parser.MAX_EXPANDED_BYTES", 10)
    assert parse_workbook(workbook_bytes).errors


def test_invalid_zip_is_validation_error():
    assert parse_workbook(b"not a workbook").errors


def test_loan_principal_limit_and_unsupported_type():
    content = (ROOT / "database/seed/grocery.xlsx").read_bytes()
    overpayment = edit_workbook(content, lambda w: setattr(w["LoanPayments"]["E2"], "value", 600001))
    assert any(e["field"] == "principal_mmk" for e in validate_workbook(parse_workbook(overpayment), "grocery"))
    unknown = edit_workbook(content, lambda w: setattr(w["Loans"]["E2"], "value", "unsupported"))
    assert any(e["field"] == "loan_type" for e in parse_workbook(unknown).errors)
