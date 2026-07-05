from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.core.analysis_provider import build_briefing_prompt, validate_analysis_contract
from app.core.briefings import build_briefing_input, build_fallback_analysis, normalize_briefing, now_iso


REQUIRED_ANALYSIS_FIELDS = (
    "headline",
    "shortEmailSummary",
    "bcPnpImpact",
    "expressEntryImpact",
    "historicalComparison",
    "trendDirection",
    "watchPoints",
    "evidenceRefs",
    "confidence",
    "dataQualityWarnings",
)


def build_summary(input_payload: dict[str, Any], analysis: dict[str, Any], normalized: dict[str, Any]) -> dict[str, Any]:
    recent_records = input_payload.get("recentRecords", {})
    previous_window = input_payload.get("previousWindow", {})
    source_health = input_payload.get("sourceHealth", [])
    warnings = input_payload.get("dataQualityWarnings", [])

    return {
        "generatedAt": normalized.get("generatedAt"),
        "input": {
            "newUpdate": {
                "kind": input_payload.get("newUpdate", {}).get("kind"),
                "title": input_payload.get("newUpdate", {}).get("title"),
                "source": input_payload.get("newUpdate", {}).get("source"),
                "detectedAt": input_payload.get("newUpdate", {}).get("detected_at"),
            },
            "recentCounts": {
                "bc_pnp": len(recent_records.get("bc_pnp", [])),
                "express_entry": len(recent_records.get("express_entry", [])),
            },
            "previousWindowCounts": {
                "bc_pnp": len(previous_window.get("bc_pnp", [])),
                "express_entry": len(previous_window.get("express_entry", [])),
            },
            "sourceHealthCount": len(source_health),
            "warningCount": len(warnings),
            "warnings": warnings,
        },
        "analysis": {key: analysis.get(key) for key in REQUIRED_ANALYSIS_FIELDS},
        "normalized": {
            "headline": normalized.get("headline"),
            "updateLabel": normalized.get("updateLabel"),
            "trendDirection": normalized.get("trendDirection"),
            "confidence": normalized.get("confidence"),
            "latestUpdate": normalized.get("latestUpdate"),
            "aiSummary": normalized.get("aiSummary"),
            "watchPoints": normalized.get("watchPoints"),
            "evidenceCount": len(normalized.get("evidence", [])),
            "dataQualityWarnings": normalized.get("dataQualityWarnings", []),
            "emailPreview": normalized.get("emailPreview"),
        },
    }


def assert_contract(analysis: dict[str, Any]) -> list[str]:
    return validate_analysis_contract(analysis)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Replay briefing input/fallback output without writing to the database."
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print the JSON summary.")
    parser.add_argument(
        "--assert-contract",
        action="store_true",
        help="Fail non-zero when required analysis contract fields are missing.",
    )
    parser.add_argument(
        "--prompt",
        action="store_true",
        help="Include the strict JSON provider prompt that can be passed to a mini model.",
    )
    args = parser.parse_args()

    try:
        input_payload = build_briefing_input()
        fallback = build_fallback_analysis(input_payload)
        generated_at = now_iso()
        normalized = normalize_briefing(input_payload, fallback, generated_at)
    except Exception as exc:  # pragma: no cover - exercised in runtime smoke checks.
        error_payload = {
            "ok": False,
            "stage": "replay",
            "error": str(exc),
        }
        print(
            json.dumps(
                error_payload,
                ensure_ascii=False,
                indent=2 if args.pretty else None,
            ),
            file=sys.stderr,
        )
        return 1

    missing = assert_contract(fallback) if args.assert_contract else []
    summary = {
        "ok": not missing,
        "contractChecked": args.assert_contract,
        "contractMissing": missing,
        "replay": build_summary(input_payload, fallback, normalized),
    }
    if args.prompt:
        summary["providerPrompt"] = build_briefing_prompt(input_payload)

    print(json.dumps(summary, ensure_ascii=False, indent=2 if args.pretty else None))

    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
