from datetime import datetime

from sqlalchemy import func, select

from app.db.models import ImportedRow, PROJECTIONS, PurchaseDueDateOverride, RowRevision
from conftest import edit_workbook, upload


def purchase(client):
    return client.get("/api/v1/data/snapshot?business_id=tea-shop").json()["tables"]["Purchases"][0]


def manual(client, due_date, expected=None, business_id="tea-shop"):
    return client.put(f"/api/v1/data/purchases/B001/due-date?business_id={business_id}",
                      json={"due_date": due_date, "expected_due_date": expected})


def workbook_with_due_date(content, due_date):
    def change(book):
        book["Purchases"]["I1"] = "due_date"
        book["Purchases"]["I2"] = datetime.fromisoformat(due_date)
    return edit_workbook(content, change)


def test_manual_due_date_updates_projection_and_financial_status(client, workbook_bytes):
    assert upload(client, workbook_bytes).status_code == 200
    before = client.get("/api/v1/data/snapshot?business_id=tea-shop").json()["source_version"]
    assert manual(client, "2026-10-25").status_code == 200
    assert purchase(client)["due_date"] == "2026-10-25"
    assert client.get("/api/v1/data/snapshot?business_id=tea-shop").json()["source_version"] == before + 1
    summary = client.get("/api/v1/financial/summary?business_id=tea-shop&start=2026-10-01&end=2026-10-21")
    assert summary.status_code == 200, summary.text
    obligations = summary.json()["upcoming_obligations"]
    assert any(item["reference_id"] == "B001" and item["due_date"] == "2026-10-25" for item in obligations)
    assert manual(client, "2026-10-29", "2026-10-25").status_code == 200
    assert manual(client, "2026-10-30", "2026-10-25").status_code == 409
    assert purchase(client)["due_date"] == "2026-10-29"
    with client.app.state.sessions() as session:
        override = session.scalar(select(PurchaseDueDateOverride))
        assert len(override.events) == 2
        assert session.scalar(select(func.count()).select_from(RowRevision)) == 2
        assert session.scalar(select(func.count()).select_from(ImportedRow).where(ImportedRow.sheet_name == "Purchases")) == 1


def test_rejects_invalid_or_unauthorized_manual_dates(client, workbook_bytes):
    upload(client, workbook_bytes)
    assert manual(client, "2026-10-01").status_code == 400  # Before purchase.
    assert manual(client, "not-a-date").status_code == 400
    assert manual(client, "2026-10-25", business_id="private").status_code == 403
    client.headers.pop("Authorization")
    assert manual(client, "2026-10-25").status_code == 401


def test_excel_reupload_and_manual_conflict_resolution(client, workbook_bytes):
    upload(client, workbook_bytes)
    first = workbook_with_due_date(workbook_bytes, "2026-10-24")
    assert upload(client, first).status_code == 200
    assert purchase(client)["due_date"] == "2026-10-24"
    assert manual(client, "2026-10-25", "2026-10-24").status_code == 200
    assert upload(client, first).json()["status"] == "up_to_date"
    assert purchase(client)["due_date"] == "2026-10-25"
    changed = workbook_with_due_date(workbook_bytes, "2026-10-27")
    conflict = upload(client, changed)
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "DUE_DATE_CONFLICT"
    assert purchase(client)["due_date"] == "2026-10-25"
    keep = client.post("/api/v1/data/upload?business_id=tea-shop&due_date_resolution=keep_manual",
                       files={"file": ("book.xlsx", changed)})
    assert keep.status_code == 200, keep.text
    assert purchase(client)["due_date"] == "2026-10-25"
    assert upload(client, changed).json()["status"] == "up_to_date"
    newest = workbook_with_due_date(workbook_bytes, "2026-10-28")
    assert upload(client, newest).status_code == 409
    accept = client.post("/api/v1/data/upload?business_id=tea-shop&due_date_resolution=accept_workbook",
                         files={"file": ("book.xlsx", newest)})
    assert accept.status_code == 200, accept.text
    assert purchase(client)["due_date"] == "2026-10-28"
    assert upload(client, newest).json()["status"] == "up_to_date"
    with client.app.state.sessions() as session:
        override = session.scalar(select(PurchaseDueDateOverride))
        assert not override.active
        assert [e["action"] for e in override.events][-2:] == ["manual_kept", "workbook_accepted"]
        assert session.scalar(select(func.count()).select_from(PROJECTIONS["Purchases"])) == 1


def test_complete_replacement_retires_omitted_purchase_override(client, workbook_bytes):
    upload(client, workbook_bytes)
    assert manual(client, "2026-10-25").status_code == 200
    def omit_purchase_and_payment(book):
        book["Purchases"].delete_rows(2)
        book["SupplierPayments"].delete_rows(2)
    omitted = edit_workbook(workbook_bytes, omit_purchase_and_payment)
    # Normal uploads retain historical purchases even when omitted.
    res = upload(client, omitted)
    assert res.status_code == 200, res.text
    assert purchase(client)["due_date"] == "2026-10-25"
    removed = client.post("/api/v1/data/upload?business_id=tea-shop&replace_omitted=true",
                          files={"file": ("book.xlsx", omitted)})
    assert removed.status_code == 200, removed.text
    assert client.get("/api/v1/data/snapshot?business_id=tea-shop").json()["tables"]["Purchases"] == []
    with client.app.state.sessions() as session:
        override = session.scalar(select(PurchaseDueDateOverride))
        assert override.active is False
        assert override.events[-1]["action"] == "purchase_removed"
