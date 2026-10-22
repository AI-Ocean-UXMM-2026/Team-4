import json
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime

import httpx
import pytest
import jwt
from sqlalchemy import delete, func, select

from app.db.models import AuthRequestLimit, Business, Membership, PROJECTIONS, User
from app.core.account_service import complete_onboarding
from app.core.account_schemas import Onboarding
from app.core.supabase_auth import Identity
from app.core.supabase_auth import SupabaseAuth
from conftest import upload


BUSINESS = {"name": "  Aye Trading  ", "industry": "Retail", "city": "Yangon", "phone": "+95 9 12345678", "address": "", "currency": "MMK"}
REGISTRATION = {"full_name": "  Aye Aye  ", "email": "  aye@example.test  ", "password": " StrongPassword1! ", "confirm_password": " StrongPassword1! ", "business": BUSINESS}


def provider_reply(client, status=200, body=None, inspect=None, headers=None, confirmation_required=False):
    def transport(request):
        if request.url.path.endswith("/settings"):
            return httpx.Response(200, json={"mailer_autoconfirm": not confirmation_required, "external": {"email": True}, "disable_signup": False})
        if inspect:
            inspect(request)
        return httpx.Response(status, json=body if body is not None else {"user": {"id": "new-provider-user", "email": "aye@example.test"}, "access_token": "provider-access", "refresh_token": "provider-refresh"}, headers=headers)
    client.app.state.auth.client.close()
    client.app.state.auth.client = httpx.Client(base_url="https://auth.example.test/auth/v1/", transport=httpx.MockTransport(transport))


def user(client, user_id="new-owner", *, verified=True, metadata=None):
    client.app.state.test_users[user_id] = {"id": user_id, "email": user_id + "@example.test", "email_confirmed_at": "2026-10-20T00:00:00Z" if verified else None, "user_metadata": metadata or {}}
    client.headers["Authorization"] = "Bearer " + client.app.state.test_token(user_id)


def test_registration_validates_and_preserves_only_nonsecret_draft(client):
    sent = []
    provider_reply(client, inspect=lambda request: sent.append(request))
    response = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert response.status_code == 200
    payload = json.loads(sent[0].content)
    assert response.json() == {"status": "registered", "session": {"access_token": "provider-access", "refresh_token": "provider-refresh"}}
    assert payload["email"] == "aye@example.test"
    assert payload["password"] == " StrongPassword1! "  # Password whitespace is never trimmed.
    assert payload["data"]["registration_business"]["name"] == "Aye Trading"
    assert "password" not in json.dumps(payload["data"])
    assert sent[0].url.params["redirect_to"] == "http://localhost:3000/auth/callback"
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Business)) == 2
        assert session.get(User, "new-owner") is None


@pytest.mark.parametrize("change", [
    {"full_name": "  "}, {"email": "invalid-email"}, {"password": "short", "confirm_password": "short"},
    { "password": "weakpassword", "confirm_password": "weakpassword" },
    { "password": "STRONGPASSWORD1!", "confirm_password": "STRONGPASSWORD1!" },
    { "password": "StrongPassword!", "confirm_password": "StrongPassword!" },
    { "password": "StrongPassword1", "confirm_password": "StrongPassword1" },
    {"confirm_password": "different"}, {"business": {**BUSINESS, "name": " "}},
    {"business": {**BUSINESS, "industry": ""}}, {"business": {**BUSINESS, "city": " "}},
    {"business": {**BUSINESS, "phone": "not-a-phone"}}, {"business": {**BUSINESS, "currency": "USD"}},
    {"owner_id": "somebody-else"}, {"redirect_to": "https://attacker.example"},
])
def test_registration_rejects_invalid_input_without_echoing_password(client, change):
    payload = {**deepcopy(REGISTRATION), **change}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert payload["password"] not in response.text


def test_duplicate_email_prompts_sign_in_without_creating_workspace(client):
    provider_reply(client, 422, {"error_code": "user_already_exists"})
    response = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ACCOUNT_EXISTS"
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Business)) == 2


def test_provider_password_policy_is_enforced(client):
    provider_reply(client, 422, {"error_code": "weak_password", "weak_password": {"reasons": ["pwned"]}})
    response = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "PASSWORD_WEAK"


def test_email_autoconfirm_allows_signed_in_accounts(client):
    client.app.state.auth._public_settings = {"mailer_autoconfirm": True}
    assert client.get("/api/v1/auth/me").status_code == 200


def test_resend_and_reset_are_generic_and_rate_limited(client):
    provider_reply(client, 400, {"error_code": "user_not_found"})
    for endpoint in ("forgot-password",):
        response = client.post("/api/v1/auth/" + endpoint, json={"email": "nobody@example.test"})
        assert response.status_code == 200
        assert "nobody" not in response.text
        retry = client.post("/api/v1/auth/" + endpoint, json={"email": "nobody@example.test"})
        assert retry.status_code == 429
        assert 1 <= int(retry.headers["Retry-After"]) <= 60


@pytest.mark.parametrize("endpoint", ["forgot-password"])
def test_provider_delivery_failure_does_not_reveal_existing_accounts(client, endpoint):
    provider_reply(client, 503, {"error_code": "unexpected_failure"})
    result = client.post("/api/v1/auth/" + endpoint, json={"email": "existing@example.test"})
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "AUTH_UNAVAILABLE"
    assert "existing@example.test" not in result.text


def test_missing_config_does_not_consume_allowance_or_create_accounts(client):
    client.app.state.auth.close()
    client.app.state.auth = SupabaseAuth(replace(client.app.state.settings, supabase_url="", supabase_publishable_key=""))
    for _ in range(2):
        result = client.post("/api/v1/auth/register", json=REGISTRATION)
        assert result.status_code == 503
        assert result.json()["error"]["code"] == "AUTH_NOT_CONFIGURED"
        assert "retry-after" not in result.headers
    assert client.get("/api/v1/config").json()["auth_status"]["ready"] is False
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(AuthRequestLimit)) == 0
        assert session.scalar(select(func.count()).select_from(Business)) == 2
        assert session.scalar(select(func.count()).select_from(User)) == 1


@pytest.mark.parametrize("settings", [
    {"mailer_autoconfirm": True, "external": {"email": False}},
    {"mailer_autoconfirm": True, "external": {"email": True}, "disable_signup": True},
])
def test_public_readiness_checks_provider_not_just_key_presence(client, settings):
    client.app.state.auth._public_settings = settings
    import time
    client.app.state.auth._settings_checked_at = time.monotonic()
    config = client.get("/api/v1/config").json()
    assert config["auth_configured"] is True
    assert config["auth_status"]["ready"] is False
    assert client.post("/api/v1/auth/register", json=REGISTRATION).status_code == 503
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(AuthRequestLimit)) == 0


@pytest.mark.parametrize("status,body", [(401, {"message": "invalid API key"}), (200, [])])
def test_bad_provider_key_or_settings_blocks_signup_before_reservation(client, status, body):
    sent = []
    def transport(request):
        sent.append(request.url.path)
        return httpx.Response(status, json=body)
    client.app.state.auth.client.close()
    client.app.state.auth.client = httpx.Client(base_url="https://auth.example.test/auth/v1/", transport=httpx.MockTransport(transport))
    assert client.get("/api/v1/config").json()["auth_status"]["ready"] is False
    result = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "AUTH_SETUP_REQUIRED"
    assert all(path.endswith("/settings") for path in sent)
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(AuthRequestLimit)) == 0


@pytest.mark.parametrize("retry", [None, "invalid", "125", "http-date"])
def test_provider_rate_limit_is_explicit_and_preserves_only_known_timing(client, retry):
    if retry == "http-date":
        retry = format_datetime(datetime.now(timezone.utc) + timedelta(seconds=180), usegmt=True)
    requests = []
    provider_reply(client, 429, {"error_code": "over_email_send_rate_limit"}, inspect=requests.append,
                   headers={"Retry-After": retry} if retry else {})
    result = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert result.status_code == 429
    assert result.json()["error"]["code"] == "AUTH_RATE_LIMITED"
    assert result.headers.get("Retry-After") == retry
    # A known upstream deadline is project-wide and durable; even a different
    # address/flow cannot cause another outgoing request before it expires.
    if retry and retry != "invalid":
        again = client.post("/api/v1/auth/forgot-password", json={"email": "other@example.test"})
        assert again.status_code == 429
        assert int(again.headers["Retry-After"]) > 60
        assert len(requests) == 1


def test_confirmation_resend_uses_provider_resend_not_signup(client):
    sent = []
    provider_reply(client, inspect=sent.append, confirmation_required=True)
    response = client.post("/api/v1/auth/resend-verification", json={"email": "owner@example.test"})
    assert response.status_code == 200
    assert response.json()["status"] == "check_email"
    assert sent[0].url.path == "/auth/v1/resend"
    assert json.loads(sent[0].content) == {"type": "signup", "email": "owner@example.test"}


@pytest.mark.parametrize("nested", [False, True])
def test_confirmation_enabled_allows_signup_and_preserves_pending_business(client, nested):
    pending = {"id": "new-pending-user", "email": "aye@example.test", "email_confirmed_at": None, "identities": [{"provider": "email"}]}
    provider_reply(client, body={"user": pending} if nested else pending, confirmation_required=True)
    assert client.get("/api/v1/config").json()["auth_status"]["ready"] is True
    response = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert response.status_code == 200
    assert response.json()["status"] == "verification_required"
    assert response.json()["cooldown_seconds"] > 0
    assert "session" not in response.json()
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Business)) == 2
        assert session.get(User, "new-pending-user") is None


def test_confirmation_enabled_duplicate_response_never_creates_a_session(client):
    provider_reply(client, body={"id": "obfuscated-id", "email": "aye@example.test", "identities": []}, confirmation_required=True)
    response = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert response.status_code == 200
    assert response.json()["status"] == "check_email"
    assert "session" not in response.json()


@pytest.mark.parametrize("body", [
    {},
    {"id": "pending", "email": "other@example.test"},
    {"id": "pending", "email": "aye@example.test", "access_token": "incomplete"},
    {"id": "pending", "email": "aye@example.test", "email_confirmed_at": "confirmed"},
])
def test_confirmation_flow_rejects_malformed_or_incomplete_provider_responses(client, body):
    provider_reply(client, body=body, confirmation_required=True)
    response = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTH_REQUEST_UNCONFIRMED"


@pytest.mark.parametrize("body", [{}, {"access_token": "unexpected", "user": {"id": "u"}}, {"id": "u", "email_confirmed_at": "confirmed"}, {"id": "u", "email": "other@example.test"}])
def test_signup_requires_provider_session(client, body):
    provider_reply(client, body=body)
    response = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTH_REQUEST_UNCONFIRMED"


def test_obfuscated_existing_account_cannot_start_a_session(client):
    provider_reply(client, body={"id": "obfuscated-id", "email": "aye@example.test", "identities": []})
    result = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "AUTH_REQUEST_UNCONFIRMED"
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Business)) == 2


def test_smtp_configuration_rejection_is_not_success(client):
    provider_reply(client, 400, {"error_code": "email_address_not_authorized"})
    response = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTH_SETUP_REQUIRED"


def test_concurrent_signup_for_same_email_sends_only_once(client):
    sent = []
    provider_reply(client, inspect=sent.append)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post("/api/v1/auth/register", json=REGISTRATION), range(2)))
    assert sorted(result.status_code for result in results) == [200, 429]
    assert len(sent) == 1


def test_transport_timeout_is_unconfirmed_and_logs_no_credentials(client, caplog):
    def transport(request):
        if request.url.path.endswith("/settings"):
            return httpx.Response(200, json={"mailer_autoconfirm": True, "external": {"email": True}})
        raise httpx.ReadTimeout("sensitive upstream details", request=request)
    client.app.state.auth.client.close()
    client.app.state.auth.client = httpx.Client(base_url="https://auth.example.test/auth/v1/", transport=httpx.MockTransport(transport))
    result = client.post("/api/v1/auth/register", json=REGISTRATION)
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "AUTH_REQUEST_UNCONFIRMED"
    assert "outcome unknown" in caplog.text
    for secret in (REGISTRATION["password"], REGISTRATION["email"].strip(), "sensitive upstream details"):
        assert secret not in result.text + caplog.text


def test_signed_in_account_can_resume_draft_without_email_confirmation(client):
    user(client, verified=False, metadata={"full_name": "Aye Aye", "registration_business": BUSINESS})
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["pending_business"]["name"] == "Aye Trading"
    assert response.json()["onboarding_complete"] is False
    assert client.get("/api/v1/businesses").json()["businesses"] == []


def test_workspace_creation_retries_are_atomic_and_empty(client):
    user(client)
    payload = {**BUSINESS, "full_name": "Aye Aye"}
    first = client.post("/api/v1/auth/onboarding", json=payload)
    assert first.status_code == 200
    second = client.post("/api/v1/auth/onboarding", json={**payload, "name": "Different retry"})
    assert second.json() == {"business_id": first.json()["business_id"], "created": False}
    status = client.get("/api/v1/auth/me").json()
    assert status["onboarding_complete"]
    business_id = first.json()["business_id"]
    snapshot = client.get("/api/v1/data/snapshot", params={"business_id": business_id}).json()
    assert snapshot["source_version"] == 0
    assert all(not values for values in snapshot["tables"].values())
    assert len(client.get("/api/v1/businesses").json()["businesses"]) == 1
    assert client.get("/api/v1/data/snapshot?business_id=tea-shop").status_code == 403


def test_two_owners_cannot_read_modify_export_or_link_other_business(client, workbook_bytes):
    user(client, "owner-a")
    a = client.post("/api/v1/auth/onboarding", json={**BUSINESS, "full_name": "Owner A"}).json()["business_id"]
    user(client, "owner-b")
    b = client.post("/api/v1/auth/onboarding", json={**BUSINESS, "full_name": "Owner B"}).json()["business_id"]
    assert a != b
    for owner, other in (("owner-a", b), ("owner-b", a)):
        client.headers["Authorization"] = "Bearer " + client.app.state.test_token(owner)
        for path in ("snapshot", "sync-status", "template", "files"):
            assert client.get(f"/api/v1/data/{path}?business_id={other}").status_code == 403
        assert client.post(f"/api/v1/data/upload?business_id={other}", files={"file": ("book.xlsx", workbook_bytes)}).status_code == 403
        assert client.post(f"/api/v1/data/link?business_id={other}", json={"drive_id": "d", "item_id": "i"}).status_code == 403
        assert client.delete(f"/api/v1/data/link?business_id={other}").status_code == 403
        assert client.post(f"/api/v1/data/sync-now?business_id={other}").status_code == 403
    assert client.post("/api/v1/auth/onboarding", json={**BUSINESS, "full_name": "Owner B", "business_id": a, "owner_id": "owner-a"}).status_code == 400


def test_anonymous_expired_forged_and_old_demo_tokens_are_rejected(client):
    client.headers.pop("Authorization")
    assert client.get("/api/v1/businesses").status_code == 401
    for token in (client.app.state.test_token(expired=True), client.app.state.test_token(issuer="https://attacker.example"),
                  jwt.encode({"sub": "demo-user", "aud": "bizflow", "iss": "bizflow-demo"}, "old-secret-for-test-only-1234567890", algorithm="HS256")):
        client.headers["Authorization"] = "Bearer " + token
        assert client.get("/api/v1/businesses").status_code == 401
    assert client.post("/api/v1/auth/demo-login", json={"password": "old-demo-password"}).status_code == 404


def test_concurrent_onboarding_has_exactly_one_owner_membership(client):
    identity = Identity("parallel-owner", "parallel@example.test", {})
    data = Onboarding(**BUSINESS, full_name="Parallel Owner")
    def run(_): return complete_onboarding(client.app.state.sessions, identity, data)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, range(2)))
    assert results[0]["business_id"] == results[1]["business_id"]
    assert sorted(result["created"] for result in results) == [False, True]
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Membership).where(Membership.user_id == identity.user_id)) == 1


def test_onboarding_rolls_back_without_orphan_business(client, monkeypatch):
    from sqlalchemy.orm import Session
    identity = Identity("failed-owner", "failed@example.test", {})
    original = Session.flush
    def fail(self, *args, **kwargs):
        if any(isinstance(obj, Membership) and obj.user_id == identity.user_id for obj in self.new):
            raise RuntimeError("test membership failure")
        return original(self, *args, **kwargs)
    monkeypatch.setattr(Session, "flush", fail)
    with pytest.raises(RuntimeError): complete_onboarding(client.app.state.sessions, identity, Onboarding(**BUSINESS, full_name="Failed Owner"))
    with client.app.state.sessions() as session:
        assert session.scalar(select(Business).where(Business.owner_id == identity.user_id)) is None
        assert session.get(User, identity.user_id) is None
