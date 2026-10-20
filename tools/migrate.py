import argparse
import sys
from pathlib import Path

from sqlalchemy import text

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.core.config import get_settings
from app.db.connection import make_engine
from app.db.models import Base

parser = argparse.ArgumentParser()
parser.add_argument("--supabase", action="store_true", help="Apply Supabase-specific RLS policies too")
args = parser.parse_args()
engine = make_engine(get_settings().database_url)
if engine.dialect.name == "sqlite":
    Base.metadata.create_all(engine)
    print("Local SQLite schema initialized.")
else:
    with engine.begin() as connection:
        connection.exec_driver_sql("SELECT pg_advisory_xact_lock(8421492)")
        connection.exec_driver_sql("CREATE TABLE IF NOT EXISTS schema_migrations (version text primary key)")
        for path in sorted((root / "database/migrations").glob("*.sql")):
            if path.name.startswith("002") and not args.supabase:
                continue
            if connection.scalar(text("SELECT version FROM schema_migrations WHERE version=:version"), {"version": path.name}):
                continue
            connection.exec_driver_sql(path.read_text(encoding="utf-8"))
            connection.execute(text("INSERT INTO schema_migrations(version) VALUES (:version)"), {"version": path.name})
            print("Applied", path.name)
