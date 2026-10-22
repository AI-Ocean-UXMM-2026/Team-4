"""BizFlow platform composition. Feature routers are mounted when owners supply them."""
import importlib
import importlib.util
import hashlib
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from .core.config import get_settings
from .core.dependencies import authorize_business, current_user
from .core.errors import APIError, api_error_handler
from .core.account_router import router as auth_router
from .core.supabase_auth import SupabaseAuth
from .db.connection import make_engine, session_factory
from .db.migration_helpers import initialize_local_database
from .db.models import Business, Membership
from .integrations.excel.onedrive_auth import router as microsoft_router
from .integrations.excel.router import router as data_router

FEATURE_MODULES = {"financial": "app.features.financial.router", "working_capital": "app.features.working_capital.router",
                   "credit": "app.features.credit.router", "ai": "app.features.ai.router"}


class UploadLimitMiddleware:
    def __init__(self, app, limit):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] != "/api/v1/data/upload":
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > self.limit + 65536:
                return await JSONResponse(status_code=400, content={"error": {"code": "FILE_TOO_LARGE", "message": "Workbook exceeds the upload limit.", "details": []}})(scope, receive, send)
            chunks.append(message)
            if not message.get("more_body"):
                break
        async def replay():
            return chunks.pop(0) if chunks else await receive()
        await self.app(scope, replay, send)


def create_app(settings=None, engine=None):
    settings = settings or get_settings()
    engine = engine or make_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(_app):
        initialize_local_database(engine)
        yield
        app.state.auth.close()
        engine.dispose()

    app = FastAPI(title="BizFlow Platform", version="1.0.0", lifespan=lifespan)
    app.state.settings, app.state.engine = settings, engine
    app.state.sessions, app.state.auth = session_factory(engine), SupabaseAuth(settings)
    app.add_exception_handler(APIError, api_error_handler)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request, exc):
        details = [{"field": ".".join(str(part) for part in error["loc"][1:]), "message": error["msg"]} for error in exc.errors()]
        return JSONResponse(status_code=400, content={"error": {"code": "REQUEST_INVALID", "message": "Required request fields are missing or invalid.", "details": details}})

    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.add_middleware(UploadLimitMiddleware, limit=settings.max_upload_bytes)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=True,
                       allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"], expose_headers=["Retry-After"])
    app.include_router(auth_router)
    app.include_router(microsoft_router)
    app.include_router(data_router)
    modules = {}
    for name, module_path in FEATURE_MODULES.items():
        try:
            available = importlib.util.find_spec(module_path) is not None
        except ModuleNotFoundError:
            available = False
        modules[name] = available
        if available:
            app.include_router(importlib.import_module(module_path).router, dependencies=[Depends(authorize_business)])

    @app.get("/health")
    def health():
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "modules": modules}

    @app.get("/api/v1/config")
    def config():
        auth_status = {"ready": True, "code": None, "message": None}
        try:
            app.state.auth.require_account_configuration(signup=True)
        except APIError as error:
            auth_status = {"ready": False, "code": error.code, "message": error.message}
        return {"auth_provider": "supabase", "auth_configured": settings.auth_configured,
                "auth_status": auth_status, "auth_url": settings.supabase_url,
                "auth_key_fingerprint": hashlib.sha256(settings.supabase_publishable_key.encode()).hexdigest(),
                "password_policy": {"min_length": settings.password_min_length, "required_characters": list(filter(None, settings.password_required_characters.split(",")))},
                "graph_enabled": settings.graph_enabled, "modules": modules}

    @app.get("/api/v1/businesses")
    def businesses(user_id: str = Depends(current_user)):
        with app.state.sessions() as session:
            rows = session.scalars(select(Business).join(Membership).where(Membership.user_id == user_id).order_by(Business.id)).all()
            return {"businesses": [{"id": business.id, "name": business.name, "source_version": business.version} for business in rows]}

    return app


# Use `uvicorn app.main:create_app --factory --app-dir backend`.
