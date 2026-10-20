from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.core.config import Settings
from app.db.connection import make_engine
from app.db.models import Base, Business, Membership, User
from app.main import create_app

ROOT = Path(__file__).resolve().parents[5]


@pytest.fixture
def workbook_bytes():
    return (ROOT / "database/seed/tea-shop.xlsx").read_bytes()


def edit_workbook(content, change):
    workbook = load_workbook(BytesIO(content))
    change(workbook)
    target = BytesIO()
    workbook.save(target)
    workbook.close()
    return target.getvalue()


@pytest.fixture
def client(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    settings = Settings(auth_mode="demo", session_secret="test-secret-" * 4,
                        demo_password="test-demo-password", allow_demo_reset=True)
    app = create_app(settings, engine)
    with app.state.sessions.begin() as session:
        session.add(User(id="demo-user"))
        session.add_all([Business(id="tea-shop", name="Tea Shop"), Business(id="private", name="Private")])
        session.flush()
        session.add(Membership(business_id="tea-shop", user_id="demo-user"))
    with TestClient(app) as client:
        token = client.post("/api/v1/auth/demo-login", json={"password": "test-demo-password"}).json()["access_token"]
        client.headers["Authorization"] = "Bearer " + token
        yield client


def upload(client, data):
    return client.post("/api/v1/data/upload?business_id=tea-shop", files={"file": ("book.xlsx", data)})
