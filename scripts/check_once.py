import argparse
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.core.db import init_db
from app.core.monitor import check_all_sources
from app.core.notifications import notify_results
from app.core.notifier import notify_macos
from app.core.sources import seed_sources


def main() -> int:
    parser = argparse.ArgumentParser(description="Check official PR pathway sources once.")
    parser.add_argument("--notify-test", action="store_true", help="Send a test macOS notification and exit.")
    parser.add_argument("--notify-no-change", action="store_true", help="Send a notification even if no changes are found.")
    parser.add_argument("--baseline", action="store_true", help="Update snapshots/records as baseline without creating user-facing changes.")
    parser.add_argument("--environment", default="production", choices=("production", "test"), help="Mark generated changes with an environment.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when any source check fails.")
    args = parser.parse_args()

    if args.notify_test:
        ok = notify_macos(
            "PR Compass",
            "테스트 알림입니다. 이게 보이면 맥 알림은 정상이에요.",
            "Notification test",
        )
        print(json.dumps({"notify_test": ok}, ensure_ascii=False))
        return 0 if ok else 1

    init_db()
    seed_sources()
    results = check_all_sources(baseline=args.baseline, environment=args.environment)

    changed = [item for item in results if item.get("changed")]
    record_updates = [item for item in results if item.get("new_records", 0) > 0]
    failed = [item for item in results if item.get("error")]
    baseline = [item for item in results if item.get("first_snapshot")]

    payload = {
        "changed": len(changed),
        "new_records": sum(item.get("new_records", 0) for item in results),
        "failed": len(failed),
        "baseline": len(baseline),
        "results": results,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    notified = False if args.baseline else notify_results(results)
    if not notified and args.notify_no_change:
        notify_macos(
            "PR Compass",
            f"변경 없음. 확인 완료: {len(results)}개 소스",
            "No changes",
        )

    return 0 if not failed or not args.strict else 2


if __name__ == "__main__":
    raise SystemExit(main())
