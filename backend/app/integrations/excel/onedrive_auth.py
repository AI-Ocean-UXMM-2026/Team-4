"""Delegated OAuth with PKCE and browser-bound state; encrypted server-only tokens."""
import base64
import hashlib
import json
import secrets
import time
from datetime import timedelta, timezone
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select

from ...core.dependencies import authorize_business
from ...core.errors import APIError
from ...db.models import Membership, OAuthState, WorkbookSource, now
from .import_service import lock_business

router = APIRouter(prefix="/api/v1/auth/microsoft", tags=["Microsoft OAuth"])
SCOPES = "https://graph.microsoft.com/Files.Read offline_access"


def cipher(settings):
    return Fernet(settings.token_encryption_key.encode())


def require_graph(settings):
    if not settings.graph_enabled:
        raise APIError(503, "GRAPH_UNAVAILABLE", "OneDrive is not configured. Use manual upload.")


def authority(settings):
    import re
    if not re.fullmatch(r"[A-Za-z0-9.-]+", settings.microsoft_tenant_id):
        raise APIError(503, "GRAPH_UNAVAILABLE", "Invalid Microsoft tenant configuration.")
    return f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}/oauth2/v2.0"


def token_request(settings, fields):
    try:
        response = httpx.post(authority(settings) + "/token", data={
            "client_id": settings.microsoft_client_id, "client_secret": settings.microsoft_client_secret,
            "scope": SCOPES, **fields}, timeout=20)
        if response.status_code != 200:
            raise APIError(401, "GRAPH_RECONNECT", "Microsoft authorization expired or consent was denied. Reconnect OneDrive.")
        tokens = response.json()
        if not tokens.get("access_token"):
            raise APIError(401, "GRAPH_RECONNECT", "Microsoft did not provide file access. Reconnect OneDrive.")
        tokens["expires_at"] = time.time() + int(tokens.get("expires_in", 3600))
        return tokens
    except httpx.RequestError:
        raise APIError(503, "GRAPH_UNAVAILABLE", "Microsoft sign-in is temporarily unavailable. Use manual upload.") from None


@router.get("/connect")
def connect(request: Request, business_id: str, user_id: str = Depends(authorize_business)):
    settings = request.app.state.settings
    require_graph(settings)
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    with request.app.state.sessions.begin() as session:
        session.add(OAuthState(id=hashlib.sha256(state.encode()).hexdigest(), business_id=business_id, user_id=user_id,
                               verifier_ciphertext=cipher(settings).encrypt(verifier.encode()).decode(), expires_at=now() + timedelta(minutes=10)))
    response = JSONResponse({"authorization_url": authority(settings) + "/authorize?" + urlencode({
        "client_id": settings.microsoft_client_id, "response_type": "code", "redirect_uri": settings.microsoft_redirect_uri,
        "scope": SCOPES, "state": state, "code_challenge": challenge, "code_challenge_method": "S256", "response_mode": "query"})})
    response.set_cookie("bizflow_oauth_state", state, httponly=True, secure=settings.microsoft_redirect_uri.startswith("https://"),
                        samesite="lax", max_age=600, path="/api/v1/auth/microsoft")
    return response


@router.get("/callback")
def callback(request: Request, state: str = "", code: str = "", error: str = ""):
    settings = request.app.state.settings
    require_graph(settings)
    if not state or not secrets.compare_digest(request.cookies.get("bizflow_oauth_state", ""), state):
        raise APIError(400, "OAUTH_STATE_INVALID", "Microsoft sign-in could not be verified. Start again.")
    with request.app.state.sessions.begin() as session:
        entry = session.get(OAuthState, hashlib.sha256(state.encode()).hexdigest(), with_for_update=True)
        if not entry or entry.expires_at.replace(tzinfo=timezone.utc) < now():
            raise APIError(400, "OAUTH_STATE_EXPIRED", "Sign-in expired. Start again.")
        business_id, user_id = entry.business_id, entry.user_id
        verifier = cipher(settings).decrypt(entry.verifier_ciphertext.encode()).decode()
        session.delete(entry)
    if error or not code:
        raise APIError(400, "MICROSOFT_CONSENT_DENIED", "Microsoft sign-in was cancelled or blocked. Manual upload is available.")
    tokens = token_request(settings, {"grant_type": "authorization_code", "code": code,
                                      "redirect_uri": settings.microsoft_redirect_uri, "code_verifier": verifier})
    with request.app.state.sessions.begin() as session:
        lock_business(session, business_id)
        if session.get(Membership, (business_id, user_id)) is None:
            raise APIError(403, "BUSINESS_FORBIDDEN", "Business membership was removed.")
        source = session.scalar(select(WorkbookSource).where(WorkbookSource.business_id == business_id))
        if source is None:
            source = WorkbookSource(business_id=business_id)
            session.add(source)
        source.token_ciphertext = cipher(settings).encrypt(json.dumps(tokens).encode()).decode()
        source.linked_user_id, source.drive_id, source.item_id, source.last_etag = user_id, None, None, None
        source.kind = "manual"
    response = RedirectResponse(settings.frontend_url + "/data-source?microsoft=connected", status_code=303)
    response.delete_cookie("bizflow_oauth_state", path="/api/v1/auth/microsoft")
    return response


def access_token(session, source, user_id, settings):
    require_graph(settings)
    if source.linked_user_id != user_id or not source.token_ciphertext:
        raise APIError(401, "GRAPH_RECONNECT", "Connect your Microsoft account to access this workbook.")
    try:
        tokens = json.loads(cipher(settings).decrypt(source.token_ciphertext.encode()))
    except Exception:
        raise APIError(401, "GRAPH_RECONNECT", "Saved Microsoft authorization is unavailable. Reconnect.") from None
    if tokens["expires_at"] <= time.time() + 60:
        if not tokens.get("refresh_token"):
            raise APIError(401, "GRAPH_RECONNECT", "Microsoft sign-in expired. Reconnect OneDrive.")
        refreshed = token_request(settings, {"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"]})
        refreshed.setdefault("refresh_token", tokens["refresh_token"])
        tokens = refreshed
        source.token_ciphertext = cipher(settings).encrypt(json.dumps(tokens).encode()).decode()
        session.flush()
    return tokens["access_token"]
