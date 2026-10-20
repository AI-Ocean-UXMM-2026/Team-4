import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Request
from jwt import PyJWKClient
from pydantic import BaseModel, Field

from .errors import APIError

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


def authenticate(token: str, settings, jwks=None) -> str:
    try:
        if settings.auth_mode == "demo":
            claims = jwt.decode(token, settings.session_secret, algorithms=["HS256"],
                                audience="bizflow", issuer="bizflow-demo", options={"require": ["exp", "sub", "iat"]})
        else:
            key = jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["RS256", "ES256"], audience="authenticated",
                                issuer=settings.supabase_url + "/auth/v1", options={"require": ["exp", "sub", "iat"]})
        return claims["sub"]
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise APIError(401, "UNAUTHENTICATED", "Your session expired. Sign in again.") from None


def make_jwks(settings):
    if settings.auth_mode == "supabase":
        return PyJWKClient(settings.supabase_url + "/auth/v1/.well-known/jwks.json", cache_keys=True)
    return None


class Login(BaseModel):
    password: str = Field(min_length=1, max_length=500)


@router.post("/demo-login")
def demo_login(body: Login, request: Request):
    settings = request.app.state.settings
    if settings.auth_mode != "demo":
        raise APIError(404, "DEMO_DISABLED", "Use your Supabase account to sign in.")
    ip = request.client.host if request.client else "unknown"
    attempts = request.app.state.login_attempts
    if len(attempts) > 4096:
        attempts.pop(next(iter(attempts)))
    recent = attempts[ip]
    moment = time.monotonic()
    while recent and recent[0] < moment - 60:
        recent.popleft()
    if len(recent) >= 10:
        raise APIError(429, "RATE_LIMITED", "Too many sign-in attempts. Try again in one minute.", headers={"Retry-After": "60"})
    recent.append(moment)
    if not secrets.compare_digest(body.password.encode(), settings.demo_password.encode()):
        raise APIError(401, "INVALID_CREDENTIALS", "Incorrect demo password.")
    now = datetime.now(timezone.utc)
    return {"access_token": jwt.encode({"sub": "demo-user", "aud": "bizflow", "iss": "bizflow-demo",
                                        "iat": now, "exp": now + timedelta(hours=8)}, settings.session_secret, algorithm="HS256"),
            "token_type": "bearer"}
