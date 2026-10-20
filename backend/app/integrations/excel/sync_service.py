from sqlalchemy import select

from ...core.errors import APIError
from ...db.models import WorkbookSource, now
from .graph_client import GraphClient
from .import_audit import failure_audit
from .import_service import import_validated_snapshot, lock_business
from .onedrive_auth import access_token


def sync_now(sessions, settings, business_id, user_id, client_factory=GraphClient):
    source, client, source_id, import_started = None, None, None, False
    try:
        with sessions.begin() as session:
            business = lock_business(session, business_id)
            source = session.scalar(select(WorkbookSource).where(WorkbookSource.business_id == business_id))
            if source is None or not source.drive_id or not source.item_id:
                raise APIError(409, "WORKBOOK_NOT_LINKED", "Choose a OneDrive workbook first, or upload an .xlsx file.")
            source_id = source.id
            token = access_token(session, source, user_id, settings)
            client = client_factory(token, settings.max_upload_bytes)
            metadata = client.metadata(source.drive_id, source.item_id)
            etag = metadata.get("eTag")
            if not etag or "file" not in metadata or not metadata.get("name", "").lower().endswith(".xlsx"):
                raise APIError(400, "WORKBOOK_INVALID", "Linked item must be an .xlsx workbook with a cloud version.")
            if metadata.get("size", 0) > settings.max_upload_bytes:
                raise APIError(400, "FILE_TOO_LARGE", "Cloud workbook exceeds the upload limit.")
            source.last_checked_at = now()
            if source.last_etag == etag:
                return {"status": "up_to_date", "source_version": business.version, "row_counts": {}, "errors": [], "warnings": []}
            expected_version = business.version
            expected_link = (source.drive_id, source.item_id, source.linked_user_id)
        content = client.download(source.drive_id, source.item_id)
        if client.metadata(source.drive_id, source.item_id).get("eTag") != etag:
            raise APIError(409, "WORKBOOK_SAVING", "Workbook changed during download. Wait for OneDrive to finish saving, then retry.")
        import_started = True
        return import_validated_snapshot(sessions, business_id, user_id, content, etag=etag,
                                         expected_link=expected_link, expected_data_version=expected_version)
    except APIError as exc:
        if source_id and not (import_started and exc.code == "WORKBOOK_INVALID"):
            failure_audit(sessions, source_id, business_id, user_id, exc)
        raise
    finally:
        if client:
            client.close()
