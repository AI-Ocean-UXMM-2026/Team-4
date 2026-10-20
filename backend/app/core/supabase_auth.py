"""Supabase is the sole identity/password authority. No local password database."""
from dataclasses import dataclass
import time
import logging
import re

import httpx
import jwt
from jwt import PyJWKClient

from .errors import APIError


@dataclass(frozen=True)
class Identity:
    user_id: str
    email: str
    metadata: dict


class SupabaseAuth:
    def __init__(self, settings, *, transport=None, jwks=None):
        self.settings = settings
        self._public_settings = None
        self._settings_checked_at = 0
        self.jwks = jwks or (PyJWKClient(settings.supabase_url + "/auth/v1/.well-known/jwks.json", cache_keys=True) if settings.auth_configured else None)
        self.client = httpx.Client(base_url=(settings.supabase_url or "https://unconfigured.invalid") + "/auth/v1/",
                                   headers={"apikey": settings.supabase_publishable_key}, timeout=15, transport=transport)

    def request(self, method, path, **kwargs):
        if not self.settings.auth_configured:
            raise APIError(503, "AUTH_NOT_CONFIGURED", "Account access is not configured yet. Contact your administrator.")
        try:
            response = self.client.request(method, path, **kwargs)
        except httpx.RequestError:
            logging.getLogger(__name__).warning("Supabase operation=%s transport_failure; outcome unknown", path)
            if path not in ("signup", "resend", "recover"):
                raise APIError(503, "AUTH_UNAVAILABLE", "Account service is unavailable. Please try again later.") from None
            raise APIError(503, "AUTH_REQUEST_UNCONFIRMED", "The account service did not confirm the request. Check your email before retrying; you can also request a verification email.") from None
        try:
            data = response.json()
        except ValueError:
            data = {}
        code = str(data.get("error_code") or data.get("code") or "") if isinstance(data, dict) else ""
        # Never log email addresses, payloads, URLs with queries, or provider error descriptions.
        logging.getLogger("uvicorn.error").info("Supabase operation=%s status=%s code=%s request_id=%s", path, response.status_code,
            re.sub(r"[^a-zA-Z0-9_-]", "", code)[:80], re.sub(r"[^a-zA-Z0-9_-]", "", response.headers.get("x-request-id", ""))[:100])
        if response.status_code == 429:
            retry = response.headers.get("Retry-After")
            raise APIError(429, "AUTH_RATE_LIMITED", "The email provider is limiting requests. Please wait before trying again.", headers={"Retry-After": retry} if retry else {})
        if code in ("email_address_not_authorized", "email_provider_disabled", "signup_disabled") or response.status_code in (401, 403) and path == "settings":
            raise APIError(503, "AUTH_SETUP_REQUIRED", "Account or email delivery configuration needs administrator attention. Please try again later.")
        if response.status_code >= 500:
            raise APIError(503, "AUTH_UNAVAILABLE", "The account or email service could not complete the request. Delivery is not confirmed. Please try again later.")
        return response

    def identity(self, token: str) -> Identity:
        if not self.settings.auth_configured:
            raise APIError(503, "AUTH_NOT_CONFIGURED", "Account access is not configured yet.")
        try:
            key = self.jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["RS256", "ES256"], audience="authenticated",
                                issuer=self.settings.supabase_url + "/auth/v1", options={"require": ["exp", "sub", "iat"]})
            if claims.get("role") != "authenticated" or claims.get("is_anonymous"):
                raise ValueError("An email account is required")
        except jwt.PyJWKClientConnectionError:
            raise APIError(503, "AUTH_UNAVAILABLE", "Account verification is temporarily unavailable.") from None
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            raise APIError(401, "UNAUTHENTICATED", "Your session expired. Sign in again.") from None
        self.require_email_confirmation()
        # Email confirmation is verified with the provider, never inferred from browser metadata.
        response = self.request("GET", "user", headers={"Authorization": "Bearer " + token})
        if response.status_code != 200:
            raise APIError(401, "UNAUTHENTICATED", "Your session expired. Sign in again.")
        user = response.json()
        if user.get("id") != claims["sub"] or user.get("is_anonymous"):
            raise APIError(401, "UNAUTHENTICATED", "Sign in with a verified email account.")
        if not user.get("email_confirmed_at") or not user.get("email"):
            raise APIError(403, "EMAIL_UNVERIFIED", "Verify your email before continuing.")
        return Identity(user["id"], user["email"], user.get("user_metadata") or {})

    def require_email_confirmation(self, *, signup=False):
        if self._public_settings is None or time.monotonic() - self._settings_checked_at > 60:
            response = self.request("GET", "settings")
            if response.status_code != 200:
                raise APIError(503, "AUTH_UNAVAILABLE", "Account configuration could not be verified.")
            try:
                data = response.json()
                if not isinstance(data, dict) or not isinstance(data.get("external"), dict):
                    raise ValueError("Invalid public settings")
            except ValueError:
                raise APIError(503, "AUTH_SETUP_REQUIRED", "Account configuration could not be verified. Contact your administrator.") from None
            self._public_settings = data
            self._settings_checked_at = time.monotonic()
        if self._public_settings.get("mailer_autoconfirm") is not False:
            raise APIError(503, "AUTH_SETUP_REQUIRED", "Account email verification must be enabled by your administrator.")
        if signup and (self._public_settings.get("disable_signup") or not self._public_settings.get("external", {}).get("email")):
            raise APIError(503, "REGISTRATION_UNAVAILABLE", "Email registration is not available. Contact your administrator.")

    def close(self):
        self.client.close()
