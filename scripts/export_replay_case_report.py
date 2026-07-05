from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from scripts.replay_historical_update_flow import run_replay  # noqa: E402

REPORT_DIR = ROOT_DIR / "data" / "replay-reports"


def flatten_case(item: dict[str, Any]) -> dict[str, Any]:
    target = item.get("target", {})
    bullets = item.get("emailPreview", {}).get("bullets", [])
    warnings = item.get("qualityWarnings", [])
    return {
        "record_id": target.get("recordId"),
        "policy_scope": target.get("policyScope"),
        "title": target.get("title"),
        "event_date": target.get("eventDate"),
        "minimum_score": target.get("minimumScore"),
        "invitations": target.get("invitations"),
        "trend_direction": item.get("trendDirection"),
        "confidence": item.get("confidence"),
        "evidence_count": item.get("evidenceCount"),
        "headline": item.get("headline"),
        "email_subject": item.get("emailPreview", {}).get("subject"),
        "bc_pnp_bullet": bullets[0] if len(bullets) > 0 else "",
        "express_entry_bullet": bullets[1] if len(bullets) > 1 else "",
        "cta_bullet": bullets[2] if len(bullets) > 2 else "",
        "quality_warning_count": len(warnings),
        "global_quality_warning_count": item.get("globalQualityWarningCount", 0),
    }


def export_report() -> dict[str, Any]:
    replay = run_replay(scenarios=0, recipient_email=None, write=False, include_results=True)
    if not replay["ok"]:
        raise RuntimeError(f"Replay failed: {replay['failures']}")
    cases = [flatten_case(item) for item in replay["results"]]
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = REPORT_DIR / "historical-replay-cases.json"
    csv_path = REPORT_DIR / "historical-replay-cases.csv"
    compact_csv_path = REPORT_DIR / "historical-replay-cases-compact.csv"
    json_path.write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf-8")
    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(cases[0].keys()) if cases else [])
        writer.writeheader()
        writer.writerows(cases)
    compact_fields = [
        "policy_scope",
        "event_date",
        "title",
        "minimum_score",
        "invitations",
        "trend_direction",
        "confidence",
        "headline",
        "bc_pnp_bullet",
        "express_entry_bullet",
        "global_quality_warning_count",
    ]
    with compact_csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=compact_fields)
        writer.writeheader()
        for case in cases:
            writer.writerow({field: case[field] for field in compact_fields})

    scope_counts = Counter(case["policy_scope"] for case in cases)
    trend_counts = Counter(case["trend_direction"] for case in cases)
    confidence_values = [int(case["confidence"]) for case in cases if case["confidence"] is not None]
    warning_counts = Counter(case["quality_warning_count"] for case in cases)
    representative = {
        "latestBcPnp": next((case for case in cases if case["policy_scope"] == "bc_pnp"), None),
        "latestExpressEntry": next((case for case in cases if case["policy_scope"] == "federal"), None),
        "lowestConfidence": min(cases, key=lambda case: int(case["confidence"])) if cases else None,
        "highestConfidence": max(cases, key=lambda case: int(case["confidence"])) if cases else None,
    }
    return {
        "ok": True,
        "caseCount": len(cases),
        "paths": {
            "json": str(json_path),
            "csv": str(csv_path),
            "compactCsv": str(compact_csv_path),
        },
        "summary": {
            "policyScopeCounts": dict(scope_counts),
            "trendCounts": dict(trend_counts),
            "minConfidence": min(confidence_values) if confidence_values else None,
            "maxConfidence": max(confidence_values) if confidence_values else None,
            "averageConfidence": round(sum(confidence_values) / len(confidence_values), 1) if confidence_values else None,
            "warningCountDistribution": dict(warning_counts),
        },
        "representative": representative,
    }


def main() -> int:
    try:
        result = export_report()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
