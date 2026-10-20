from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..db.models import Business, Membership, User
from .errors import APIError
from .supabase_auth import Identity

bearer = HTTPBearer(auto_error=False)


def current_identity(request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> Identity:
    if not credentials:
        raise APIError(401, "UNAUTHENTICATED", "Sign in to access business data.")
    return request.app.state.auth.identity(credentials.credentials)


def current_user(identity: Annotated[Identity, Depends(current_identity)]) -> str:
    return identity.user_id


def authorize_business(request: Request, business_id: str, user_id: Annotated[str, Depends(current_user)]) -> str:
    with request.app.state.sessions() as session:
        if session.get(Membership, (business_id, user_id)) is None:
            raise APIError(403, "BUSINESS_FORBIDDEN", "You do not have access to this business.")
        user, business = session.get(User, user_id), session.get(Business, business_id)
        if not user or not user.full_name or not business.industry or not business.city:
            raise APIError(403, "ONBOARDING_REQUIRED", "Complete your business setup before accessing records.")
    return user_id
