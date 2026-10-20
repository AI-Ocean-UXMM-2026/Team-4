from fastapi import APIRouter, Depends, Request

from .account_schemas import EmailInput, Onboarding, Registration, check_password
from .account_service import account_status, complete_onboarding
from .auth_rate_limit import reserve_email_request, remember_provider_retry
from .dependencies import current_identity
from .errors import APIError
from .supabase_auth import Identity

router = APIRouter(prefix="/api/v1/auth", tags=["accounts"])
EMAIL_MESSAGE = "Check your inbox and spam folder. An accepted request does not confirm account creation or email delivery. If you already have an account, sign in or reset your password."


def email_request(request, action, email):
    # Configuration errors must never consume an email request allowance.
    request.app.state.auth.require_email_confirmation(signup=action == "signup")
    return reserve_email_request(request.app.state.sessions, "verify" if action in ("signup", "resend") else action, email, request.client.host if request.client else "unknown")


def provider_email(request, path, payload, callback):
    try:
        return request.app.state.auth.request("POST", path, params={"redirect_to": callback}, json=payload)
    except APIError as error:
        if error.status == 429:
            remember_provider_retry(request.app.state.sessions, error.headers.get("Retry-After"))
        raise


def email_result(cooldown, status="check_email"):
    # This is a known application throttle, not an invented provider retry time.
    return {"status": status, "message": EMAIL_MESSAGE, "cooldown_seconds": cooldown}


def check_email_response(response):
    if response.status_code >= 400:
        try:
            code = response.json().get("error_code") or response.json().get("code")
        except (ValueError, AttributeError):
            code = None
        if code not in ("user_not_found", "email_not_confirmed"):
            raise APIError(503, "EMAIL_REQUEST_FAILED", "The email request could not be completed. Delivery is not confirmed. Please try again later.")


@router.post("/register")
def register(body: Registration, request: Request):
    check_password(body.password, request.app.state.settings)
    cooldown = email_request(request, "signup", body.email)
    response = provider_email(request, "signup", {"email": body.email, "password": body.password, "data": {"full_name": body.full_name, "registration_business": body.business.model_dump()}}, request.app.state.settings.frontend_url + "/auth/callback")
    try:
        result = response.json()
        if not isinstance(result, dict):
            result = {}
    except ValueError:
        result = {}
    if response.status_code >= 400:
        error = result
        code = error.get("error_code") or error.get("code")
        if code in ("weak_password", "validation_failed") or error.get("weak_password"):
            raise APIError(400, "PASSWORD_WEAK", "Password does not meet the account provider's password policy. Review the requirements.")
        if code not in ("user_already_exists", "email_exists", "user_already_registered"):
            raise APIError(400, "REGISTRATION_UNAVAILABLE", "Registration could not be completed. Check your details and try again.")
        return email_result(cooldown)
    # A valid confirmation-required user response is required; an empty 200 is not proof.
    user = result.get("user") or result
    if not isinstance(user, dict) or not isinstance(user.get("id"), str) or not user.get("id") or not isinstance(user.get("email"), str) or user["email"].casefold() != body.email.casefold() or result.get("access_token") or result.get("session") or user.get("email_confirmed_at"):
        raise APIError(503, "AUTH_REQUEST_UNCONFIRMED", "Registration was not confirmed as awaiting verification. Check your email or request a verification email before retrying.")
    # Never create local membership from an unauthenticated signup response (which may be obfuscated).
    # Supabase preserves the non-secret business draft until the owner verifies/signs in.
    # Supabase can deliberately obfuscate an existing account with empty identities.
    # That response cannot establish that a new pending account was created.
    return email_result(cooldown, "check_email" if user.get("identities") == [] else "verification_required")


@router.post("/resend-verification")
def resend(body: EmailInput, request: Request):
    cooldown = email_request(request, "resend", body.email)
    response = provider_email(request, "resend", {"type": "signup", "email": body.email}, request.app.state.settings.frontend_url + "/auth/callback")
    check_email_response(response)
    return email_result(cooldown)


@router.post("/forgot-password")
def forgot(body: EmailInput, request: Request):
    cooldown = email_request(request, "recover", body.email)
    response = provider_email(request, "recover", {"email": body.email}, request.app.state.settings.frontend_url + "/auth/callback?flow=recovery")
    check_email_response(response)
    return email_result(cooldown)


@router.get("/me")
def me(request: Request, identity: Identity = Depends(current_identity)):
    return account_status(request.app.state.sessions, identity)


@router.post("/onboarding")
def onboarding(body: Onboarding, request: Request, identity: Identity = Depends(current_identity)):
    return complete_onboarding(request.app.state.sessions, identity, body)
