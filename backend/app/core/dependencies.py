from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..db.models import Membership
from .errors import APIError
from .security import authenticate

bearer = HTTPBearer(auto_error=False)


def current_user(request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> str:
    if not credentials:
        raise APIError(401, "UNAUTHENTICATED", "Sign in to access business data.")
    return authenticate(credentials.credentials, request.app.state.settings, request.app.state.jwks)


def authorize_business(request: Request, business_id: str, user_id: Annotated[str, Depends(current_user)]) -> str:
    with request.app.state.sessions() as session:
        if session.get(Membership, (business_id, user_id)) is None:
            raise APIError(403, "BUSINESS_FORBIDDEN", "You do not have access to this business.")
    return user_id
