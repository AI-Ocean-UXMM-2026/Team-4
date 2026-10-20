"""Server-only configuration. Never put these values in VITE_* variables."""
import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite:///./bizflow.db"
    auth_mode: str = "supabase"
    session_secret: str = ""
    demo_password: str = ""
    supabase_url: str = ""
    frontend_url: str = "http://localhost:3000"
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)
    max_upload_bytes: int = 5 * 1024 * 1024
    microsoft_tenant_id: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_redirect_uri: str = "http://localhost:8000/api/v1/auth/microsoft/callback"
    token_encryption_key: str = ""
    allow_demo_reset: bool = False

    @property
    def graph_enabled(self) -> bool:
        return all((self.microsoft_tenant_id, self.microsoft_client_id,
                    self.microsoft_client_secret, self.token_encryption_key))


@lru_cache
def get_settings() -> Settings:
    settings = Settings(
        database_url=os.getenv("DATABASE_URL", "sqlite:///./bizflow.db"),
        auth_mode=os.getenv("AUTH_MODE", "supabase"),
        session_secret=os.getenv("SESSION_SECRET", ""),
        demo_password=os.getenv("DEMO_PASSWORD", ""),
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/"),
        cors_origins=tuple(x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()),
        max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024))),
        microsoft_tenant_id=os.getenv("MICROSOFT_TENANT_ID", ""),
        microsoft_client_id=os.getenv("MICROSOFT_CLIENT_ID", ""),
        microsoft_client_secret=os.getenv("MICROSOFT_CLIENT_SECRET", ""),
        microsoft_redirect_uri=os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:8000/api/v1/auth/microsoft/callback"),
        token_encryption_key=os.getenv("TOKEN_ENCRYPTION_KEY", ""),
        allow_demo_reset=os.getenv("ALLOW_DEMO_RESET", "false").lower() == "true",
    )
    if settings.auth_mode not in ("demo", "supabase"):
        raise RuntimeError("AUTH_MODE must be demo or supabase")
    if settings.auth_mode == "demo" and (len(settings.session_secret) < 32 or len(settings.demo_password) < 12):
        raise RuntimeError("Demo mode requires SESSION_SECRET (32+ chars) and DEMO_PASSWORD (12+ chars)")
    if settings.auth_mode == "supabase" and not settings.supabase_url.startswith("https://"):
        raise RuntimeError("SUPABASE_URL must be configured for Supabase authentication")
    if settings.graph_enabled:
        from cryptography.fernet import Fernet
        Fernet(settings.token_encryption_key.encode())
    return settings
