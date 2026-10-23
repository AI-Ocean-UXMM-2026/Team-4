import json
import time

import httpx
import pytest
from cryptography.fernet import Fernet
from sqlalchemy import select

from app.core.config import Settings
from app.core.errors import APIError
from app.db.models import Business, WorkbookSource
from app.integrations.excel.graph_client import GraphClient
from app.integrations.excel.sync_service import sync_now
from conftest import edit_workbook, remove_business_id_columns, upload


def graph_settings():
    return Settings(microsoft_tenant_id="test-school", microsoft_client_id="test-client", microsoft_client_secret="test-secret",
                    token_encryption_key=Fernet.generate_key().decode())


def configure(client, workbook_bytes, settings):
    upload(client, workbook_bytes)
    with client.app.state.sessions.begin() as session:
        source = session.scalar(select(WorkbookSource))
        source.drive_id, source.item_id, source.linked_user_id, source.kind = "drive", "item", "demo-user", "onedrive"
        source.token_ciphertext = Fernet(settings.token_encryption_key.encode()).encrypt(json.dumps({"access_token": "private-token", "expires_at": time.time() + 3600}).encode()).decode()
        source.last_etag = "v1"


@pytest.mark.parametrize("status,code", [(401, "GRAPH_RECONNECT"), (403, "GRAPH_RECONNECT"), (429, "GRAPH_THROTTLED"), (503, "GRAPH_UNAVAILABLE"), (404, "WORKBOOK_NOT_FOUND")])
def test_graph_errors_have_stable_codes(status, code):
    client = GraphClient("private", 1024, transport=httpx.MockTransport(lambda _r: httpx.Response(status)))
    with pytest.raises(APIError) as error:
        client.metadata("drive", "item")
    client.close()
    assert error.value.code == code
    assert "private" not in error.value.message


def test_same_etag_skips_download(client, workbook_bytes):
    settings = graph_settings()
    configure(client, workbook_bytes, settings)
    class Unchanged:
        def __init__(self, *_): pass
        def metadata(self, *_): return {"eTag": "v1", "name": "book.xlsx", "file": {}}
        def download(self, *_): raise AssertionError("must not download unchanged version")
        def close(self): pass
    result = sync_now(client.app.state.sessions, settings, "tea-shop", "demo-user", Unchanged)
    assert result["status"] == "up_to_date"


def test_expired_token_preserves_facts(client, workbook_bytes):
    settings = graph_settings()
    configure(client, workbook_bytes, settings)
    with client.app.state.sessions.begin() as session:
        source = session.scalar(select(WorkbookSource))
        source.token_ciphertext = Fernet(settings.token_encryption_key.encode()).encrypt(json.dumps({"access_token": "private", "expires_at": 0}).encode()).decode()
    with pytest.raises(APIError) as error:
        sync_now(client.app.state.sessions, settings, "tea-shop", "demo-user")
    assert error.value.code == "GRAPH_RECONNECT"
    with client.app.state.sessions() as session:
        assert session.get(Business, "tea-shop").version == 1
        assert session.scalar(select(WorkbookSource)).last_etag == "v1"


def test_changed_etag_uses_same_importer(client, workbook_bytes):
    settings = graph_settings()
    configure(client, workbook_bytes, settings)
    def update_without_business_ids(workbook):
        workbook["Expenses"]["E2"] = 80000
        remove_business_id_columns(workbook)
    data = edit_workbook(workbook_bytes, update_without_business_ids)
    class Changed:
        def __init__(self, *_): pass
        def metadata(self, *_): return {"eTag": "v2", "name": "book.xlsx", "file": {}}
        def download(self, *_): return data
        def close(self): pass
    result = sync_now(client.app.state.sessions, settings, "tea-shop", "demo-user", Changed)
    assert result["row_counts"]["updated"] == 1
    with client.app.state.sessions() as session:
        assert session.scalar(select(WorkbookSource)).last_etag == "v2"
    snapshot = client.get("/api/v1/data/snapshot?business_id=tea-shop").json()
    assert snapshot["tables"]["Expenses"][0]["amount_mmk"] == "80000.00"
    assert all(row["business_id"] == "tea-shop" for rows in snapshot["tables"].values() for row in rows)


def test_disabled_graph_keeps_manual_upload(client, workbook_bytes):
    assert client.post("/api/v1/data/sync-now?business_id=tea-shop").status_code == 503
    assert upload(client, workbook_bytes).status_code == 200
    status = client.get("/api/v1/data/sync-status?business_id=tea-shop").json()
    assert "token" not in str(status)


def test_oauth_state_required(client):
    client.app.state.settings.__dict__.update(graph_settings().__dict__)
    result = client.get("/api/v1/auth/microsoft/callback?state=forged&code=forged")
    assert result.status_code == 400
