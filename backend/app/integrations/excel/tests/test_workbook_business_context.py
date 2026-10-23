"""Workbook ownership comes from authenticated workspace access, not user cells."""
import pytest
from sqlalchemy import func, select

from app.db.models import Business, ImportedRow, Membership, PROJECTIONS, RowRevision
from conftest import edit_workbook, remove_business_id_columns, upload


def populate_optional_sheets(workbook):
    for column, value in enumerate(["L001", "tea-shop", "2026-10-02", "Example lender", "business", 100000], start=1):
        workbook["Loans"].cell(2, column, value)
    for column, value in enumerate(["LP001", "tea-shop", "2026-10-15", "L001", 10000, 1000], start=1):
        workbook["LoanPayments"].cell(2, column, value)
    balances = workbook.create_sheet("CashBalances")
    balances.append(["balance_id", "business_id", "as_of_date", "cash_on_hand_mmk", "bank_balance_mmk"])
    balances.append(["CB001", "tea-shop", "2026-10-15", 150000, 500000])


@pytest.mark.parametrize("business_cells", ["omitted", "blank", "legacy"])
def test_import_binds_every_sheet_to_authorized_workspace(client, workbook_bytes, business_cells):
    def prepare(workbook):
        populate_optional_sheets(workbook)
        if business_cells == "omitted":
            remove_business_id_columns(workbook)
            return
        for sheet in workbook:
            headers = [cell.value for cell in sheet[1]]
            if "business_id" not in headers:
                continue
            column = headers.index("business_id") + 1
            for row in range(2, sheet.max_row + 1):
                # Stale identifiers include a real inaccessible business, an old
                # workspace identifier and text that is not a valid system ID.
                value = None if business_cells == "blank" else ("private", "old-workspace", "old business / copied workbook")[(row + column) % 3]
                sheet.cell(row, column).value = value

    result = upload(client, edit_workbook(workbook_bytes, prepare))
    assert result.status_code == 200, result.text
    snapshot = client.get("/api/v1/data/snapshot?business_id=tea-shop").json()
    assert all(snapshot["tables"][name] for name in PROJECTIONS)
    assert all(row["business_id"] == "tea-shop" for rows in snapshot["tables"].values() for row in rows)
    assert snapshot["tables"]["Loans"][0]["loan_id"] == "L001"
    assert snapshot["tables"]["LoanPayments"][0]["loan_id"] == "L001"
    with client.app.state.sessions() as session:
        rows = session.scalars(select(ImportedRow)).all()
        assert rows
        assert all(row.business_id == row.payload["business_id"] == "tea-shop" for row in rows)
        settings = next(row for row in rows if row.sheet_name == "Settings")
        assert settings.row_id == "tea-shop"
        assert session.get(Business, "private").version == 0
        for table in PROJECTIONS.values():
            assert session.scalar(select(func.count()).select_from(table).where(table.c.business_id == "private")) == 0


def test_removing_legacy_business_cells_preserves_versions_and_stable_id_updates(client, workbook_bytes, unscoped_workbook_bytes):
    initial = upload(client, workbook_bytes)
    assert initial.status_code == 200, initial.text
    version = initial.json()["source_version"]

    without_ids = upload(client, unscoped_workbook_bytes)
    assert without_ids.status_code == 200, without_ids.text
    assert without_ids.json()["source_version"] == version
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(RowRevision)) == 0
    repeated = upload(client, unscoped_workbook_bytes)
    assert repeated.json()["status"] == "up_to_date"
    assert repeated.json()["source_version"] == version

    changed = edit_workbook(unscoped_workbook_bytes, lambda workbook: setattr(workbook["Expenses"]["D2"], "value", 80000))
    corrected = upload(client, changed)
    assert corrected.status_code == 200, corrected.text
    assert corrected.json()["row_counts"] == {"inserted": 0, "updated": 1, "unchanged": 10}
    assert corrected.json()["source_version"] == version + 1
    with client.app.state.sessions() as session:
        expense = session.scalar(select(ImportedRow).where(ImportedRow.sheet_name == "Expenses", ImportedRow.row_id == "E001"))
        assert expense.payload["amount_mmk"] == "80000.00"
        assert expense.payload["business_id"] == "tea-shop"
        revision = session.scalar(select(RowRevision))
        assert revision.imported_row_id == expense.id
        assert revision.payload["amount_mmk"] == "50000.00"
        assert revision.payload["business_id"] == "tea-shop"


def test_legacy_workbook_can_be_reused_only_in_an_authorized_workspace(client, workbook_bytes):
    assert upload(client, workbook_bytes).status_code == 200
    denied = client.post("/api/v1/data/upload?business_id=private", files={"file": ("book.xlsx", workbook_bytes)})
    assert denied.status_code == 403

    with client.app.state.sessions.begin() as session:
        session.add(Membership(business_id="private", user_id="demo-user"))
    reused = client.post("/api/v1/data/upload?business_id=private", files={"file": ("book.xlsx", workbook_bytes)})
    assert reused.status_code == 200, reused.text
    with client.app.state.sessions() as session:
        rows = session.scalars(select(ImportedRow).where(ImportedRow.sheet_name == "Expenses", ImportedRow.row_id == "E001")).all()
        assert {row.business_id for row in rows} == {"tea-shop", "private"}
        assert all(row.payload["business_id"] == row.business_id for row in rows)
        assert session.get(Business, "tea-shop").version == session.get(Business, "private").version == 1


def test_legacy_business_id_only_rows_are_not_imported(client, workbook_bytes):
    def prefill_unused_row(workbook):
        workbook["Products"]["B20"] = "old-workspace"
        workbook["Expenses"]["B20"] = "old-workspace"
    result = upload(client, edit_workbook(workbook_bytes, prefill_unused_row))
    assert result.status_code == 200, result.text
    snapshot = client.get("/api/v1/data/snapshot?business_id=tea-shop").json()
    assert len(snapshot["tables"]["Products"]) == 1
    assert len(snapshot["tables"]["Expenses"]) == 2
