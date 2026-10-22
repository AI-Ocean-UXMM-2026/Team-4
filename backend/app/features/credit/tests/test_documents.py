from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.dependencies import current_user
from app.db.connection import make_engine, session_factory
from app.db.models import Base, Business, User, Membership
from app.features.credit.documents import router


@pytest.fixture
def client(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'files.db'}")
    Base.metadata.create_all(engine)
    sessions = session_factory(engine)
    with sessions.begin() as session:
        session.add(User(id="owner", full_name="Owner"))
        session.add_all([Business(id=key, name=key, industry="Retail", city="Yangon") for key in ("mine", "other")])
        session.flush()
        session.add(Membership(business_id="mine", user_id="owner"))
    app = FastAPI()
    app.state.sessions = sessions
    app.dependency_overrides[current_user] = lambda: "owner"
    from app.core.errors import APIError, api_error_handler
    app.add_exception_handler(APIError, api_error_handler)
    app.include_router(router)
    with TestClient(app) as client:
        yield client
    engine.dispose()


SCOPE = "business_id=mine&bank_id=kbz&product_id=kbz-term"


def test_upload_list_download_delete_and_product_isolation(client):
    content = b"%PDF-1.4\nDemo attachment"
    result = client.post(f"/documents?{SCOPE}&requirement_key=doc-0", files={"file": ("license.pdf", content, "application/pdf")})
    assert result.status_code == 200
    document = result.json()
    assert document["status"] == "uploaded_unverified"
    assert client.get(f"/documents?{SCOPE}").json()["documents"][0]["filename"] == "license.pdf"
    assert client.get("/documents?business_id=mine&bank_id=kbz&product_id=kbz-jica").json()["documents"] == []
    downloaded = client.get(f"/documents/{document['id']}/download?business_id=mine")
    assert downloaded.content == content
    assert downloaded.headers["content-type"] == "application/octet-stream"
    assert client.get(f"/documents/{document['id']}/download?business_id=other").status_code == 403
    assert client.delete(f"/documents/{document['id']}?business_id=other").status_code == 403
    assert client.delete(f"/documents/{document['id']}?business_id=mine").status_code == 200
    assert client.get(f"/documents?{SCOPE}").json()["documents"] == []


def test_rejects_fake_file_type_and_mismatched_bank_product(client):
    fake = client.post(f"/documents?{SCOPE}&requirement_key=doc-0", files={"file": ("fake.pdf", b"<script>hello</script>", "application/pdf")})
    assert fake.status_code == 400
    assert client.get("/documents?business_id=mine&bank_id=yoma&product_id=kbz-term").status_code == 400
    assert client.get("/documents?business_id=other&bank_id=kbz&product_id=kbz-term").status_code == 403
