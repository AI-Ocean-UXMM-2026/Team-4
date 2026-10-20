import json
from dataclasses import dataclass, field
from pathlib import Path

SCHEMA_PATH = Path(__file__).resolve().parents[4] / "shared/contracts/workbook-schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))["sheets"]


@dataclass
class WorkbookRow:
    excel_row: int
    values: dict


@dataclass
class ParsedWorkbook:
    sheets: dict[str, list[WorkbookRow]] = field(default_factory=dict)
    errors: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)


def issue(sheet: str, row: int, field: str, reason: str) -> dict:
    return {"sheet": sheet, "row": row, "field": field, "reason": reason}
