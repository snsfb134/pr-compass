from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from collections import Counter
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.core.analysis_provider import validate_analysis_contract  # noqa: E402
from app.core.briefings import (  # noqa: E402
    build_agent_analysis,
    build_fallback_analysis,
    create_briefing_run_for_payload,
    normalize_briefing,
    now_iso,
    parse_record_date,
    partition_valid_records,
    sorted_records,
)
from app.core.db import init_db, row, rows  # noqa: E402
from app.core.sources import seed_sources  # noqa: E402


def load_source_health() -> list[dict[str, Any]]:
    return rows(
        """
        select s.source_id, s.title, s.publisher, s.url, s.last_checked_at, s.last_changed_at,
               latest.status, latest.checked_at, latest.new_records, latest.error
        from sources s
        left join (
          select sc.*
          from source_checks sc
          join (
            select source_id, max(checked_at) as checked_at
            from source_checks
            group by source_id
          ) mx
            on mx.source_id = sc.source_id
           and mx.checked_at = sc.checked_at
        ) latest on latest.source_id = s.source_id
        where s.active = 1
        order by s.publisher, s.title
        """
    )


def load_draw_records() -> tuple[list[dict[str, Any]], list[str], list[dict[str, Any]]]:
    source_health = load_source_health()
    records = rows(
        """
        select r.*, src.publisher, src.title as source_title
        from official_records r
        join sources src on src.source_id = r.source_id
        where coalesce(r.record_category, '') = 'draw'
        order by event_date desc, observed_at desc
        """
    )
    valid_records, warnings = partition_valid_records(records, source_health)
    return sorted_records(valid_records), warnings, source_health


def target_records(records: list[dict[str, Any]], scenarios: int) -> list[dict[str, Any]]:
    if scenarios <= 0:
        return records
    result: list[dict[str, Any]] = []
    for scope in ["bc_pnp", "federal"]:
        item = next((record for record in records if record.get("policy_scope") == scope), None)
        if item:
            result.append(item)
    for record in records:
        if len(result) >= scenarios:
            break
        if record["record_id"] not in {item["record_id"] for item in result}:
            result.append(record)
    return result[:scenarios]


def records_until(records: list[dict[str, Any]], target: dict[str, Any]) -> list[dict[str, Any]]:
    target_date = parse_record_date(target.get("event_date"))
    if not target_date:
        return records
    selected = []
    for record in records:
        record_date = parse_record_date(record.get("event_date"))
        if record_date and record_date <= target_date:
            selected.append(record)
    return sorted_records(selected)


def build_replay_payload(target: dict[str, Any], all_records: list[dict[str, Any]], quality_warnings: list[str], source_health: list[dict[str, Any]]) -> dict[str, Any]:
    window = records_until(all_records, target)
    bc_records = [record for record in window if record.get("policy_scope") == "bc_pnp"]
    ee_records = [record for record in window if record.get("policy_scope") == "federal"]
    policy_label = "BC PNP" if target.get("policy_scope") == "bc_pnp" else "Express Entry"
    return {
        "newUpdate": {
            "kind": "record",
            "title": f"Replay 신규 공식 기록: {target.get('title') or target.get('stage') or policy_label}",
            "source": target.get("source_title") or target.get("publisher") or "공식 소스",
            "source_url": target.get("source_url") or "",
            "detected_at": target.get("observed_at") or target.get("event_date") or "",
            "raw": target,
        },
        "recentRecords": {
            "bc_pnp": bc_records[:10],
            "express_entry": ee_records[:10],
            "processing_time": [],
        },
        "previousWindow": {
            "bc_pnp": bc_records[10:25],
            "express_entry": ee_records[10:25],
            "processing_time": [],
        },
        "sourceHealth": source_health,
        "dataQualityWarnings": [],
        "globalDataQualityWarnings": quality_warnings[:6],
        "productRules": [
            "공식 기록에 없는 사실을 만들지 않는다.",
            "법률 조언처럼 단정하지 않는다.",
            "BC PNP와 Express Entry 영향을 분리한다.",
            "근거가 부족하면 판단 보류 또는 품질 경고로 표시한다.",
            "한국어 문장은 짧고 사용자 친화적으로 쓴다.",
        ],
    }


def table_count(table_name: str) -> int:
    result = row(f"select count(*) as count from {table_name}")
    return int(result["count"]) if result else 0


def assert_replay_result(payload: dict[str, Any], analysis: dict[str, Any], normalized: dict[str, Any]) -> list[str]:
    failures = validate_analysis_contract(analysis)
    if normalized.get("analysisProvider") != "agent":
        failures.append("normalized.analysisProvider(agent)")
    if normalized.get("analysisStatus") != "analyzed":
        failures.append("normalized.analysisStatus(analyzed)")
    if len(normalized.get("evidence", [])) > 5:
        failures.append("evidence(max 5)")
    bullets = normalized.get("emailPreview", {}).get("bullets") or []
    if len(bullets) < 3:
        failures.append("emailPreview.bullets(min 3)")
    if not any("BC PNP" in bullet for bullet in bullets):
        failures.append("emailPreview.bullets(include BC PNP)")
    if not any("Express Entry" in bullet for bullet in bullets):
        failures.append("emailPreview.bullets(include Express Entry)")
    meta = normalized.get("emailPreview", {}).get("meta") or []
    if not any("출처:" in item for item in meta):
        failures.append("emailPreview.meta(include source)")
    if not any("업데이트 확인:" in item for item in meta):
        failures.append("emailPreview.meta(include update time)")
    if not normalized.get("emailPreview", {}).get("updateTypeLabel"):
        failures.append("emailPreview.updateTypeLabel")
    if not normalized.get("latestUpdate", {}).get("typeLabel"):
        failures.append("latestUpdate.typeLabel")
    if "Replay 신규 공식 기록" not in payload.get("newUpdate", {}).get("title", ""):
        failures.append("newUpdate(replay title)")
    for item in normalized.get("evidence", []):
        if "N/A" in item.get("note", "") or "미확인" in item.get("note", ""):
            failures.append("evidence(no incomplete score note)")
            break
    return failures


def run_replay(scenarios: int, recipient_email: str | None, write: bool, include_results: bool = True) -> dict[str, Any]:
    init_db()
    seed_sources()
    all_records, quality_warnings, source_health = load_draw_records()
    targets = target_records(all_records, scenarios)
    if not targets:
        raise RuntimeError("No valid official draw records are available for replay")

    before_counts = {
        "briefing_runs": table_count("briefing_runs"),
        "email_queue": table_count("email_queue"),
    }
    results = []
    failures: list[str] = []
    for target in targets:
        payload = build_replay_payload(target, all_records, quality_warnings, source_health)
        analysis = build_agent_analysis(payload)
        analysis["_provider"] = "agent"
        analysis["_status"] = "analyzed"
        normalized = normalize_briefing(payload, analysis, now_iso())
        scenario_failures = assert_replay_result(payload, analysis, normalized)
        failures.extend(f"{target.get('title')}: {failure}" for failure in scenario_failures)

        written_run_id = None
        if write:
            created = create_briefing_run_for_payload(
                payload,
                trigger_type="replay",
                provider="agent",
                recipient_email=recipient_email,
            )
            written_run_id = created["run_id"]

        results.append(
            {
                "target": {
                    "recordId": target.get("record_id"),
                    "policyScope": target.get("policy_scope"),
                    "title": target.get("title"),
                    "eventDate": target.get("event_date"),
                    "minimumScore": target.get("minimum_score"),
                    "invitations": target.get("invitations"),
                },
                "headline": normalized["headline"],
                "trendDirection": normalized["trendDirection"],
                "confidence": normalized["confidence"],
                "emailPreview": normalized["emailPreview"],
                "evidenceCount": len(normalized["evidence"]),
                "qualityWarnings": payload.get("dataQualityWarnings", []),
                "globalQualityWarningCount": len(payload.get("globalDataQualityWarnings", [])),
                "writtenRunId": written_run_id,
            }
        )

    after_counts = {
        "briefing_runs": table_count("briefing_runs"),
        "email_queue": table_count("email_queue"),
    }
    if write and recipient_email:
        queued = row(
            """
            select recipient_email, status, subject
            from email_queue
            where recipient_email = ?
            order by created_at desc
            limit 1
            """,
            (recipient_email,),
        )
        if not queued:
            failures.append("email_queue(recipient not queued)")
    scope_counts = Counter(item["target"]["policyScope"] for item in results)
    confidence_values = [int(item["confidence"]) for item in results]
    summary = {
        "policyScopeCounts": dict(scope_counts),
        "minConfidence": min(confidence_values) if confidence_values else None,
        "maxConfidence": max(confidence_values) if confidence_values else None,
        "averageConfidence": round(sum(confidence_values) / len(confidence_values), 1) if confidence_values else None,
        "sampleResults": results[:3],
    }
    payload = {
        "ok": not failures,
        "writeMode": write,
        "recipientEmail": recipient_email,
        "scenarioCount": len(results),
        "failures": failures,
        "beforeCounts": before_counts,
        "afterCounts": after_counts,
        "summary": summary,
    }
    if include_results:
        payload["results"] = results
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay historical official records as if they were new updates.")
    parser.add_argument("--scenarios", type=int, default=3, help="Number of historical updates to replay.")
    parser.add_argument("--all", action="store_true", help="Replay every valid historical draw record.")
    parser.add_argument("--recipient-email", default="", help="Queue mock email previews for this recipient when --write is used.")
    parser.add_argument("--write", action="store_true", help="Write briefing_runs and email_queue rows.")
    parser.add_argument("--summary-only", action="store_true", help="Print summary and failures without full per-record results.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    args = parser.parse_args()

    try:
        result = run_replay(
            0 if args.all else args.scenarios,
            args.recipient_email or None,
            args.write,
            include_results=not args.summary_only,
        )
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
