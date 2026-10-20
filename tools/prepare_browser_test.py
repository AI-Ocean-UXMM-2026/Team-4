"""Run the public account UI smoke test. Live provider tests need configured accounts."""
import os
import subprocess
from pathlib import Path

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    subprocess.run(["node", "deployment/e2e.mjs"], cwd=root, env=os.environ.copy(), check=True)
