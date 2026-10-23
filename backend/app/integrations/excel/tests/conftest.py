from io import BytesIO
from pathlib import Path

import pytest
import httpx
import jwt
import time
from types import SimpleNamespace
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.core.config import Settings
from app.db.connection import make_engine
from app.db.models import Base, Business, Membership, User
from app.main import create_app
from app.core.supabase_auth import SupabaseAuth

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


def remove_business_id_columns(workbook):
    for sheet in workbook:
        for cell in reversed(list(sheet[1])):
            if cell.value == "business_id":
                sheet.delete_cols(cell.column)


@pytest.fixture
def unscoped_workbook_bytes(workbook_bytes):
    return edit_workbook(workbook_bytes, remove_business_id_columns)


@pytest.fixture
def client(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    settings = Settings(supabase_url="https://auth.example.test", supabase_publishable_key="public-test-key")
    app = create_app(settings, engine)
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    users = {"demo-user": {"id": "demo-user", "email": "owner@example.test", "email_confirmed_at": "2026-10-20T00:00:00Z", "user_metadata": {"full_name": "Test Owner"}}}
    def token(user_id="demo-user", *, expired=False, issuer=None):
        moment = int(time.time())
        return jwt.encode({"sub": user_id, "aud": "authenticated", "iss": issuer or settings.supabase_url + "/auth/v1", "iat": moment-100, "exp": moment-1 if expired else moment+3600, "role": "authenticated"}, private_key, algorithm="RS256")
    def transport(request):
        if request.url.path.endswith("/settings"):
            return httpx.Response(200, json={"mailer_autoconfirm": True, "external": {"email": True}, "disable_signup": False})
        if request.url.path.endswith("/user"):
            try:
                sub = jwt.decode(request.headers.get("Authorization", "").removeprefix("Bearer "), private_key.public_key(), algorithms=["RS256"], audience="authenticated")["sub"]
                return httpx.Response(200, json=users[sub])
            except (jwt.PyJWTError, KeyError):
                return httpx.Response(401, json={"code": "bad_jwt"})
        return httpx.Response(200, json={})
    app.state.auth.close()
    app.state.auth = SupabaseAuth(settings, transport=httpx.MockTransport(transport), jwks=SimpleNamespace(get_signing_key_from_jwt=lambda _: SimpleNamespace(key=private_key.public_key())))
    app.state.test_users, app.state.test_token = users, token
    with app.state.sessions.begin() as session:
        session.add(User(id="demo-user", full_name="Test Owner"))
        session.add_all([Business(id="tea-shop", name="Tea Shop", industry="Food", city="Yangon"), Business(id="private", name="Private", industry="Retail", city="Mandalay")])
        session.flush()
        session.add(Membership(business_id="tea-shop", user_id="demo-user"))
    with TestClient(app) as client:
        client.headers["Authorization"] = "Bearer " + token()
        yield client


def upload(client, data):
    return client.post("/api/v1/data/upload?business_id=tea-shop", files={"file": ("book.xlsx", data)})
