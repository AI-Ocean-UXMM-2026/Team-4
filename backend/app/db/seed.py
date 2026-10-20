"""Synthetic fixtures only. Never reset real businesses."""
import argparse
from pathlib import Path

from sqlalchemy import delete, select

from ..core.config import get_settings
from ..core.errors import APIError
from ..integrations.excel.import_service import import_validated_snapshot, lock_business
from .connection import make_engine, session_factory
from .models import (Base, Business, ImportBatch, ImportedRow, Membership, OAuthState,
                     PROJECTIONS, RowRevision, User, WorkbookSource)

ROOT = Path(__file__).resolve().parents[3]
PERSONAS = {"tea-shop": "Mingalar Tea Shop", "grocery": "Shwe Grocery", "workshop": "Aye Chan Workshop"}


def seed(sessions, user_id="demo-user"):
    with sessions.begin() as session:
        if not session.get(User, user_id):
            session.add(User(id=user_id))
            session.flush()
        for key, name in PERSONAS.items():
            if not session.get(Business, key):
                session.add(Business(id=key, name=name))
                session.flush()
            if not session.get(Membership, (key, user_id)):
                session.add(Membership(business_id=key, user_id=user_id))
    for key in PERSONAS:
        with sessions() as session:
            exists = session.scalar(select(WorkbookSource).where(WorkbookSource.business_id == key))
        if exists is None:
            import_validated_snapshot(sessions, key, user_id, (ROOT / f"database/seed/{key}.xlsx").read_bytes())


def reset_business(sessions, business_id):
    if business_id not in PERSONAS:
        raise APIError(403, "RESET_FORBIDDEN", "Only synthetic demo businesses can be reset.")
    # Reset is an explicit fixture replacement, not the normal omission policy.
    # Source identity changes so a download already in flight cannot overwrite the reset.
    content = (ROOT / f"database/seed/{business_id}.xlsx").read_bytes()
    from ..integrations.excel.workbook_parser import parse_workbook
    from ..integrations.excel.validators import validate_workbook
    if validate_workbook(parse_workbook(content), business_id):
        raise APIError(503, "SEED_INVALID", "Synthetic fixture is invalid.")
    # Use one outer transaction including re-import through a nested session factory.
    with sessions.begin() as session:
        business = lock_business(session, business_id)
        for table in PROJECTIONS.values():
            session.execute(delete(table).where(table.c.business_id == business_id))
        for model in (OAuthState, RowRevision, ImportedRow, ImportBatch, WorkbookSource):
            session.execute(delete(model).where(model.business_id == business_id))
        business.version += 1
        session.flush()
        from sqlalchemy.orm import sessionmaker
        nested_sessions = sessionmaker(bind=session.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False)
        return import_validated_snapshot(nested_sessions, business_id, "demo-user", content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", help="Existing Supabase Auth user UUID to provision")
    args = parser.parse_args()
    settings = get_settings()
    if settings.auth_mode != "demo" and not args.user_id:
        parser.error("Supabase mode requires --user-id from Supabase Auth")
    engine = make_engine(settings.database_url)
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)
    seed(session_factory(engine), args.user_id or "demo-user")
    print("Three synthetic businesses seeded; existing imported data preserved.")
