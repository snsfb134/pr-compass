from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.core.db import connect, row, rows
from app.core.analysis_provider import analyze_briefing_with_provider, build_product_rules, normalize_provider_output

TZ = ZoneInfo("America/Vancouver")


def now_iso() -> str:
    return datetime.now(TZ).isoformat(timespec="seconds")


def create_briefing_run(trigger_type: str = "manual", provider: str = "heuristic", recipient_email: str | None = None) -> dict[str, Any]:
    generated_at = now_iso()
    input_payload = build_briefing_input()
    return create_briefing_run_for_payload(input_payload, trigger_type, provider, generated_at, recipient_email)


def create_briefing_run_for_payload(
    input_payload: dict[str, Any],
    trigger_type: str = "manual",
    provider: str = "heuristic",
    generated_at: str | None = None,
    recipient_email: str | None = None,
) -> dict[str, Any]:
    generated_at = generated_at or now_iso()
    fallback = build_fallback_analysis(input_payload)
    status = "fallback"
    error = ""

    if provider == "agent":
        raw_analysis = build_agent_analysis(input_payload)
        analysis = normalize_provider_output(raw_analysis, fallback)
        status = "analyzed"
    elif provider != "heuristic":
        try:
            raw_analysis = analyze_briefing_with_provider(provider, input_payload)
            analysis = normalize_provider_output(raw_analysis, fallback)
            status = "analyzed"
        except Exception as exc:  # pragma: no cover - exercised after provider wiring.
            analysis = fallback
            error = str(exc)
    else:
        analysis = fallback

    analysis["_provider"] = provider
    analysis["_status"] = status
    if error:
        warnings = list(analysis.get("dataQualityWarnings") or [])
        warnings.append(f"{provider} 분석 실패로 공식 데이터 기준 요약을 사용했습니다.")
        analysis["dataQualityWarnings"] = unique(warnings)

    normalized = normalize_briefing(input_payload, analysis, generated_at)
    run_id = f"{generated_at[:10].replace('-', '')}-{uuid.uuid4().hex[:10]}"
    with connect() as conn:
        conn.execute(
            """
            insert into briefing_runs (
              run_id, generated_at, status, trigger_type, provider,
              trend_direction, confidence, input_json, analysis_json, normalized_json, error
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                generated_at,
                status,
                trigger_type,
                provider,
                analysis["trendDirection"],
                int(analysis["confidence"]),
                json.dumps(input_payload, ensure_ascii=False),
                json.dumps(analysis, ensure_ascii=False),
                json.dumps(normalized, ensure_ascii=False),
                error,
            ),
        )
        conn.execute(
            """
            insert into email_queue (
              email_id, run_id, recipient_email, subject, preview_json, status, created_at, sent_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"{generated_at[:10].replace('-', '')}-{uuid.uuid4().hex[:10]}",
                run_id,
                recipient_email,
                normalized["emailPreview"]["subject"],
                json.dumps(normalized["emailPreview"], ensure_ascii=False),
                "mock_ready",
                generated_at,
                None,
            ),
        )

    return {"run_id": run_id, "generated_at": generated_at, "status": status, "briefing": normalized}


def latest_briefing_run() -> dict[str, Any] | None:
    item = row(
        """
        select *
        from briefing_runs
        order by generated_at desc
        limit 1
        """
    )
    if not item:
        return None
    return {
        "run_id": item["run_id"],
        "generated_at": item["generated_at"],
        "status": item["status"],
        "trigger_type": item["trigger_type"],
        "provider": item["provider"],
        "trend_direction": item["trend_direction"],
        "confidence": item["confidence"],
        "briefing": json.loads(item["normalized_json"]),
        "analysis": json.loads(item["analysis_json"]),
        "input": json.loads(item["input_json"]),
        "error": item.get("error"),
    }


def get_or_create_latest_briefing() -> dict[str, Any]:
    latest = latest_briefing_run()
    if latest:
        return latest
    created = create_briefing_run(trigger_type="initial", provider="heuristic")
    return {
        "run_id": created["run_id"],
        "generated_at": created["generated_at"],
        "status": created["status"],
        "trigger_type": "initial",
        "provider": "heuristic",
        "trend_direction": created["briefing"]["trendDirection"],
        "confidence": created["briefing"]["confidence"],
        "briefing": created["briefing"],
        "analysis": {},
        "input": {},
        "error": "",
    }


def build_briefing_input() -> dict[str, Any]:
    records = rows(
        """
        select r.*, src.publisher, src.title as source_title
        from official_records r
        join sources src on src.source_id = r.source_id
        where coalesce(r.record_category, '') in ('draw', 'processing_time')
        order by observed_at desc, event_date desc
        limit 1000
        """
    )
    changes = rows(
        """
        select c.*, src.publisher, src.title as source_title, src.url as source_url
        from changes c
        join sources src on src.source_id = c.source_id
        where coalesce(c.hidden, 0) = 0
          and coalesce(c.environment, 'production') = 'production'
        order by detected_at desc
        limit 30
        """
    )
    source_health = rows(
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
    valid_records, quality_warnings = partition_valid_records(records, source_health)
    draw_records = sorted_records([record for record in valid_records if record.get("record_category") == "draw"])
    processing_records = sorted_records([record for record in valid_records if record.get("record_category") == "processing_time"])
    bc_records = [record for record in draw_records if record.get("policy_scope") == "bc_pnp"]
    ee_records = [record for record in draw_records if record.get("policy_scope") == "federal"]
    latest_update = select_latest_update(changes, valid_records)

    return {
        "newUpdate": latest_update,
        "recentRecords": {
            "bc_pnp": bc_records[:10],
            "express_entry": ee_records[:10],
            "processing_time": processing_records[:10],
        },
        "previousWindow": {
            "bc_pnp": bc_records[10:25],
            "express_entry": ee_records[10:25],
            "processing_time": processing_records[10:25],
        },
        "sourceHealth": source_health,
        "dataQualityWarnings": quality_warnings,
        "productRules": build_product_rules(),
    }


def partition_valid_records(records: list[dict[str, Any]], source_health: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    valid: list[dict[str, Any]] = []
    for record in records:
        if record.get("record_category") == "draw":
            if (
                not record.get("event_date")
                or not is_numeric_metric(record.get("minimum_score"))
                or not is_numeric_metric(record.get("invitations"))
            ):
                warnings.append(f"{record.get('title') or record.get('record_id')} 기록은 필수 점수/초청 필드가 부족해 핵심 분석에서 제외했습니다.")
                continue
            if record.get("policy_scope") == "bc_pnp" and looks_like_distribution_record(record):
                warnings.append(f"{record.get('title')} 항목은 점수대 분포로 보여 핵심 draw 분석에서 제외했습니다.")
                continue
        valid.append(record)

    failed_sources = [item for item in source_health if item.get("status") == "error"]
    if failed_sources:
        warnings.append(f"최근 소스 체크 오류 {len(failed_sources)}건이 있어 최신성 판단을 보수적으로 표시합니다.")
    return valid, unique(warnings)[:6]


def is_numeric_metric(value: Any) -> bool:
    if value is None:
        return False
    text = str(value).strip().replace(",", "")
    if not text or text.lower() in {"n/a", "na", "none", "null", "미확인"}:
        return False
    return bool(re.fullmatch(r"\d+(\.\d+)?", text))


def looks_like_distribution_record(record: dict[str, Any]) -> bool:
    text = " ".join(str(record.get(key) or "") for key in ["title", "stage", "raw_text"]).lower()
    has_score_range = bool(re.search(r"\b\d{1,3}\s*-\s*\d{1,3}\b", text))
    return bool("score range" in text or "number of registrations" in text or (has_score_range and record.get("program") == "BC PNP"))


def sorted_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(records, key=record_sort_key, reverse=True)


def record_sort_key(record: dict[str, Any]) -> tuple[datetime, str]:
    event_at = parse_record_date(record.get("event_date"))
    observed_at = parse_record_date(record.get("observed_at")) or datetime.min
    return (event_at or observed_at, str(record.get("record_id") or ""))


def parse_record_date(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        pass
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def select_latest_update(changes: list[dict[str, Any]], records: list[dict[str, Any]]) -> dict[str, Any]:
    for change in changes:
        if change.get("change_type") in {"draw", "processing_time", "program_status", "eligibility", "occupation_priority"}:
            return {
                "kind": "change",
                "title": change.get("summary_ko") or change.get("source_title") or "공식 변경",
                "source": change.get("source_title") or change.get("publisher") or "공식 소스",
                "source_url": change.get("source_url") or change.get("evidence_url") or "",
                "detected_at": change.get("detected_at") or change.get("data_basis_at") or "",
                "raw": change,
            }
    if records:
        record = records[0]
        return {
            "kind": "record",
            "title": record.get("title") or "공식 기록",
            "source": record.get("source_title") or record.get("publisher") or "공식 소스",
            "source_url": record.get("source_url") or "",
            "detected_at": record.get("observed_at") or record.get("event_date") or "",
            "raw": record,
        }
    return {
        "kind": "none",
        "title": "새 공식 기록 없음",
        "source": "공식 소스",
        "source_url": "",
        "detected_at": "",
        "raw": {},
    }


def build_fallback_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    bc_recent = payload["recentRecords"]["bc_pnp"]
    ee_recent = payload["recentRecords"]["express_entry"]
    warnings = payload.get("dataQualityWarnings", [])
    bc_latest = bc_recent[0] if bc_recent else {}
    ee_latest = ee_recent[0] if ee_recent else {}
    direction = infer_trend_direction(bc_recent, ee_recent)
    confidence = 58 if warnings else 72

    return {
        "headline": build_headline(payload["newUpdate"], direction),
        "shortEmailSummary": [
            summarize_record_axis("BC PNP", bc_latest),
            summarize_record_axis("Express Entry", ee_latest),
            "자세한 비교는 구독자 원페이지에서 확인하세요.",
        ],
        "bcPnpImpact": {
            "title": "BC PNP는 최신 초청 기록과 직군별 흐름을 함께 봅니다",
            "body": build_axis_body("BC PNP", bc_latest, bc_recent),
            "signal": "BC PNP 공식 기록 기준",
        },
        "expressEntryImpact": {
            "title": "Express Entry는 round type, CRS cutoff, 초청 수를 분리해 봅니다",
            "body": build_axis_body("Express Entry", ee_latest, ee_recent),
            "signal": "EE 공식 라운드 기준",
        },
        "historicalComparison": {
            "title": "과거 데이터 대비 공식 기록 흐름",
            "body": "최신 기록 하나만 보지 않고 최근 기록과 이전 구간을 함께 비교했습니다.",
            "points": build_comparison_points(bc_recent, ee_recent),
        },
        "trendDirection": direction,
        "watchPoints": [
            "다음 BC PNP invitation에서 같은 카테고리 신호가 반복되는지 확인",
            "다음 EE round의 카테고리와 CRS cutoff 변화 확인",
            "소스 체크 오류가 있으면 최신성 경고를 먼저 확인",
        ],
        "evidenceRefs": build_evidence_refs(bc_recent, ee_recent, payload["newUpdate"]),
        "confidence": confidence,
        "dataQualityWarnings": warnings,
    }


def build_agent_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    """Deterministic model substitute used before Gemini wiring.

    This mirrors the strict provider contract so mini/Gemini can be compared
    against a stable baseline during replay QA.
    """
    bc_recent = payload["recentRecords"]["bc_pnp"]
    ee_recent = payload["recentRecords"]["express_entry"]
    bc_previous = payload["previousWindow"]["bc_pnp"]
    ee_previous = payload["previousWindow"]["express_entry"]
    update = payload["newUpdate"]
    warnings = payload.get("dataQualityWarnings", [])
    bc_latest = bc_recent[0] if bc_recent else {}
    ee_latest = ee_recent[0] if ee_recent else {}
    direction = infer_trend_direction(bc_recent, ee_recent)
    bc_comparison = compare_record_window("BC PNP", bc_recent, bc_previous)
    ee_comparison = compare_record_window("Express Entry", ee_recent, ee_previous)

    confidence = 76
    if warnings:
        confidence -= min(18, len(warnings) * 6)
    if not bc_recent:
        confidence -= 10
    if not ee_recent:
        confidence -= 10

    return {
        "headline": build_agent_headline(update, direction),
        "shortEmailSummary": [
            build_email_axis_line("BC PNP", bc_latest, bc_comparison),
            build_email_axis_line("Express Entry", ee_latest, ee_comparison),
            "자세한 근거와 과거 대비 변화는 구독자 원페이지에서 확인하세요.",
        ],
        "bcPnpImpact": {
            "title": "BC PNP 영향: 최신 초청과 이전 구간을 함께 비교했습니다",
            "body": build_agent_axis_body("BC PNP", bc_latest, bc_recent, bc_comparison),
            "signal": bc_comparison["label"],
        },
        "expressEntryImpact": {
            "title": "Express Entry 영향: round type과 CRS cutoff 흐름을 분리해 봅니다",
            "body": build_agent_axis_body("Express Entry", ee_latest, ee_recent, ee_comparison),
            "signal": ee_comparison["label"],
        },
        "historicalComparison": {
            "title": "과거 데이터 대비 변화",
            "body": "이번 업데이트를 단독으로 보지 않고 최근 구간과 이전 구간의 최소 점수, 초청 수, 카테고리 반복 여부를 비교했습니다.",
            "points": [
                bc_comparison["sentence"],
                ee_comparison["sentence"],
                "공식 필드가 부족한 기록은 해석에 섞지 않고 품질 경고로 분리했습니다.",
            ],
        },
        "trendDirection": direction,
        "watchPoints": build_agent_watch_points(update, bc_latest, ee_latest, warnings),
        "evidenceRefs": build_evidence_refs(bc_recent, ee_recent, update),
        "confidence": max(35, min(92, confidence)),
        "dataQualityWarnings": warnings,
    }


def normalize_briefing(payload: dict[str, Any], analysis: dict[str, Any], generated_at: str) -> dict[str, Any]:
    evidence = evidence_payload(analysis.get("evidenceRefs") or [])
    provider = analysis.get("_provider") or "heuristic"
    status = analysis.get("_status") or "fallback"
    source_warnings = unique([*(payload.get("dataQualityWarnings") or []), *(payload.get("globalDataQualityWarnings") or [])])
    analysis_warnings = [warning for warning in analysis.get("dataQualityWarnings") or [] if warning not in source_warnings]
    all_warnings = unique([*source_warnings, *analysis_warnings])
    update_meta = build_update_meta(payload["newUpdate"])
    email_preview = build_email_preview(payload, analysis, update_meta)
    return {
        "generatedAt": generated_at,
        "headline": analysis["headline"],
        "updateLabel": build_update_label(provider, status, source_warnings, analysis_warnings),
        "analysisProvider": provider,
        "analysisStatus": status,
        "trendDirection": analysis["trendDirection"],
        "confidence": analysis["confidence"],
        "latestUpdate": {
            "title": payload["newUpdate"]["title"],
            "source": payload["newUpdate"]["source"],
            "summary": first_text(analysis.get("shortEmailSummary"), "공식 업데이트를 기준으로 브리핑을 생성했습니다."),
            "typeLabel": update_meta["typeLabel"],
            "detectedAt": update_meta["detectedAt"],
            "sourceUrl": update_meta["sourceUrl"],
        },
        "updateMeta": update_meta,
        "aiSummary": " ".join(analysis.get("shortEmailSummary") or []) or "공식 데이터 기준 요약입니다.",
        "bcPnpImpact": analysis["bcPnpImpact"],
        "expressEntryImpact": analysis["expressEntryImpact"],
        "historicalComparison": analysis["historicalComparison"],
        "watchPoints": analysis["watchPoints"][:5],
        "evidence": evidence[:5],
        "dataQualityWarnings": all_warnings,
        "sourceQualityWarnings": source_warnings,
        "analysisWarnings": analysis_warnings,
        "emailPreview": email_preview,
    }


def build_update_label(provider: str, status: str, source_warnings: list[str], analysis_warnings: list[str]) -> str:
    if status == "analyzed":
        provider_label = "테스트 에이전트" if provider == "agent" else "미니 모델" if provider == "mini" else "Gemini" if provider == "gemini" else "AI"
        suffix = " · 품질 경고 포함" if source_warnings or analysis_warnings else ""
        return f"{provider_label} 분석 브리핑{suffix}"
    if analysis_warnings:
        return "AI 분석 대기 · 공식 데이터 기준"
    if source_warnings:
        return "공식 데이터 기준 브리핑 · 품질 경고 포함"
    return "공식 데이터 기준 브리핑"


def build_update_meta(update: dict[str, Any]) -> dict[str, str]:
    raw = update.get("raw") if isinstance(update.get("raw"), dict) else {}
    change_type = str(raw.get("change_type") or "").strip()
    record_category = str(raw.get("record_category") or "").strip()
    policy_scope = str(raw.get("policy_scope") or "").strip()
    if record_category == "draw" or update.get("kind") == "record":
        if policy_scope == "bc_pnp":
            type_label = "BC PNP 초청 기록"
        elif policy_scope == "federal":
            type_label = "Express Entry 라운드"
        else:
            type_label = "공식 초청/추첨 기록"
    elif change_type == "processing_time":
        type_label = "처리기간/운영 소식"
    elif change_type in {"program_status", "eligibility", "occupation_priority"}:
        type_label = "정책·프로그램 소식"
    else:
        type_label = "공식 소식"
    detected_at = str(update.get("detected_at") or raw.get("data_basis_at") or raw.get("observed_at") or raw.get("event_date") or "").strip()
    return {
        "typeLabel": type_label,
        "source": str(update.get("source") or "공식 소스"),
        "sourceUrl": str(update.get("source_url") or raw.get("source_url") or raw.get("evidence_url") or ""),
        "detectedAt": detected_at,
        "displayDetectedAt": display_datetime(detected_at),
        "basis": "공식 원문, 최근 기록, 이전 구간을 함께 비교",
    }


def build_email_preview(payload: dict[str, Any], analysis: dict[str, Any], update_meta: dict[str, str]) -> dict[str, Any]:
    bullets = list(analysis.get("shortEmailSummary") or [])[:3]
    return {
        "subject": "[PR Compass] BC PNP + EE 공식 업데이트 브리핑",
        "intro": f"{with_object_particle(update_meta['typeLabel'])} 기준으로 BC PNP와 Express Entry 흐름을 함께 분석했습니다.",
        "meta": [
            f"출처: {update_meta['source']}",
            f"업데이트 확인: {update_meta['displayDetectedAt'] or '확인 시각 미상'}",
            f"분석 방식: {update_meta['basis']}",
        ],
        "bullets": bullets,
        "sourceUrl": update_meta["sourceUrl"],
        "updateTypeLabel": update_meta["typeLabel"],
    }


def with_object_particle(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return "공식 업데이트를"
    last = text[-1]
    code = ord(last)
    if 0xAC00 <= code <= 0xD7A3:
        has_final_consonant = (code - 0xAC00) % 28 != 0
        return f"{text}{'을' if has_final_consonant else '를'}"
    return f"{text}를"


def display_datetime(value: Any) -> str:
    if not value:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    parsed = parse_record_date(text)
    if parsed:
        if "T" in text:
            return parsed.strftime("%Y-%m-%d %H:%M")
        return parsed.strftime("%Y-%m-%d")
    return text


def infer_trend_direction(bc_recent: list[dict[str, Any]], ee_recent: list[dict[str, Any]]) -> str:
    recent_count = len(bc_recent) + len(ee_recent)
    if recent_count == 0:
        return "hold"
    if len(bc_recent) and len(ee_recent):
        return "mixed"
    return "strengthening"


def build_headline(update: dict[str, Any], direction: str) -> str:
    if direction == "mixed":
        return "BC PNP와 Express Entry 신호를 함께 비교해야 하는 구간입니다."
    if direction == "strengthening":
        return f"{update.get('title') or '공식 업데이트'} 기준으로 새 관찰 신호가 생겼습니다."
    if direction == "weakening":
        return "최근 공식 기록은 보수적으로 다시 확인해야 합니다."
    return "새 공식 기록이 부족해 현재 전망을 유지합니다."


def build_agent_headline(update: dict[str, Any], direction: str) -> str:
    title = str(update.get("title") or "공식 업데이트").strip().rstrip(".。")
    subject = f"공식 업데이트({title})"
    if direction == "mixed":
        return f"{subject}를 기준으로 BC PNP와 Express Entry를 함께 다시 봐야 합니다."
    if direction == "strengthening":
        return f"{subject}를 기준으로 관찰 신호가 강해졌습니다."
    if direction == "weakening":
        return f"{subject}를 기준으로 보수적인 재확인이 필요합니다."
    return f"{subject}를 기준으로 현재 전망을 유지합니다."


def build_axis_body(label: str, latest: dict[str, Any], recent: list[dict[str, Any]]) -> str:
    if not latest:
        return f"{label} 공식 기록이 부족해 이번 브리핑에서는 판단을 보류합니다."
    score = latest.get("minimum_score") or "미확인"
    invitations = latest.get("invitations") or "미확인"
    stage = display_record_stage(latest) or label
    return f"최근 {stage} 기록은 최소 점수 {score}, 초청 수 {invitations} 기준입니다. 최근 {len(recent)}개 기록과 함께 비교해 방향을 봅니다."


def build_agent_axis_body(label: str, latest: dict[str, Any], recent: list[dict[str, Any]], comparison: dict[str, str]) -> str:
    if not latest:
        return f"근거: {label} 유효 공식 기록이 부족합니다. 해석: 이번 브리핑에서는 판단을 보류합니다. 영향: 다음 공식 기록이 쌓인 뒤 다시 비교해야 합니다."
    stage = display_record_stage(latest) or label
    score = latest.get("minimum_score") or "미확인"
    invitations = latest.get("invitations") or "미확인"
    return (
        f"근거: 최근 {stage} 기록은 최소 점수 {score}, 초청 수 {invitations}입니다. "
        f"비교: {comparison['sentence']} "
        f"영향: 최근 {len(recent)}개 유효 기록 안에서 같은 축이 반복되는지 확인하는 단계입니다."
    )


def build_email_axis_line(label: str, latest: dict[str, Any], comparison: dict[str, str]) -> str:
    if not latest:
        return f"{label}: 유효 공식 기록이 부족해 판단을 보류합니다."
    return f"{label}: {latest.get('event_date') or '날짜 미확인'} {display_record_stage(latest) or '공식 기록'} 기준, {comparison['short']}."


def summarize_record_axis(label: str, record: dict[str, Any]) -> str:
    if not record:
        return f"{label}: 최신 공식 기록 확인이 필요합니다."
    return f"{label}: {record.get('event_date') or '날짜 미확인'} {display_record_stage(record) or '공식 기록'} 기준."


def display_record_stage(record: dict[str, Any]) -> str:
    stage = str(record.get("stage") or record.get("program") or "").strip()
    event_date = str(record.get("event_date") or "").strip()
    if event_date and stage.startswith(event_date):
        return stage[len(event_date) :].lstrip(" -·")
    return stage


def build_comparison_points(bc_recent: list[dict[str, Any]], ee_recent: list[dict[str, Any]]) -> list[str]:
    return [
        f"BC PNP는 최근 {len(bc_recent)}개 유효 기록을 기준으로 비교했습니다.",
        f"Express Entry는 최근 {len(ee_recent)}개 유효 round를 기준으로 비교했습니다.",
        "필수 점수/초청 필드가 부족한 기록은 품질 경고로 분리했습니다.",
    ]


def compare_record_window(label: str, recent: list[dict[str, Any]], previous: list[dict[str, Any]]) -> dict[str, str]:
    if not recent:
        return {
            "label": "판단 보류",
            "short": "비교할 최신 기록 부족",
            "sentence": f"{label}는 비교할 최신 유효 기록이 부족합니다.",
        }

    recent_score = average_numeric_metric([record.get("minimum_score") for record in recent])
    previous_score = average_numeric_metric([record.get("minimum_score") for record in previous])
    recent_invites = average_numeric_metric([record.get("invitations") for record in recent])
    previous_invites = average_numeric_metric([record.get("invitations") for record in previous])

    score_phrase = "이전 구간과 점수 흐름을 비교할 과거값이 부족합니다"
    label_value = "혼합 신호"
    if recent_score is not None and previous_score is not None:
        delta = recent_score - previous_score
        if abs(delta) < 1:
            score_phrase = "평균 최소 점수는 이전 구간과 거의 비슷합니다"
        elif delta > 0:
            score_phrase = f"평균 최소 점수는 이전 구간보다 약 {delta:.1f}점 높아졌습니다"
            label_value = "기준 상승"
        else:
            score_phrase = f"평균 최소 점수는 이전 구간보다 약 {abs(delta):.1f}점 낮아졌습니다"
            label_value = "기준 완화"

    invite_phrase = "초청 수 비교값은 부족합니다"
    if recent_invites is not None and previous_invites is not None:
        delta_invites = recent_invites - previous_invites
        if abs(delta_invites) < 1:
            invite_phrase = "평균 초청 수는 이전 구간과 비슷합니다"
        elif delta_invites > 0:
            invite_phrase = f"평균 초청 수는 이전 구간보다 약 {delta_invites:.1f}명 늘었습니다"
        else:
            invite_phrase = f"평균 초청 수는 이전 구간보다 약 {abs(delta_invites):.1f}명 줄었습니다"

    return {
        "label": label_value,
        "short": score_phrase,
        "sentence": f"{label}: {score_phrase}. {invite_phrase}.",
    }


def average_numeric_metric(values: list[Any]) -> float | None:
    numbers: list[float] = []
    for value in values:
        if not is_numeric_metric(value):
            continue
        numbers.append(float(str(value).replace(",", "")))
    if not numbers:
        return None
    return sum(numbers) / len(numbers)


def build_agent_watch_points(update: dict[str, Any], bc_latest: dict[str, Any], ee_latest: dict[str, Any], warnings: list[str]) -> list[str]:
    points = [
        "다음 BC PNP invitation에서 같은 카테고리와 최소 점수가 반복되는지 확인",
        "다음 Express Entry round에서 round type, CRS cutoff, 초청 수가 같은 방향인지 확인",
        "구독 메일에는 짧은 요약만 보내고, 상세 근거는 원페이지에서 확인",
    ]
    if update.get("kind") == "change":
        points.insert(0, "이번 변경 문구가 실제 draw/round 기록으로 이어지는지 확인")
    if warnings:
        points.append("품질 경고가 있는 공식 기록은 핵심 판단에서 제외하고 별도 검수")
    return points[:5]


def build_evidence_refs(bc_recent: list[dict[str, Any]], ee_recent: list[dict[str, Any]], update: dict[str, Any]) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    if update.get("source_url"):
        refs.append(
            {
                "title": update.get("title") or "공식 업데이트",
                "publisher": update.get("source") or "공식 소스",
                "date": update.get("detected_at") or "",
                "url": update.get("source_url") or "",
                "note": "이번 브리핑의 최신 공식 업데이트 근거입니다.",
            }
        )
    for record in [*bc_recent[:3], *ee_recent[:3]]:
        refs.append(
            {
                "title": record.get("title") or record.get("stage") or "공식 기록",
                "publisher": record.get("publisher") or record.get("source_title") or "공식 소스",
                "date": record.get("event_date") or record.get("observed_at") or "",
                "url": record.get("source_url") or "",
                "note": f"{record.get('program') or record.get('policy_scope') or '공식'} · 최소 점수 {record.get('minimum_score') or '미확인'} · 초청 {record.get('invitations') or '미확인'}",
            }
        )
    return refs


def evidence_payload(items: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "title": str(item.get("title") or "공식 근거"),
            "publisher": str(item.get("publisher") or "공식"),
            "date": str(item.get("date") or "날짜 미확인"),
            "url": str(item.get("url") or ""),
            "note": str(item.get("note") or "공식 기록 기반 근거입니다."),
        }
        for item in items
        if item.get("url") or item.get("title")
    ]


def first_text(values: Any, fallback: str) -> str:
    if isinstance(values, list):
        for value in values:
            if str(value).strip():
                return str(value).strip()
    if isinstance(values, str) and values.strip():
        return values.strip()
    return fallback


def unique(values: list[str]) -> list[str]:
    result = []
    for value in values:
        if value and value not in result:
            result.append(value)
    return result
