from sqlalchemy import select, update

from ..db.models import Business, Membership, User, uid
from .account_schemas import BusinessInput


def insert_if_absent(session, model, values, conflict):
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    insert = sqlite_insert if session.bind.dialect.name == "sqlite" else pg_insert
    session.execute(insert(model).values(**values).on_conflict_do_nothing(index_elements=conflict))


def profile(session, identity):
    insert_if_absent(session, User, {"id": identity.user_id, "email": identity.email}, ["id"])
    # Serialize profile/onboarding requests per verified identity.
    session.execute(update(User).where(User.id == identity.user_id).values(email=identity.email))
    return session.get(User, identity.user_id, populate_existing=True)


def account_status(sessions, identity):
    with sessions.begin() as session:
        user = profile(session, identity)
        business = session.scalar(select(Business).where(Business.owner_id == identity.user_id))
        pending = identity.metadata.get("registration_business")
        try:
            pending = BusinessInput.model_validate(pending).model_dump() if pending else None
        except ValueError:
            pending = None
        name = identity.metadata.get("full_name")
        suggested_name = name.strip()[:120] if isinstance(name, str) else ""
        return {"user": {"id": user.id, "email": identity.email, "full_name": user.full_name or suggested_name},
                "onboarding_complete": bool(business and user.full_name and business.industry and business.city),
                "pending_business": pending, "owned_business_id": business.id if business else None}


def complete_onboarding(sessions, identity, data):
    with sessions.begin() as session:
        user = profile(session, identity)
        existing = session.scalar(select(Business).where(Business.owner_id == identity.user_id))
        if existing:
            # Retries return the original workspace; they cannot mutate ownership or multiply rows.
            return {"business_id": existing.id, "created": False}
        user.full_name = data.full_name
        business = Business(id=uid(), name=data.name, owner_id=identity.user_id, industry=data.industry,
                            city=data.city, phone=data.phone or None, address=data.address or None, currency=data.currency)
        session.add(business)
        session.flush()
        session.add(Membership(business_id=business.id, user_id=identity.user_id))
        session.flush()
        return {"business_id": business.id, "created": True}
