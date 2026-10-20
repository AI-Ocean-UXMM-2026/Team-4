import hashlib
from datetime import timezone, timedelta
from email.utils import parsedate_to_datetime
import math

from sqlalchemy import select

from ..db.models import AuthRequestLimit, now
from .account_service import insert_if_absent
from .errors import APIError


def reserve_email_request(sessions, action, email, ip):
    # Database-backed limits survive restarts and coordinate multiple API instances.
    rules = [(f"ip:{ip}", 60, 10), (f"mail:{email.casefold()}", 60, 1), (f"hour:{email.casefold()}", 3600, 5)]
    with sessions.begin() as session:
        provider = session.get(AuthRequestLimit, hashlib.sha256(b"provider-email-retry").hexdigest())
        if provider:
            remaining = (provider.started_at.replace(tzinfo=timezone.utc) - now()).total_seconds()
            if remaining > 0:
                raise APIError(429, "AUTH_RATE_LIMITED", "The email provider is limiting requests. Please wait before trying again.", headers={"Retry-After": str(math.ceil(remaining))})
        retry_after = 0
        for subject, window, limit in rules:
            key = hashlib.sha256((action + ":" + subject).encode()).hexdigest()
            moment = now()
            insert_if_absent(session, AuthRequestLimit, {"key": key, "started_at": moment, "count": 0}, ["key"])
            row = session.scalar(select(AuthRequestLimit).where(AuthRequestLimit.key == key).with_for_update())
            elapsed = (moment - row.started_at.replace(tzinfo=timezone.utc)).total_seconds()
            if elapsed >= window:
                row.started_at, row.count = moment, 0
            if row.count >= limit:
                raise APIError(429, "AUTH_RATE_LIMITED", "Please wait before requesting another email.", headers={"Retry-After": str(max(1, math.ceil(window - elapsed)))})
            row.count += 1
            if row.count >= limit:
                retry_after = max(retry_after, window if elapsed >= window else math.ceil(window - elapsed))
            session.flush()
        return retry_after


def remember_provider_retry(sessions, retry):
    """Honor an explicit provider deadline across workers/restarts. Never guess one.

    The existing rate-limit table also stores this project-wide deadline under a
    separate key. Scope is conservative because the provider may limit the project.
    """
    try:
        deadline = now() + timedelta(seconds=int(retry)) if retry.isdigit() else parsedate_to_datetime(retry)
        deadline = deadline.replace(tzinfo=timezone.utc) if deadline.tzinfo is None else deadline
        if deadline <= now():
            return
    except (ValueError, TypeError, OverflowError, AttributeError):
        return
    key = hashlib.sha256(b"provider-email-retry").hexdigest()
    with sessions.begin() as session:
        insert_if_absent(session, AuthRequestLimit, {"key": key, "started_at": deadline, "count": 0}, ["key"])
        row = session.scalar(select(AuthRequestLimit).where(AuthRequestLimit.key == key).with_for_update())
        if row.started_at.replace(tzinfo=timezone.utc) < deadline:
            row.started_at = deadline
