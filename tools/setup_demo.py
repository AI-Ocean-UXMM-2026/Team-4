"""Create private local demo config, preserving any existing .env."""
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / ".env"
if target.exists():
    print("Existing .env preserved.")
else:
    config = (root / ".env.example").read_text(encoding="utf-8")
    config = config.replace("SESSION_SECRET=\n", "SESSION_SECRET=" + secrets.token_urlsafe(48) + "\n", 1)
    config = config.replace("DEMO_PASSWORD=\n", "DEMO_PASSWORD=" + secrets.token_urlsafe(18) + "\n", 1)
    target.write_text(config, encoding="utf-8")
    print("Created .env. Open it to find DEMO_PASSWORD; secrets were not printed.")
