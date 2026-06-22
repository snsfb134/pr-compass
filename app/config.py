import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "monitor.sqlite3"
SNAPSHOT_DIR = DATA_DIR / "snapshots"
REPORT_DIR = DATA_DIR / "reports"
TREND_WINDOW_DAYS = 90
TREND_COMPARE_DAYS = 90
WEB_APP_URL = os.getenv("PR_COMPASS_WEB_APP_URL", "http://127.0.0.1:3000")
