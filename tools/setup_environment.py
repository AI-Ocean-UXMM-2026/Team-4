"""Create placeholder configuration only; never create local authentication credentials."""
from pathlib import Path

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    target = root / ".env"
    if target.exists():
        print("Existing .env preserved. Configure the Supabase project settings documented in .env.example.")
    else:
        target.write_text((root / ".env.example").read_text(encoding="utf-8"), encoding="utf-8")
        print("Created placeholder .env. Configure Supabase before signing in.")
