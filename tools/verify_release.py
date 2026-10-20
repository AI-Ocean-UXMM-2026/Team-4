"""Check private local config values are absent from the browser build."""
from pathlib import Path
from dotenv import dotenv_values

root = Path(__file__).resolve().parents[1]
environment = dotenv_values(root / ".env")
private_names = ["SESSION_SECRET", "DEMO_PASSWORD", "MICROSOFT_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY", "DATABASE_URL"]
secrets = [environment[name].encode() for name in private_names if environment.get(name) and len(environment[name]) >= 12]
files = list((root / ".output/public").rglob("*.js"))
if not files:
    raise SystemExit("No production browser build found")
for path in files:
    content = path.read_bytes()
    if any(value in content for value in secrets):
        raise SystemExit("Private configuration found in browser build; remove it before release")
print(f"Browser bundle check passed ({len(files)} JavaScript files; no private configured values).")
