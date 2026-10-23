"""Reconcile the one manually editable workbook field without changing other facts."""
from datetime import date

from sqlalchemy import select, update

from ...core.errors import APIError
from ...db.models import (ImportedRow, PROJECTIONS, PurchaseDueDateOverride,
                          RowRevision, WorkbookSource, now)


def event(actor_id, action, old_date, new_date):
    return {"at": now().isoformat(), "actor_id": actor_id, "action": action,
            "old_due_date": old_date, "new_due_date": new_date}


def change_purchase_due_date(sessions, business_id, purchase_id, actor_id, due_date: date,
                             expected_due_date: date | None):
    from .import_service import lock_business
    with sessions.begin() as session:
        business = lock_business(session, business_id)
        source = session.scalar(select(WorkbookSource).where(WorkbookSource.business_id == business_id))
        row = session.scalar(select(ImportedRow).where(
            ImportedRow.business_id == business_id, ImportedRow.source_id == source.id,
            ImportedRow.sheet_name == "Purchases", ImportedRow.row_id == purchase_id,
            ImportedRow.active_status == "active")) if source else None
        if row is None:
            raise APIError(404, "PURCHASE_NOT_FOUND", "This purchase is not available for this business.")
        current = row.payload.get("due_date")
        if current != (expected_due_date.isoformat() if expected_due_date else None):
            raise APIError(409, "PURCHASE_CHANGED", "The due date changed. Refresh and try again.")
        if due_date < date.fromisoformat(row.payload["date"]):
            raise APIError(400, "DUE_DATE_INVALID", "Due date cannot precede the purchase date.")
        if current == due_date.isoformat():
            return {"purchase_id": purchase_id, "due_date": current, "source_version": business.version}
        override = session.scalar(select(PurchaseDueDateOverride).where(
            PurchaseDueDateOverride.business_id == business_id,
            PurchaseDueDateOverride.source_id == source.id,
            PurchaseDueDateOverride.purchase_id == purchase_id))
        if override is None:
            override = PurchaseDueDateOverride(
                business_id=business_id, source_id=source.id, purchase_id=purchase_id,
                workbook_due_date=date.fromisoformat(current) if current else None,
                manual_due_date=due_date, active=True, events=[])
            session.add(override)
        else:
            override.manual_due_date = due_date
            override.active = True
        override.events = [*override.events, event(actor_id, "manual_edit", current, due_date.isoformat())]
        session.add(RowRevision(imported_row_id=row.id, business_id=business_id,
                                payload=row.payload, batch_id=row.batch_id, revision=row.revision))
        row.payload = {**row.payload, "due_date": due_date.isoformat()}
        row.revision += 1
        table = PROJECTIONS["Purchases"]
        session.execute(update(table).where(table.c.source_id == source.id,
                                            table.c.purchase_id == purchase_id).values(due_date=due_date))
        business.version += 1
        return {"purchase_id": purchase_id, "due_date": due_date.isoformat(), "source_version": business.version}
