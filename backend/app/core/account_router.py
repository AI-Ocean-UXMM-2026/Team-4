from fastapi import APIRouter, Depends, Request

from .account_schemas import EmailInput, Onboarding, Registration, check_password
from .account_service import account_status, complete_onboarding
from .auth_rate_limit import reserve_email_request, remember_provider_retry
from .dependencies import current_identity
from .errors import APIError
from .supabase_auth import Identity

router = APIRouter(prefix="/api/v1/auth", tags=["accounts"])
EMAIL_MESSAGE = "If an account exists for this email, check your inbox and spam folder for a password reset link. This response does not confirm email delivery."


def email_request(request, action, email):
    # Configuration errors must never consume an email request allowance.
    request.app.state.auth.require_account_configuration(signup=action == "signup")
    return reserve_email_request(request.app.state.sessions, "signup" if action == "resend" else action, email, request.client.host if request.client else "unknown")


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
        if code in ("user_already_exists", "email_exists", "user_already_registered"):
            raise APIError(409, "ACCOUNT_EXISTS", "An account already exists with this email. Sign in or reset your password.")
        raise APIError(400, "REGISTRATION_UNAVAILABLE", "Registration could not be completed. Check your details and try again.")
    user = result.get("user") or result
    tokens = {name: result.get(name) for name in ("access_token", "refresh_token")}
    if not isinstance(user, dict) or not isinstance(user.get("id"), str) or not user.get("id") or not isinstance(user.get("email"), str) or user["email"].casefold() != body.email.casefold():
        raise APIError(503, "AUTH_REQUEST_UNCONFIRMED", "The account service did not confirm registration. Try signing in before registering again.")
    if not any(tokens.values()) and request.app.state.auth.email_confirmation_required and not user.get("email_confirmed_at"):
        # Pending confirmation and deliberately obfuscated duplicate responses are
        # not authenticated sessions and must never create local memberships.
        return {"status": "check_email" if user.get("identities") == [] else "verification_required",
                "message": "Check your inbox and spam folder for a confirmation link. If you already have an account, sign in or reset your password.",
                "cooldown_seconds": cooldown}
    if not all(isinstance(token, str) and token for token in tokens.values()):
        raise APIError(503, "AUTH_REQUEST_UNCONFIRMED", "The account service did not return a sign-in session. Try signing in before registering again.")
    # Membership is created only after the returned session passes JWT/provider checks.
    return {"status": "registered", "session": tokens}


@router.post("/resend-verification")
def resend(body: EmailInput, request: Request):
    cooldown = email_request(request, "resend", body.email)
    response = provider_email(request, "resend", {"type": "signup", "email": body.email}, request.app.state.settings.frontend_url + "/auth/callback")
    check_email_response(response)
    return {"status": "check_email", "message": "If this address needs confirmation, check your inbox and spam folder for the link.", "cooldown_seconds": cooldown}


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
