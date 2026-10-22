"""Recognize bundled synthetic workbooks or one explicitly pinned local demo import."""

import hashlib
import os
import re
import secrets
from functools import lru_cache
from pathlib import Path


SEED_BUSINESSES = frozenset({"tea-shop", "grocery", "workshop"})
SEED_DIRECTORY = Path(__file__).resolve().parents[3] / "database" / "seed"


@lru_cache(maxsize=3)
def _seed_hash(business_id: str) -> str | None:
    if business_id not in SEED_BUSINESSES:
        return None
    path = SEED_DIRECTORY / f"{business_id}.xlsx"
    if not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_synthetic_seed_workbook(business_id: str, content_hash: str | None) -> bool:
    expected = _seed_hash(business_id)
    if expected and content_hash and secrets.compare_digest(content_hash, expected):
        return True
    pinned_business = os.getenv("AI_SYNTHETIC_DEMO_BUSINESS_ID", "")
    pinned_hash = os.getenv("AI_SYNTHETIC_DEMO_IMPORT_SHA256", "").lower()
    return bool(
        pinned_business == business_id
        and re.fullmatch(r"[0-9a-f]{64}", pinned_hash)
        and content_hash
        and secrets.compare_digest(content_hash.lower(), pinned_hash)
    )
