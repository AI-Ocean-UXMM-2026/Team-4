from .schemas import issue
from ...db.models import ImportBatch
from datetime import timezone


def iso_timestamp(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value and value.tzinfo is None else value.isoformat() if value else None


def batch_response(batch, version):
    return {"import_batch_id": batch.id, "status": batch.status, "source_version": version,
            "row_counts": batch.row_counts, "errors": batch.errors, "warnings": batch.warnings,
            "created_at": iso_timestamp(batch.created_at)}


def failure_audit(sessions, source_id, business_id, user_id, error):
    with sessions.begin() as session:
        session.add(ImportBatch(source_id=source_id, business_id=business_id, actor_id=user_id,
                                status="failed", row_counts={}, errors=[issue("OneDrive", 0, "sync", error.message)], warnings=[]))
