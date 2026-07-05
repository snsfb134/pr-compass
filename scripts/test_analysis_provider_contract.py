from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.core.analysis_provider import (  # noqa: E402
    analyze_briefing_with_provider,
    build_briefing_prompt,
    normalize_provider_output,
    validate_analysis_contract,
)
from app.core.briefings import build_briefing_input, build_fallback_analysis, normalize_briefing, now_iso  # noqa: E402
from app.core.db import init_db, row  # noqa: E402


REQUIRED_NORMALIZED_FIELDS = [
    "generatedAt",
    "headline",
    "updateLabel",
    "analysisProvider",
    "analysisStatus",
    "trendDirection",
    "confidence",
    "latestUpdate",
    "aiSummary",
    "bcPnpImpact",
    "expressEntryImpact",
    "historicalComparison",
    "watchPoints",
    "evidence",
    "dataQualityWarnings",
    "sourceQualityWarnings",
    "analysisWarnings",
    "emailPreview",
]


def table_count(table_name: str) -> int:
    result = row(f"select count(*) as count from {table_name}")
    return int(result["count"]) if result else 0


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def parse_prompt_payload(prompt: str) -> dict[str, Any]:
    json_start = prompt.index("{")
    return json.loads(prompt[json_start:])


def build_valid_provider_payload(fallback: dict[str, Any]) -> dict[str, Any]:
    return {
        **fallback,
        "headline": "테스트 분석: 공식 업데이트 흐름을 보수적으로 확인합니다.",
        "shortEmailSummary": [
            "BC PNP: 최신 공식 기록을 이전 구간과 비교했습니다.",
            "Express Entry: 최신 round와 CRS cutoff 흐름을 함께 봅니다.",
            "상세 근거는 구독자 원페이지에서 확인합니다.",
        ],
        "trendDirection": "not-a-valid-direction",
        "confidence": 999,
        "dataQualityWarnings": [],
    }


def run_tests() -> dict[str, Any]:
    init_db()
    counts_before = {
        "briefing_runs": table_count("briefing_runs"),
        "email_queue": table_count("email_queue"),
    }

    input_payload = build_briefing_input()
    fallback = build_fallback_analysis(input_payload)
    normalized = normalize_briefing(input_payload, fallback, now_iso())

    contract_missing = validate_analysis_contract(fallback)
    assert_true(not contract_missing, f"fallback contract failed: {contract_missing}")

    missing_normalized = [field for field in REQUIRED_NORMALIZED_FIELDS if field not in normalized]
    assert_true(not missing_normalized, f"normalized fields missing: {missing_normalized}")
    assert_true(len(normalized.get("evidence", [])) <= 5, "normalized evidence must be capped at 5")
    assert_true(len(normalized.get("watchPoints", [])) <= 5, "normalized watch points must be capped at 5")
    assert_true(isinstance(normalized.get("emailPreview", {}).get("bullets"), list), "email preview bullets must be a list")
    assert_true(isinstance(normalized.get("emailPreview", {}).get("meta"), list), "email preview meta must be a list")
    assert_true(normalized.get("emailPreview", {}).get("updateTypeLabel"), "email preview must include update type label")
    assert_true(normalized.get("latestUpdate", {}).get("typeLabel"), "latest update must include type label")

    prompt_payload = parse_prompt_payload(build_briefing_prompt(input_payload))
    assert_true(prompt_payload["outputFormat"] == "strict_json", "prompt must require strict_json output")
    assert_true(prompt_payload["outputLanguage"] == "ko", "prompt must request Korean output")
    for field in [
        "newUpdate",
        "recentRecords",
        "previousWindow",
        "sourceHealth",
        "dataQualityWarnings",
        "productRules",
    ]:
        assert_true(field in prompt_payload["input"], f"prompt input missing {field}")
    for field in [
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
    ]:
        assert_true(field in prompt_payload["requiredFields"], f"prompt requiredFields missing {field}")

    valid_raw = build_valid_provider_payload(fallback)
    valid_normalized = normalize_provider_output(valid_raw, fallback)
    assert_true(valid_normalized["confidence"] == 100, "provider confidence must be clamped to 100")
    assert_true(valid_normalized["trendDirection"] == "hold", "invalid trend direction must normalize to hold")
    assert_true(valid_normalized["headline"].startswith("테스트 분석"), "valid provider headline should survive normalization")
    assert_true(not validate_analysis_contract(valid_normalized), "valid provider payload should pass contract after normalization")

    fallback_with_source_warning = {**fallback, "dataQualityWarnings": ["소스 체크 경고 테스트"]}
    warning_normalized = normalize_provider_output({**valid_raw, "dataQualityWarnings": []}, fallback_with_source_warning)
    assert_true(
        "소스 체크 경고 테스트" in warning_normalized["dataQualityWarnings"],
        "source quality warnings must survive provider normalization",
    )

    assert_true(normalize_provider_output("{not-json", fallback) == fallback, "invalid JSON must fall back")
    malformed = normalize_provider_output({"headline": "필드가 부족한 응답", "shortEmailSummary": "문자열"}, fallback)
    assert_true(malformed["headline"] == fallback["headline"], "malformed provider output must use fallback")
    assert_true(
        any("provider 출력 필드" in warning for warning in malformed["dataQualityWarnings"]),
        "malformed provider output must add a contract warning",
    )

    for provider in ["mini", "gemini"]:
        try:
            analyze_briefing_with_provider(provider, input_payload)
        except RuntimeError as exc:
            assert_true("not configured" in str(exc), f"{provider} must fail closed before API wiring")
        else:
            raise AssertionError(f"{provider} should not be callable before API wiring")

    counts_after = {
        "briefing_runs": table_count("briefing_runs"),
        "email_queue": table_count("email_queue"),
    }
    assert_true(counts_before == counts_after, "contract tests must not write briefing or email queue rows")

    return {
        "ok": True,
        "cases": 15,
        "input": {
            "bcPnpRecent": len(input_payload.get("recentRecords", {}).get("bc_pnp", [])),
            "expressEntryRecent": len(input_payload.get("recentRecords", {}).get("express_entry", [])),
            "sourceCount": len(input_payload.get("sourceHealth", [])),
            "qualityWarningCount": len(input_payload.get("dataQualityWarnings", [])),
        },
        "normalized": {
            "headline": normalized["headline"],
            "trendDirection": normalized["trendDirection"],
            "confidence": normalized["confidence"],
            "evidenceCount": len(normalized["evidence"]),
            "watchPointCount": len(normalized["watchPoints"]),
        },
        "dbCountsUnchanged": counts_after,
        "providerStatus": {
            "mini": "fail_closed",
            "gemini": "fail_closed",
        },
    }


def main() -> int:
    try:
        result = run_tests()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
