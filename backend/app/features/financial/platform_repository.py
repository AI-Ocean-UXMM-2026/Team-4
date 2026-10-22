"""Read one consistent P5 projection snapshot; never parse ingestion audit JSON."""
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select

from ...core.demo_data import is_synthetic_seed_workbook
from ...core.errors import APIError
from ...db.models import Business, ImportBatch, PROJECTIONS, WorkbookSource


@dataclass(frozen=True)
class Ledger:
    business_id: str
    source_version: int
    tables: dict[str, list[dict]]
    as_of: datetime | None
    import_batch_id: str | None
    warnings: tuple[str, ...] = ()
    synthetic: bool = False


class SqlFinancialRepository:
    def __init__(self, sessions):
        self.sessions = sessions

    def load_ledger(self, business_id: str) -> Ledger:
        # Match P5 import locking: hold the business row while reading projections.
        with self.sessions.begin() as session:
            if session.bind.dialect.name == "sqlite":
                session.connection().exec_driver_sql("BEGIN")
            business = session.scalar(
                select(Business).where(Business.id == business_id).with_for_update(read=True)
            )
            if business is None:
                raise APIError(404, "BUSINESS_NOT_FOUND", "Business not found.")
            source = session.scalar(select(WorkbookSource).where(WorkbookSource.business_id == business_id))
            batch = session.scalar(
                select(ImportBatch).where(ImportBatch.business_id == business_id, ImportBatch.status == "success")
                .order_by(ImportBatch.created_at.desc(), ImportBatch.id.desc()).limit(1)
            )
            tables = {
                name: [dict(row) for row in session.execute(select(table).where(table.c.business_id == business_id)).mappings()]
                for name, table in PROJECTIONS.items()
            }
            stamp = source.last_import_at if source else None
            if stamp and stamp.utcoffset() is None:
                # SQLite strips the offset of UTC values written by P5's now().
                stamp = stamp.replace(tzinfo=timezone.utc)
            return Ledger(
                business_id=business_id, source_version=business.version, tables=tables,
                as_of=stamp, import_batch_id=batch.id if batch else None,
                warnings=tuple(issue.get("reason", "Import warning") for issue in (batch.warnings if batch else [])),
                synthetic=is_synthetic_seed_workbook(business_id, batch.content_hash if batch else None),
            )
