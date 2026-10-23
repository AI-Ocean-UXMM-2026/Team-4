"""Workbook storage on local disk for historical snapshot inspection and re-activation."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
STORAGE_DIR = ROOT / "backend" / "storage" / "workbooks"


def save_batch_workbook(business_id: str, batch_id: str, content: bytes) -> Path:
    """Safely store the raw workbook content for a given batch."""
    target_dir = STORAGE_DIR / business_id
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / f"{batch_id}.xlsx"
    file_path.write_bytes(content)
    return file_path


def get_batch_workbook(business_id: str, batch_id: str) -> bytes | None:
    """Retrieve raw workbook content for a given batch if available."""
    file_path = STORAGE_DIR / business_id / f"{batch_id}.xlsx"
    if file_path.exists():
        return file_path.read_bytes()
    return None
