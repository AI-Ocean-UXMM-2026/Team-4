"""One transaction for validation, facts, typed projections, revisions and source version."""
import hashlib
from datetime import date
from decimal import Decimal

from sqlalchemy import insert, select, update

from ...core.errors import APIError
from ...db.models import (Business, ImportBatch, ImportedRow, PROJECTIONS, RowRevision,
                          WorkbookSource, now)
from .import_audit import batch_response
from .schemas import SCHEMA, ParsedWorkbook, WorkbookRow, issue
from .validators import validate_workbook
from .workbook_parser import parse_workbook


def lock_business(session, business_id):
    # UPDATE acquires a database transaction lock on PostgreSQL and SQLite.
    session.execute(update(Business).where(Business.id == business_id).values(version=Business.version))
    return session.get(Business, business_id, populate_existing=True)


def typed_values(sheet, payload):
    result = {}
    for key, kind in SCHEMA[sheet]["fields"].items():
        value = payload[key]
        result[key] = date.fromisoformat(value) if kind == "date" else Decimal(value) if "money" in kind or "quantity" in kind else value
    return result


def import_validated_snapshot(sessions, business_id, actor_id, content: bytes, *, etag=None, expected_link=None, expected_data_version=None):
    digest = hashlib.sha256(content).hexdigest()
    parsed = parse_workbook(content)
    result = None
    with sessions.begin() as session:
        business = lock_business(session, business_id)
        if expected_data_version is not None and business.version != expected_data_version:
            raise APIError(409, "IMPORT_CONFLICT", "Business data changed during sync. Retry against the latest import.")
        source = session.scalar(select(WorkbookSource).where(WorkbookSource.business_id == business_id))
        if source is None:
            source = WorkbookSource(business_id=business_id)
            session.add(source)
            session.flush()
        if expected_link and (source.drive_id, source.item_id, source.linked_user_id) != expected_link:
            raise APIError(409, "SOURCE_CHANGED", "The linked workbook changed during sync. Try again.")
        batch = ImportBatch(source_id=source.id, business_id=business_id, actor_id=actor_id,
                            status="success", content_hash=digest, row_counts={}, errors=[], warnings=list(parsed.warnings))
        session.add(batch)
        session.flush()
        errors = validate_workbook(parsed, business_id)
        # An unchanged hash is valid only for the latest accepted source contents.
        if not errors and source.last_hash == digest:
            batch.status = "up_to_date"
            if etag:
                source.last_etag = etag
                source.last_checked_at = now()
            result = batch_response(batch, business.version)
        else:
            stored = session.scalars(select(ImportedRow).where(ImportedRow.business_id == business_id, ImportedRow.source_id == source.id)).all()
            by_key = {(row.sheet_name, row.row_id): row for row in stored}
            if not errors:
                # Omitted records remain active. Validate the actual resulting state, not just the new file.
                merged = ParsedWorkbook(sheets={name: list(parsed.sheets.get(name, [])) for name in SCHEMA})
                incoming_keys = {name: {r.values[SCHEMA[name]["id"]] for r in rows} for name, rows in merged.sheets.items()}
                for (name, row_id), old in by_key.items():
                    if row_id not in incoming_keys[name]:
                        merged.sheets[name].append(WorkbookRow(0, old.payload))
                        batch.warnings = [*batch.warnings, issue(name, 0, SCHEMA[name]["id"], f"Missing row {row_id} retained; review before deletion")]
                errors = validate_workbook(merged, business_id)
            if errors:
                batch.status, batch.errors = "failed", errors[:200]
                result = batch_response(batch, business.version)
            else:
                counts = {"inserted": 0, "updated": 0, "unchanged": 0}
                for name, rows in parsed.sheets.items():
                    spec, table = SCHEMA[name], PROJECTIONS[name]
                    for row in rows:
                        payload = row.values
                        row_id = payload[spec["id"]]
                        old = by_key.get((name, row_id))
                        if old and old.payload == payload:
                            counts["unchanged"] += 1
                            continue
                        fields = typed_values(name, payload)
                        fields.update(source_id=source.id, batch_id=batch.id)
                        if old:
                            session.add(RowRevision(imported_row_id=old.id, business_id=business_id, payload=old.payload,
                                                    batch_id=old.batch_id, revision=old.revision))
                            old.payload, old.batch_id, old.revision = payload, batch.id, old.revision + 1
                            session.execute(update(table).where(table.c.source_id == source.id, table.c[spec["id"]] == row_id).values(**fields))
                            counts["updated"] += 1
                        else:
                            session.add(ImportedRow(business_id=business_id, source_id=source.id, sheet_name=name,
                                                    row_id=row_id, payload=payload, batch_id=batch.id))
                            session.execute(insert(table).values(**fields))
                            counts["inserted"] += 1
                if counts["inserted"] + counts["updated"]:
                    business.version += 1
                batch.row_counts = counts
                source.last_hash, source.last_import_at = digest, now()
                # A manual upload invalidates the last cloud eTag, forcing the next cloud sync to compare contents.
                source.last_etag = etag
                if etag:
                    source.last_checked_at = now()
                result = batch_response(batch, business.version)
    if result["status"] == "failed":
        raise APIError(400, "WORKBOOK_INVALID", "Workbook rejected. No business records were changed.", details=[result])
    return result
