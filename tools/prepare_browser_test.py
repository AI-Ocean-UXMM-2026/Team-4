"""Run a synthetic expense edit in the browser without printing credentials."""
import os
import subprocess
from io import BytesIO
from pathlib import Path

from dotenv import dotenv_values
from openpyxl import load_workbook

root = Path(__file__).resolve().parents[1]
output = root / ".artifacts/tea-shop-edited.xlsx"
output.parent.mkdir(exist_ok=True)
workbook = load_workbook(root / "database/seed/tea-shop.xlsx")
workbook["Expenses"]["E2"] = 80000
workbook.save(output)
workbook.close()
environment = os.environ.copy()
environment["BIZFLOW_DEMO_PASSWORD"] = dotenv_values(root / ".env")["DEMO_PASSWORD"]
environment["BIZFLOW_EDITED_WORKBOOK"] = str(output)
subprocess.run(["node", "deployment/e2e.mjs"], cwd=root, env=environment, check=True)
