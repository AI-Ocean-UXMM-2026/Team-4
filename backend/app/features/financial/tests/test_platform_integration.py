"""Exercise actual P5 imports, SQL projections and business authorization."""
from decimal import Decimal
from io import BytesIO
from openpyxl import load_workbook

from app.integrations.excel.tests.conftest import client, workbook_bytes, upload
from app.features.financial.platform import calculate_platform_snapshot
from app.features.financial.platform_repository import Ledger
from app.features.financial.schemas import Period
from datetime import date


URL = "/api/v1/financial/summary?business_id=tea-shop&start=2026-10-01&end=2026-10-31"


def test_real_import_summary_and_idempotency(client, workbook_bytes):
    first = upload(client, workbook_bytes)
    assert first.status_code == 200
    response = client.get(URL)
    assert response.status_code == 200, response.text
    summary = response.json()
    source = client.get("/api/v1/data/snapshot?business_id=tea-shop").json()
    sales = source["tables"]["Sales"]
    expected = sum((Decimal(x["quantity"]) * Decimal(x["unit_price_mmk"]) for x in sales), Decimal(0))
    assert Decimal(summary["actual"]["revenue_mmk"]) == expected
    assert summary["actual"]["cogs_mmk"] is None
    assert summary["actual"]["profit_before_tax_mmk"] is None
    assert summary["actual"]["cash_balance_mmk"] is None
    assert summary["source_version"] == source["source_version"]
    assert summary["as_of"] and summary["import_batch_id"]
    assert upload(client, workbook_bytes).status_code == 200
    assert client.get(URL).json() == summary


def test_edit_expense_reimports_once(client, workbook_bytes):
    assert upload(client, workbook_bytes).status_code == 200
    before = client.get(URL).json()
    workbook = load_workbook(BytesIO(workbook_bytes))
    sheet = workbook["Expenses"]
    column = [cell.value for cell in sheet[1]].index("amount_mmk") + 1
    sheet.cell(2, column).value = float(Decimal(str(sheet.cell(2, column).value)) + Decimal("30000"))
    target = BytesIO()
    workbook.save(target)
    workbook.close()
    changed = upload(client, target.getvalue())
    assert changed.status_code == 200, changed.text
    assert changed.json()["row_counts"]["updated"] == 1
    after = client.get(URL).json()
    assert Decimal(after["actual"]["operating_expenses_mmk"]) - Decimal(before["actual"]["operating_expenses_mmk"]) == 30000
    assert after["source_version"] > before["source_version"]
    assert after["import_batch_id"] != before["import_batch_id"]


def test_authorization_and_no_import(client):
    assert client.get(URL).json()["data_quality"]["status"] == "missing_data"
    assert client.get(URL.replace("tea-shop", "private")).status_code == 403
    client.headers.pop("Authorization")
    assert client.get(URL).status_code == 401


def test_trends_and_undated_obligations(client, workbook_bytes):
    upload(client, workbook_bytes)
    trends = client.get("/api/v1/financial/trends?business_id=tea-shop&end=2026-10-31&months=3")
    assert trends.status_code == 200
    assert len(trends.json()["points"]) == 3
    obligations = client.get("/api/v1/financial/obligations?business_id=tea-shop&as_at=2026-10-31&before=2026-11-30")
    assert obligations.status_code == 200
    assert all(x["due_date"] is None for x in obligations.json()["upcoming_obligations"])


def test_partial_initial_settlement_decimal_cash_and_receivables():
    d = date(2026, 10, 1)
    tables = {name: [] for name in ["Settings", "Sales", "CustomerReceipts", "Purchases", "SupplierPayments", "Expenses", "Loans", "LoanPayments", "CashAdjustments"]}
    tables["Settings"] = [dict(business_id="A", opening_date=d, opening_cash_mmk="1000.00")]
    tables["Sales"] = [dict(business_id="A", sale_id="S", date=d, quantity="1.500", unit_price_mmk="100.50", cash_received_mmk="50.25")]
    tables["CustomerReceipts"] = [dict(business_id="A", receipt_id="R", sale_id="S", date=d, amount_mmk="20.10")]
    tables["Purchases"] = [dict(business_id="A", purchase_id="P", date=d, quantity="1.000", unit_cost_mmk="30.25", cash_paid_mmk="10.25")]
    ledger = Ledger("A", 1, tables, None, "batch")
    snap = calculate_platform_snapshot(ledger, Period(start=d, end=d))
    assert snap.actual.revenue_mmk == Decimal("150.75")
    assert snap.actual.receivables_mmk == Decimal("80.40")
    assert snap.actual.payables_mmk == Decimal("20.00")
    assert snap.actual.cash_balance_mmk == Decimal("1060.10")
    assert snap.upcoming_obligations[0].due_date is None
