from fastapi import Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str, *, details=None, headers=None):
        self.status, self.code, self.message = status, code, message
        self.details = details or []
        self.headers = headers or {}


async def api_error_handler(_request: Request, exc: APIError):
    return JSONResponse(status_code=exc.status, headers=exc.headers, content={
        "error": {"code": exc.code, "message": exc.message, "details": exc.details}
    })
