"""Recognize only the exact synthetic workbooks shipped with this repository."""

import hashlib
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
    return bool(expected and content_hash and content_hash == expected)
