from fastapi import Request
from fastapi.responses import JSONResponse
import logging


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str, *, details=None, headers=None):
        self.status, self.code, self.message = status, code, message
        self.details = details or []
        self.headers = headers or {}


async def api_error_handler(_request: Request, exc: APIError):
    if _request.url.path.startswith("/api/v1/auth/"):
        logging.getLogger(__name__).warning("Account operation=%s status=%s code=%s", _request.url.path.rsplit("/", 1)[-1], exc.status, exc.code)
    return JSONResponse(status_code=exc.status, headers=exc.headers, content={
        "error": {"code": exc.code, "message": exc.message, "details": exc.details}
    })
