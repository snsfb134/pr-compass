from __future__ import annotations

import json
from typing import Any

TREND_DIRECTIONS = {"strengthening", "weakening", "mixed", "hold"}
SUPPORTED_PROVIDERS = {"heuristic", "agent", "mini", "gemini"}
REQUIRED_ANALYSIS_FIELDS = [
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
]


def analyze_briefing_with_provider(provider: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Provider seam for mini/Gemini.

    The operational app keeps external providers disabled until API wiring is
    explicit. Mini/Gemini tests should first use the prompt + contract helpers
    in this module, then replace only this provider seam.
    """
    if provider == "heuristic":
        raise RuntimeError("Heuristic provider is handled before model dispatch")
    if provider == "agent":
        raise RuntimeError("Agent provider is handled by the deterministic replay layer")
    if provider == "mini":
        raise RuntimeError("Mini provider is not configured")
    if provider == "gemini":
        raise RuntimeError("Gemini provider is not configured")
    raise RuntimeError(f"Unsupported analysis provider: {provider}")


def normalize_provider_output(raw: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return fallback
    if not isinstance(raw, dict):
        return fallback

    normalized = {**fallback}
    for key in [
        "headline",
        "shortEmailSummary",
        "bcPnpImpact",
        "expressEntryImpact",
        "historicalComparison",
        "watchPoints",
        "evidenceRefs",
        "dataQualityWarnings",
    ]:
        if key in raw:
            normalized[key] = raw[key]

    if "dataQualityWarnings" in raw:
        normalized["dataQualityWarnings"] = merge_warning_lists(
            fallback.get("dataQualityWarnings") or [],
            raw.get("dataQualityWarnings") or [],
        )

    direction = str(raw.get("trendDirection") or fallback.get("trendDirection") or "hold")
    normalized["trendDirection"] = direction if direction in TREND_DIRECTIONS else "hold"

    try:
        confidence = int(raw.get("confidence", fallback.get("confidence", 60)))
    except (TypeError, ValueError):
        confidence = int(fallback.get("confidence", 60))
    normalized["confidence"] = max(0, min(100, confidence))

    missing = validate_analysis_contract(normalized)
    if missing:
        fallback_with_warning = {**fallback}
        warnings = list(fallback_with_warning.get("dataQualityWarnings") or [])
        warnings.append(f"분석 provider 출력 필드 누락: {', '.join(missing)}")
        fallback_with_warning["dataQualityWarnings"] = warnings
        return fallback_with_warning
    return normalized


def validate_analysis_contract(payload: dict[str, Any]) -> list[str]:
    missing = [field for field in REQUIRED_ANALYSIS_FIELDS if field not in payload]
    if not isinstance(payload.get("headline"), str) or not payload.get("headline", "").strip():
        missing.append("headline(non-empty string)")
    if payload.get("trendDirection") not in TREND_DIRECTIONS:
        missing.append("trendDirection(valid enum)")
    if not isinstance(payload.get("confidence"), (int, float)):
        missing.append("confidence(number)")
    if not isinstance(payload.get("shortEmailSummary"), list):
        missing.append("shortEmailSummary(list)")
    else:
        for index, item in enumerate(payload.get("shortEmailSummary") or []):
            if not isinstance(item, str) or not item.strip():
                missing.append(f"shortEmailSummary[{index}](non-empty string)")
    if not isinstance(payload.get("watchPoints"), list):
        missing.append("watchPoints(list)")
    else:
        for index, item in enumerate(payload.get("watchPoints") or []):
            if not isinstance(item, str) or not item.strip():
                missing.append(f"watchPoints[{index}](non-empty string)")
    if not isinstance(payload.get("evidenceRefs"), list):
        missing.append("evidenceRefs(list)")
    else:
        for index, item in enumerate(payload.get("evidenceRefs") or []):
            if not isinstance(item, dict):
                missing.append(f"evidenceRefs[{index}](object)")
    if not isinstance(payload.get("dataQualityWarnings"), list):
        missing.append("dataQualityWarnings(list)")
    else:
        for index, item in enumerate(payload.get("dataQualityWarnings") or []):
            if not isinstance(item, str) or not item.strip():
                missing.append(f"dataQualityWarnings[{index}](non-empty string)")
    for object_field in ["bcPnpImpact", "expressEntryImpact"]:
        object_value = payload.get(object_field)
        if not isinstance(object_value, dict):
            missing.append(f"{object_field}(object)")
            continue
        for key in ["title", "body", "signal"]:
            if not isinstance(object_value.get(key), str) or not object_value.get(key, "").strip():
                missing.append(f"{object_field}.{key}(non-empty string)")
    comparison = payload.get("historicalComparison")
    if not isinstance(comparison, dict):
        missing.append("historicalComparison(object)")
    else:
        for key in ["title", "body"]:
            if not isinstance(comparison.get(key), str) or not comparison.get(key, "").strip():
                missing.append(f"historicalComparison.{key}(non-empty string)")
        if not isinstance(comparison.get("points"), list):
            missing.append("historicalComparison.points(list)")
        else:
            for index, item in enumerate(comparison.get("points") or []):
                if not isinstance(item, str) or not item.strip():
                    missing.append(f"historicalComparison.points[{index}](non-empty string)")
    return missing


def merge_warning_lists(*warning_groups: Any) -> list[str]:
    merged: list[str] = []
    for group in warning_groups:
        if not isinstance(group, list):
            continue
        for warning in group:
            text = str(warning).strip()
            if text and text not in merged:
                merged.append(text)
    return merged


def build_briefing_prompt(payload: dict[str, Any]) -> str:
    prompt_payload = {
        "task": "Analyze official Canadian immigration updates for PR Compass.",
        "outputLanguage": "ko",
        "outputFormat": "strict_json",
        "requiredFields": REQUIRED_ANALYSIS_FIELDS,
        "allowedTrendDirection": sorted(TREND_DIRECTIONS),
        "styleContract": {
            "headline": "한 문장. 공식 업데이트의 변화 축을 먼저 말한다.",
            "shortEmailSummary": "3개 bullet. BC PNP, Express Entry, 상세 링크 유도 순서.",
            "impactBodies": "근거 -> 비교 -> 사용자에게 의미 순서. 단정/법률 조언 금지.",
            "historicalComparison": "이번 업데이트 하나와 최근 N개/이전 구간을 비교한다.",
            "watchPoints": "다음 공식 업데이트에서 확인할 항목만 쓴다.",
            "evidenceRefs": "입력에 있는 공식 URL/기록만 참조한다.",
        },
        "input": payload,
    }
    return (
        "You are the PR Compass analysis layer. Use only the official records and changes in the input. "
        "Do not create official facts. Do not provide legal advice. "
        "Keep the same schema and tone even when the provider changes. Return strict JSON only.\n\n"
        + json.dumps(prompt_payload, ensure_ascii=False, indent=2)
    )


def build_product_rules() -> list[str]:
    return [
        "공식 기록에 없는 사실을 만들지 않는다.",
        "법률 조언처럼 단정하지 않는다.",
        "BC PNP와 Express Entry 영향을 분리한다.",
        "근거가 부족하면 판단 보류 또는 품질 경고로 표시한다.",
        "한국어 문장은 짧고 사용자 친화적으로 쓴다.",
    ]
