"""Server-only configuration. Never put these values in VITE_* variables."""
import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite:///./bizflow.db"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    password_min_length: int = 8
    password_required_characters: str = "lower,upper,number,symbol"
    frontend_url: str = "http://localhost:3000"
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)
    max_upload_bytes: int = 5 * 1024 * 1024
    microsoft_tenant_id: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_redirect_uri: str = "http://localhost:8000/api/v1/auth/microsoft/callback"
    token_encryption_key: str = ""

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key)

    @property
    def graph_enabled(self) -> bool:
        return all((self.microsoft_tenant_id, self.microsoft_client_id,
                    self.microsoft_client_secret, self.token_encryption_key))


@lru_cache
def get_settings() -> Settings:
    default_db = "sqlite:////tmp/bizflow.db" if os.getenv("VERCEL") else "sqlite:///./bizflow.db"
    db_url = os.getenv("DATABASE_URL", default_db)
    if os.getenv("VERCEL") and (db_url == "sqlite:///./bizflow.db" or "./bizflow.db" in db_url):
        db_url = "sqlite:////tmp/bizflow.db"

    settings = Settings(
        database_url=db_url,
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        supabase_publishable_key=os.getenv("SUPABASE_PUBLISHABLE_KEY", ""),
        password_min_length=int(os.getenv("AUTH_PASSWORD_MIN_LENGTH", "8")),
        password_required_characters=os.getenv("AUTH_PASSWORD_REQUIRED_CHARACTERS", "lower,upper,number,symbol"),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/"),
        cors_origins=tuple(x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()),
        max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024))),
        microsoft_tenant_id=os.getenv("MICROSOFT_TENANT_ID", ""),
        microsoft_client_id=os.getenv("MICROSOFT_CLIENT_ID", ""),
        microsoft_client_secret=os.getenv("MICROSOFT_CLIENT_SECRET", ""),
        microsoft_redirect_uri=os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:8000/api/v1/auth/microsoft/callback"),
        token_encryption_key=os.getenv("TOKEN_ENCRYPTION_KEY", ""),
    )
    if settings.supabase_url and not settings.supabase_url.startswith("https://"):
        raise RuntimeError("SUPABASE_URL must use HTTPS")
    if not 6 <= settings.password_min_length <= 128:
        raise RuntimeError("AUTH_PASSWORD_MIN_LENGTH must match the provider policy (6–128)")
    if set(filter(None, settings.password_required_characters.split(","))) - {"lower", "upper", "number", "symbol"}:
        raise RuntimeError("Invalid password policy character class")
    from urllib.parse import urlparse
    frontend = urlparse(settings.frontend_url)
    if frontend.scheme not in ("https", "http") or not frontend.netloc or frontend.path or frontend.query or frontend.fragment:
        raise RuntimeError("FRONTEND_URL must be a trusted origin without a path/query/fragment")
    if frontend.scheme == "http" and frontend.hostname not in ("localhost", "127.0.0.1"):
        raise RuntimeError("Public FRONTEND_URL must use HTTPS")
    if settings.graph_enabled:
        from cryptography.fernet import Fernet
        Fernet(settings.token_encryption_key.encode())
    return settings
