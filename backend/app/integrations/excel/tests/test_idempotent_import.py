from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import func, select

from app.core.errors import APIError
from app.db.models import ImportBatch, ImportedRow, PROJECTIONS, RowRevision
from app.integrations.excel.import_service import import_validated_snapshot
from conftest import edit_workbook, upload


def snapshot(client):
    return client.get("/api/v1/data/snapshot?business_id=tea-shop").json()


def test_repeat_and_single_expense_edit(client, workbook_bytes):
    initial = upload(client, workbook_bytes)
    assert initial.status_code == 200, initial.text
    before = snapshot(client)
    assert upload(client, workbook_bytes).json()["status"] == "up_to_date"
    assert snapshot(client) == before
    changed = edit_workbook(workbook_bytes, lambda w: setattr(w["Expenses"]["E2"], "value", 80000))
    result = upload(client, changed)
    assert result.status_code == 200, result.text
    assert result.json()["row_counts"] == {"inserted": 0, "updated": 1, "unchanged": 10}
    after = snapshot(client)
    assert after["source_version"] == before["source_version"] + 1
    assert len(after["tables"]["Expenses"]) == 2
    assert after["tables"]["Expenses"][0]["amount_mmk"] == "80000.00"
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(RowRevision)) == 1
        assert session.scalar(select(RowRevision)).payload["amount_mmk"] == "50000.00"


def test_duplicate_fails_atomically_and_is_audited(client, workbook_bytes):
    upload(client, workbook_bytes)
    before = snapshot(client)
    def change(w):
        w["Sales"]["A3"] = "S001"
        w["Expenses"]["E2"] = 80000
    result = upload(client, edit_workbook(workbook_bytes, change))
    assert result.status_code == 400
    assert snapshot(client) == before
    status = client.get("/api/v1/data/sync-status?business_id=tea-shop").json()
    assert status["imports"][0]["status"] == "failed"
    assert status["last_import_at"]


@pytest.mark.parametrize("sheet,cell,value", [("CustomerReceipts", "E2", 90000), ("SupplierPayments", "E2", 110000), ("Sales", "E2", 9999), ("Sales", "H2", 1), ("Sales", "D2", "foreign-id")])
def test_invalid_financial_state_rejected(client, workbook_bytes, sheet, cell, value):
    upload(client, workbook_bytes)
    before = snapshot(client)
    data = edit_workbook(workbook_bytes, lambda w: setattr(w[sheet][cell], "value", value))
    assert upload(client, data).status_code == 400
    assert snapshot(client) == before


def test_no_cross_business_access(client, workbook_bytes):
    assert client.get("/api/v1/data/snapshot?business_id=private").status_code == 403
    data = edit_workbook(workbook_bytes, lambda w: setattr(w["Expenses"]["B2"], "value", "private"))
    assert upload(client, data).status_code == 400
    assert snapshot(client)["source_version"] == 0


def test_missing_rows_retained_and_checked(client, workbook_bytes):
    upload(client, workbook_bytes)
    data = edit_workbook(workbook_bytes, lambda w: w["Expenses"].delete_rows(3))
    result = upload(client, data)
    assert result.status_code == 200
    assert "Missing row E002 retained" in str(result.json()["warnings"])
    assert len(snapshot(client)["tables"]["Expenses"]) == 2


def test_omitted_payments_still_prevent_overpayment(client, workbook_bytes):
    upload(client, workbook_bytes)
    def change(w):
        w["Sales"]["E3"] = 5  # total 25000, initial paid 20000, retained receipt is 30000
        w["CustomerReceipts"].delete_rows(2)
    assert upload(client, edit_workbook(workbook_bytes, change)).status_code == 400


def test_sql_failure_rolls_back_every_fact(client, workbook_bytes, monkeypatch):
    upload(client, workbook_bytes)
    before = snapshot(client)
    from app.integrations.excel import import_service
    real = import_service.typed_values
    def fail(sheet, payload):
        if sheet == "Expenses" and payload["expense_id"] == "E002":
            raise RuntimeError("simulated database projection failure")
        return real(sheet, payload)
    monkeypatch.setattr(import_service, "typed_values", fail)
    def change(w):
        w["Expenses"]["E2"] = 80000
        w["Expenses"]["E3"] = 99999
    with pytest.raises(RuntimeError):
        import_validated_snapshot(client.app.state.sessions, "tea-shop", "demo-user", edit_workbook(workbook_bytes, change))
    assert snapshot(client) == before


def test_concurrent_same_file_import_is_serialized(client, workbook_bytes):
    def run(_):
        return import_validated_snapshot(client.app.state.sessions, "tea-shop", "demo-user", workbook_bytes)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, range(2)))
    assert sorted(r["status"] for r in results) == ["success", "up_to_date"]
    assert len(snapshot(client)["tables"]["Expenses"]) == 2


def test_template_is_personalized_and_reset_restores(client, workbook_bytes):
    template = client.get("/api/v1/data/template?business_id=tea-shop")
    assert template.status_code == 200
    from app.integrations.excel.workbook_parser import parse_workbook
    assert parse_workbook(template.content).sheets["Settings"][0].values["business_id"] == "tea-shop"
    changed = edit_workbook(workbook_bytes, lambda w: setattr(w["Expenses"]["E2"], "value", 80000))
    upload(client, changed)
    result = client.post("/api/v1/demo/reset?business_id=tea-shop")
    assert result.status_code == 200, result.text
    assert snapshot(client)["tables"]["Expenses"][0]["amount_mmk"] == "50000.00"


def test_auth_and_upload_limits(client):
    assert client.post("/api/v1/data/upload?business_id=tea-shop", files={"file": ("book.csv", b"a,b")}).status_code == 400
    client.app.state.settings.__dict__["max_upload_bytes"] = 2
    assert client.post("/api/v1/data/upload?business_id=tea-shop", files={"file": ("book.xlsx", b"123")}).status_code == 400
    client.headers.pop("Authorization")
    assert client.get("/api/v1/data/snapshot?business_id=tea-shop").status_code == 401
