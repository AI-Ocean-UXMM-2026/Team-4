from copy import deepcopy

import pytest
from sqlalchemy import func, select

from app.db.models import Business, ImportBatch, ImportedRow, Membership, PROJECTIONS, User, WorkbookSource


BUSINESS = {"name": "Aye Trading", "industry": "Retail", "city": "Yangon",
            "phone": "+95 9 12345678", "address": "", "currency": "MMK"}


def sign_in(client, user_id):
    client.app.state.test_users[user_id] = {"id": user_id, "email": user_id + "@example.test",
                                           "user_metadata": {"full_name": "Provider Name"}}
    client.headers["Authorization"] = "Bearer " + client.app.state.test_token(user_id)


def create_owner(client, user_id):
    sign_in(client, user_id)
    result = client.post("/api/v1/auth/onboarding", json={**BUSINESS, "full_name": user_id})
    assert result.status_code == 200
    return result.json()["business_id"]


@pytest.mark.parametrize("method", ["get", "post"])
def test_profile_requires_a_verified_session(client, method):
    request = getattr(client, method)
    arguments = {"json": {"full_name": "New Name"}} if method == "post" else {}
    client.headers.pop("Authorization")
    assert request("/api/v1/auth/profile", **arguments).status_code == 401
    client.headers["Authorization"] = "Bearer invalid-token"
    assert request("/api/v1/auth/profile", **arguments).status_code == 401


def test_profile_returns_identity_and_only_owned_business(client):
    business_id = create_owner(client, "owner-profile")
    with client.app.state.sessions.begin() as session:
        session.add(Membership(business_id="private", user_id="owner-profile"))
    response = client.get("/api/v1/auth/profile")
    assert response.status_code == 200
    assert response.json() == {"user": {"id": "owner-profile", "email": "owner-profile@example.test", "full_name": "owner-profile"},
                               "business": {"id": business_id, **BUSINESS}}


@pytest.mark.parametrize("include_business", [False, True])
def test_personal_profile_can_be_saved_without_a_business(client, include_business):
    sign_in(client, "personal-profile")
    initial = client.get("/api/v1/auth/profile").json()
    assert initial["user"]["full_name"] == "Provider Name"
    assert initial["business"] is None
    body = {"full_name": "  Personal Name  "}
    if include_business:
        body["business"] = None
    saved = client.post("/api/v1/auth/profile", json=body)
    assert saved.status_code == 200
    assert saved.json() == {"user": {"id": "personal-profile", "email": "personal-profile@example.test", "full_name": "Personal Name"},
                            "business": None}
    assert client.get("/api/v1/auth/profile").json() == saved.json()
    assert client.get("/api/v1/auth/me").json()["user"]["full_name"] == "Personal Name"


def test_profile_updates_persist_without_changing_ledger_or_ownership(client):
    business_id = create_owner(client, "save-profile")
    with client.app.state.sessions.begin() as session:
        session.get(Business, business_id).version = 7
        before = {model.__tablename__: session.scalar(select(func.count()).select_from(model))
                  for model in (Membership, WorkbookSource, ImportBatch, ImportedRow)}
        projections = {name: session.execute(select(table)).mappings().all() for name, table in PROJECTIONS.items()}
    changed = {"name": "  New Shop  ", "industry": "  Food  ", "city": "  Mandalay  ",
               "phone": "  +95 9 87654321  ", "address": "  25 Market Road  ", "currency": "MMK"}
    saved = client.post("/api/v1/auth/profile", json={"full_name": "  Aye Aye  ", "business": changed})
    assert saved.status_code == 200
    assert saved.json()["user"] == {"id": "save-profile", "email": "save-profile@example.test", "full_name": "Aye Aye"}
    assert saved.json()["business"] == {"id": business_id, **{key: value.strip() for key, value in changed.items()}}
    assert client.get("/api/v1/auth/profile").json() == saved.json()
    with client.app.state.sessions() as session:
        business = session.get(Business, business_id)
        assert (business.owner_id, business.version) == ("save-profile", 7)
        assert session.get(User, "save-profile").full_name == "Aye Aye"
        assert {model.__tablename__: session.scalar(select(func.count()).select_from(model))
                for model in (Membership, WorkbookSource, ImportBatch, ImportedRow)} == before
        assert {name: session.execute(select(table)).mappings().all() for name, table in PROJECTIONS.items()} == projections
    cleared = client.post("/api/v1/auth/profile", json={"full_name": "Aye Aye", "business": {**BUSINESS, "phone": " ", "address": " "}})
    assert cleared.status_code == 200
    assert cleared.json()["business"]["phone"] == cleared.json()["business"]["address"] == ""


@pytest.mark.parametrize("change", [
    {"full_name": " "}, {"full_name": "x" * 121}, {"full_name": None},
    {"email": "other@example.test"}, {"user_id": "somebody-else"}, {"owner_id": "somebody-else"},
    {"business_id": "private"}, {"password": "unsolicited-secret"},
    {"business": {**BUSINESS, "name": " "}}, {"business": {**BUSINESS, "industry": " "}},
    {"business": {**BUSINESS, "city": " "}}, {"business": {**BUSINESS, "phone": "not-a-phone"}},
    {"business": {**BUSINESS, "currency": "USD"}}, {"business": {**BUSINESS, "id": "private"}},
    {"business": {**BUSINESS, "owner_id": "other-owner"}},
])
def test_profile_invalid_input_is_atomic_and_rejects_identity_fields(client, change):
    create_owner(client, "validate-profile")
    original = client.get("/api/v1/auth/profile").json()
    body = {"full_name": "Should Not Save", "business": deepcopy(BUSINESS), **change}
    response = client.post("/api/v1/auth/profile", json=body)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "REQUEST_INVALID"
    assert client.get("/api/v1/auth/profile").json() == original


def test_membership_does_not_authorize_editing_another_owners_profile(client):
    business_id = create_owner(client, "actual-owner")
    sign_in(client, "member-only")
    assert client.post("/api/v1/auth/profile", json={"full_name": "Member Name"}).status_code == 200
    with client.app.state.sessions.begin() as session:
        session.add(Membership(business_id=business_id, user_id="member-only"))
    original = client.get("/api/v1/auth/profile").json()
    response = client.post("/api/v1/auth/profile", json={"full_name": "Should Not Save", "business": {**BUSINESS, "name": "Taken Over"}})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PROFILE_BUSINESS_MISSING"
    assert response.json()["error"]["message"] == "Finish business setup before updating business details."
    assert client.get("/api/v1/auth/profile").json() == original
    with client.app.state.sessions() as session:
        assert session.get(Business, business_id).name == BUSINESS["name"]
        assert session.get(User, "actual-owner").full_name == "actual-owner"


def test_owners_update_only_their_own_profile_even_with_other_memberships(client):
    business_a = create_owner(client, "owner-a-profile")
    business_b = create_owner(client, "owner-b-profile")
    with client.app.state.sessions.begin() as session:
        session.add(Membership(business_id=business_a, user_id="owner-b-profile"))
    response = client.post("/api/v1/auth/profile", json={"full_name": "Owner B Updated", "business": {**BUSINESS, "name": "B Updated"}})
    assert response.status_code == 200
    assert response.json()["business"]["id"] == business_b
    sign_in(client, "owner-a-profile")
    profile_a = client.get("/api/v1/auth/profile").json()
    assert profile_a["business"] == {"id": business_a, **BUSINESS}
    assert profile_a["user"]["full_name"] == "owner-a-profile"
