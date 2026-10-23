"""Regenerate the reviewed initial DDL before release; never edit applied migrations."""
import sys
from pathlib import Path

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.db.models import Base

lines = ["-- Shay Sett platform v1. Generated from SQLAlchemy metadata; apply once.\n"]
for table in Base.metadata.sorted_tables:
    lines.append(str(CreateTable(table).compile(dialect=postgresql.dialect())).strip() + ";")
    lines.extend(str(CreateIndex(index).compile(dialect=postgresql.dialect())) + ";" for index in sorted(table.indexes, key=lambda i: i.name))
# Never overwrite an applied baseline after additive migrations have been introduced.
target = root / ".artifacts/current-schema.sql"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text("\n".join(line.rstrip() for line in "\n\n".join(lines).splitlines()) + "\n", encoding="utf-8")
print("Wrote current schema reference to .artifacts/current-schema.sql; applied migrations unchanged.")
