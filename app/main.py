import json
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

from app.config import ROOT_DIR, WEB_APP_URL
from app.core.analysis_provider import SUPPORTED_PROVIDERS
from app.core.briefings import create_briefing_run, get_or_create_latest_briefing, latest_briefing_run
from app.core.analysis import summarize_trend_insights
from app.core.db import connect, execute, init_db, row, rows
from app.core.monitor import check_all_sources
from app.core.notifications import notify_results
from app.core.sources import list_sources, seed_sources
from app.config import TREND_COMPARE_DAYS, TREND_WINDOW_DAYS

app = FastAPI(title="PR Compass")
PROFILE_SCHEMA_VERSION = 4
FIRST_LANGUAGE_ABILITY_FIELDS = [
    ("speaking", "language_speaking_clb", "speaking"),
    ("listening", "language_listening_clb", "listening"),
    ("reading", "language_reading_clb", "reading"),
    ("writing", "language_writing_clb", "writing"),
]


@app.on_event("startup")
def startup() -> None:
    init_db()
    seed_sources()
    _backfill_official_records()


@app.get("/")
def index() -> RedirectResponse:
    return RedirectResponse(url=WEB_APP_URL, status_code=307)


@app.get("/dashboard")
def dashboard() -> RedirectResponse:
    return RedirectResponse(url=f"{WEB_APP_URL}/app", status_code=307)


@app.get("/static/landing.html")
def legacy_landing() -> RedirectResponse:
    return RedirectResponse(url=WEB_APP_URL, status_code=307)


@app.get("/static/index.html")
def legacy_dashboard() -> RedirectResponse:
    return RedirectResponse(url=f"{WEB_APP_URL}/app", status_code=307)


@app.get("/api/sources")
def api_sources() -> list[dict]:
    return list_sources()


@app.get("/api/snapshots")
def api_snapshots() -> list[dict]:
    return rows(
        """
        select s.*, src.title, src.publisher, src.url
        from snapshots s
        join sources src on src.source_id = s.source_id
        order by fetched_at desc
        limit 50
        """
    )


@app.get("/api/changes")
def api_changes(include_hidden: bool = False, environment: str = "production") -> list[dict]:
    visibility_clause = "" if include_hidden else "and coalesce(c.hidden, 0) = 0"
    return rows(
        f"""
        select c.*, src.title, src.publisher, src.url
        from changes c
        join sources src on src.source_id = c.source_id
        where coalesce(c.environment, 'production') = ?
        {visibility_clause}
        order by detected_at desc
        limit 50
        """,
        (environment,),
    )


@app.get("/api/records")
def api_records() -> list[dict]:
    return rows(
        """
        select r.*, src.publisher
        from official_records r
        join sources src on src.source_id = r.source_id
        order by observed_at desc, event_date desc
        limit 100
        """
    )


@app.get("/api/trends")
def api_trends() -> dict:
    records = rows(
        """
        select r.*, src.publisher
        from official_records r
        join sources src on src.source_id = r.source_id
        order by observed_at asc, event_date asc
        """
    )
    by_stream: dict[str, list[dict]] = {}
    for record in records:
        key = _trend_group_key(record)
        by_stream.setdefault(key, []).append(record)

    streams = []
    for key, items in by_stream.items():
        items = sorted(items, key=_record_sort_key)
        latest = items[-1]
        previous = items[-2] if len(items) > 1 else None
        streams.append(
            {
                "label": _trend_label(latest, key),
                "count": len(items),
                "metric_name": latest.get("metric_name") or _trend_metric_name(latest),
                "metric_unit": latest.get("metric_unit") or _trend_metric_unit(latest),
                "group_type": latest.get("record_category") or latest.get("record_type") or "unknown",
                "latest": latest,
                "previous": previous,
                "score_delta": _numeric_delta(latest.get("minimum_score"), previous.get("minimum_score") if previous else None),
                "invitation_delta": _numeric_delta(latest.get("invitations"), previous.get("invitations") if previous else None),
                "points": items[-12:],
            }
        )

    streams.sort(key=lambda item: (_record_sort_key(item["latest"]), item["group_type"], item["label"]), reverse=True)
    return {
        "record_count": len(records),
        "stream_count": len(streams),
        "streams": streams,
    }


@app.get("/api/insights")
def api_insights(window_days: int = TREND_WINDOW_DAYS, compare_days: int = TREND_COMPARE_DAYS, refresh: bool = False) -> dict:
    cache_key = f"{window_days}:{compare_days}"
    if not refresh:
        cached = row(
            """
            select generated_at, window_days, compare_days, payload_json, insights_json
            from insights_cache
            where cache_key = ?
            """,
            (cache_key,),
        )
        if cached:
            return {
                "generated_at": cached["generated_at"],
                "window_days": cached["window_days"],
                "compare_days": cached["compare_days"],
                "payload": json.loads(cached["payload_json"]),
                "insights": json.loads(cached["insights_json"]),
                "cached": True,
            }

    records = rows(
        """
        select r.*, src.title as source_title, src.publisher
        from official_records r
        join sources src on src.source_id = r.source_id
        where coalesce(r.record_category, '') in ('draw', 'processing_time')
        order by observed_at asc, event_date asc
        """
    )
    payload = _build_insight_payload(records, window_days, compare_days)
    insights = summarize_trend_insights(payload)
    generated_at = _now_iso()

    with connect() as conn:
        conn.execute(
            """
            insert into insights_cache (cache_key, generated_at, window_days, compare_days, payload_json, insights_json)
            values (?, ?, ?, ?, ?, ?)
            on conflict(cache_key) do update set
              generated_at = excluded.generated_at,
              window_days = excluded.window_days,
              compare_days = excluded.compare_days,
              payload_json = excluded.payload_json,
              insights_json = excluded.insights_json
            """,
            (cache_key, generated_at, window_days, compare_days, json.dumps(payload, ensure_ascii=False), json.dumps(insights, ensure_ascii=False)),
        )

    return {
        "generated_at": generated_at,
        "window_days": window_days,
        "compare_days": compare_days,
        "payload": payload,
        "insights": insights,
        "cached": False,
    }


@app.get("/api/briefing/latest")
def api_briefing_latest() -> dict:
    return get_or_create_latest_briefing()


@app.post("/api/briefing/runs")
def api_create_briefing_run(provider: str = "heuristic") -> dict:
    if provider not in SUPPORTED_PROVIDERS:
        supported = ", ".join(sorted(SUPPORTED_PROVIDERS))
        raise HTTPException(status_code=400, detail=f"provider must be one of: {supported}")
    return create_briefing_run(trigger_type="manual", provider=provider)


@app.get("/api/briefing/runs/latest")
def api_briefing_run_latest() -> dict:
    latest = latest_briefing_run()
    if not latest:
        raise HTTPException(status_code=404, detail="No briefing run exists")
    return latest


@app.get("/api/source-health")
def api_source_health() -> dict:
    sources = rows(
        """
        select source_id, title, publisher, url, active, last_checked_at, last_changed_at
        from sources
        where active = 1
        order by publisher, title
        """
    )
    latest_checks = {
        item["source_id"]: item
        for item in rows(
            """
            select sc.*
            from source_checks sc
            join (
              select source_id, max(checked_at) as checked_at
              from source_checks
              group by source_id
            ) latest
              on latest.source_id = sc.source_id
             and latest.checked_at = sc.checked_at
            """
        )
    }
    items = []
    for source in sources:
        latest = latest_checks.get(source["source_id"])
        status = latest["status"] if latest else ("unknown" if not source.get("last_checked_at") else "ok")
        items.append(
            {
                **source,
                "status": status,
                "checked_at": latest["checked_at"] if latest else source.get("last_checked_at"),
                "duration_ms": latest["duration_ms"] if latest else None,
                "changed": bool(latest["changed"]) if latest else False,
                "new_records": latest["new_records"] if latest else 0,
                "error": latest["error"] if latest else None,
            }
        )
    return {
        "source_count": len(items),
        "ok_count": sum(1 for item in items if item["status"] == "ok"),
        "error_count": sum(1 for item in items if item["status"] == "error"),
        "unknown_count": sum(1 for item in items if item["status"] == "unknown"),
        "latest_checked_at": max((item.get("checked_at") or "" for item in items), default="") or None,
        "check_count": rows("select count(*) as count from source_checks")[0]["count"],
        "sources": items,
    }


@app.get("/api/express-entry")
def api_express_entry() -> dict:
    records = rows(
        """
        select r.*, src.title as source_title, src.publisher
        from official_records r
        join sources src on src.source_id = r.source_id
        where r.source_id in ('ircc_express_entry_ministerial_instructions', 'ircc_express_entry_rounds')
        """
    )
    records = sorted(records, key=_record_sort_key, reverse=True)
    if not records:
        return {
            "record_count": 0,
            "latest_round": None,
            "recent_rounds": [],
            "category_summary": [],
            "source_summary": [],
        }

    latest_round = records[0]
    recent_rounds = records[:8]
    category_summary = _summarize_express_entry_categories(records)
    source_summary = _summarize_express_entry_sources(records)
    return {
        "record_count": len(records),
        "latest_round": _express_entry_round_payload(latest_round),
        "recent_rounds": [_express_entry_round_payload(record) for record in recent_rounds],
        "category_summary": category_summary,
        "source_summary": source_summary,
    }


@app.get("/api/program-overview")
def api_program_overview() -> dict:
    records = rows(
        """
        select r.*, src.title as source_title, src.publisher
        from official_records r
        join sources src on src.source_id = r.source_id
        where r.record_category = 'draw'
        """
    )
    records = sorted(records, key=_record_sort_key, reverse=True)
    bc_pnp_records = [record for record in records if record.get("policy_scope") == "bc_pnp"]
    express_entry_records = [record for record in records if record.get("policy_scope") == "federal"]
    return {
        "bc_pnp": {
            "record_count": len(bc_pnp_records),
            "latest_draw": _bc_pnp_draw_payload(bc_pnp_records[0]) if bc_pnp_records else None,
            "category_summary": _summarize_bc_pnp_categories(bc_pnp_records),
            "source_summary": _summarize_draw_sources(bc_pnp_records),
        },
        "express_entry": {
            "record_count": len(express_entry_records),
            "latest_draw": _express_entry_round_payload(express_entry_records[0]) if express_entry_records else None,
            "category_summary": _summarize_express_entry_categories(express_entry_records),
            "source_summary": _summarize_express_entry_sources(express_entry_records),
        },
    }


@app.get("/api/policy-overview")
def api_policy_overview() -> dict:
    processing_records = rows(
        """
        select r.*, src.title as source_title, src.publisher
        from official_records r
        join sources src on src.source_id = r.source_id
        where r.record_category = 'processing_time'
        """
    )
    processing_records = sorted(processing_records, key=_record_sort_key, reverse=True)

    policy_changes = rows(
        """
        select c.*, src.title as source_title, src.publisher, src.url as source_url
        from changes c
        join sources src on src.source_id = c.source_id
        where coalesce(c.hidden, 0) = 0
          and coalesce(c.environment, 'production') = 'production'
          and c.source_id in (
            'ircc_processing_times',
            'ircc_program_delivery_updates',
            'ircc_express_entry_reforms_consultation',
            'welcomebc_bc_pnp_online'
          )
        order by detected_at desc
        limit 12
        """
    )

    bc_pnp_processing = [record for record in processing_records if record.get("publisher") == "WelcomeBC"]
    ircc_processing = [record for record in processing_records if record.get("publisher") == "IRCC"]
    bc_pnp_policy = [change for change in policy_changes if change.get("publisher") == "WelcomeBC"]
    ircc_policy = [change for change in policy_changes if change.get("publisher") == "IRCC"]

    return {
        "processing_times": {
            "bc_pnp": _build_processing_overview_group("BC PNP", bc_pnp_processing),
            "ircc": _build_processing_overview_group("IRCC", ircc_processing),
            "record_count": len(processing_records),
        },
        "policy_signals": {
            "bc_pnp": _build_policy_overview_group("BC PNP", bc_pnp_policy),
            "ircc": _build_policy_overview_group("IRCC", ircc_policy),
            "change_count": len(policy_changes),
        },
    }


@app.get("/api/status-overview")
def api_status_overview() -> dict:
    source_rows = rows(
        """
        select source_id, title, publisher, active, last_checked_at, last_changed_at
        from sources
        where active = 1
        """
    )
    latest_source_checks = {
        item["source_id"]: item
        for item in rows(
            """
            select sc.*
            from source_checks sc
            join (
              select source_id, max(checked_at) as checked_at
              from source_checks
              group by source_id
            ) latest
              on latest.source_id = sc.source_id
             and latest.checked_at = sc.checked_at
            """
        )
    }
    sources = []
    for source in source_rows:
        latest_check = latest_source_checks.get(source["source_id"])
        sources.append(
            {
                **source,
                "status": latest_check["status"] if latest_check else ("unknown" if not source.get("last_checked_at") else "ok"),
                "checked_at": latest_check["checked_at"] if latest_check else source.get("last_checked_at"),
                "changed": bool(latest_check["changed"]) if latest_check else False,
                "new_records": latest_check["new_records"] if latest_check else 0,
                "error": latest_check["error"] if latest_check else None,
            }
        )

    changes = rows(
        """
        select c.*, src.title as source_title, src.publisher, src.url as source_url
        from changes c
        join sources src on src.source_id = c.source_id
        where coalesce(c.hidden, 0) = 0
          and coalesce(c.environment, 'production') = 'production'
          and c.change_type = 'program_status'
        order by detected_at desc
        """
    )

    return {
        "bc_pnp": _build_status_overview_group(
            "BC PNP",
            sources,
            changes,
            ["welcomebc_bc_pnp_online", "welcomebc_bc_pnp_overview", "welcomebc_bc_pnp_invitations"],
        ),
        "ircc": _build_status_overview_group(
            "IRCC",
            sources,
            changes,
            ["ircc_program_delivery_updates", "ircc_express_entry_reforms_consultation", "ircc_processing_times"],
        ),
    }


@app.get("/api/profile")
def api_profile(request: Request) -> dict:
    return _load_profile_payload(_profile_owner_key(request))


@app.put("/api/profile")
def api_profile_update(profile: dict, request: Request) -> dict:
    owner_id = _profile_owner_key(request)
    if not owner_id:
        return JSONResponse(
            status_code=401,
            content={
                "message": "로그인 후 프로필을 저장할 수 있습니다.",
                "fieldErrors": {},
            },
        )
    merged = _normalize_profile_payload(profile)
    birth_date_error = _profile_birth_date_error(merged)
    if birth_date_error:
        return JSONResponse(
            status_code=422,
            content={
                "message": "생년월일 형식을 확인해 주세요.",
                "fieldErrors": {"birth_date": birth_date_error},
                "missing": [{"key": "birth_date", "title": "생년월일", "body": birth_date_error}],
            },
        )
    missing = _profile_required_missing(merged, allow_age_fallback=False)
    if missing:
        return JSONResponse(
            status_code=422,
            content={
                "message": "필수 프로필 입력을 모두 완료해야 저장할 수 있습니다.",
                "fieldErrors": {item["key"]: item["body"] for item in missing},
                "missing": missing,
            },
        )
    updated_at = _now_iso()
    payload = _build_profile_response(merged, updated_at)
    execute(
        """
        insert into profiles (profile_id, data_json, updated_at)
        values (?, ?, ?)
        on conflict(profile_id) do update set
          data_json = excluded.data_json,
          updated_at = excluded.updated_at
        """,
        (owner_id, json.dumps(merged, ensure_ascii=False), updated_at),
    )
    return payload


def _numeric_delta(current: str | None, previous: str | None) -> int | None:
    current_value = _to_int(current)
    previous_value = _to_int(previous)
    if current_value is None or previous_value is None:
        return None
    return current_value - previous_value


def _to_int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(str(value).replace(",", ""))
    except ValueError:
        return None


def _record_sort_key(record: dict) -> tuple[str, str]:
    event_date = record.get("event_date") or ""
    try:
        parsed = datetime.strptime(event_date, "%B %d, %Y").date().isoformat()
    except ValueError:
        parsed = ""
    return (parsed, record.get("observed_at") or "")


def _backfill_official_records() -> None:
    execute(
        """
        update official_records
        set
          record_category = coalesce(nullif(record_category, ''), 'draw'),
          policy_scope = coalesce(nullif(policy_scope, ''), 'bc_pnp'),
          stage = coalesce(nullif(stage, ''), title),
          metric_name = coalesce(nullif(metric_name, ''), 'minimum_score'),
          metric_value = coalesce(nullif(metric_value, ''), nullif(minimum_score, ''), nullif(invitations, ''), processing_time),
          metric_unit = coalesce(nullif(metric_unit, ''), case when record_type = 'processing_time' then 'time' else 'points' end)
        where source_id = 'welcomebc_bc_pnp_invitations'
          and record_type = 'bc_pnp_ita'
          and (record_category is null or record_category = '' or policy_scope is null or policy_scope = '' or stage is null or stage = '' or metric_name is null or metric_name = '' or metric_value is null or metric_value = '' or metric_unit is null or metric_unit = '')
        """
    )
    execute(
        """
        update official_records
        set
          record_category = coalesce(nullif(record_category, ''), 'draw'),
          policy_scope = coalesce(nullif(policy_scope, ''), 'federal'),
          stage = coalesce(nullif(stage, ''), title),
          metric_name = coalesce(nullif(metric_name, ''), 'minimum_score'),
          metric_value = coalesce(nullif(metric_value, ''), nullif(minimum_score, ''), nullif(invitations, ''), processing_time),
          metric_unit = coalesce(nullif(metric_unit, ''), 'points')
        where source_id = 'ircc_express_entry_ministerial_instructions'
          and record_type = 'express_entry_round'
          and (record_category is null or record_category = '' or policy_scope is null or policy_scope = '' or stage is null or stage = '' or metric_name is null or metric_name = '' or metric_value is null or metric_value = '' or metric_unit is null or metric_unit = '')
        """
    )
    execute(
        """
        update official_records
        set
          record_category = coalesce(nullif(record_category, ''), 'processing_time'),
          policy_scope = coalesce(nullif(policy_scope, ''), 'bc_pnp'),
          stage = coalesce(nullif(stage, ''), title),
          metric_name = coalesce(nullif(metric_name, ''), 'processing_time'),
          metric_value = coalesce(nullif(metric_value, ''), nullif(processing_time, '')),
          metric_unit = coalesce(nullif(metric_unit, ''), 'time')
        where record_type = 'processing_time'
          and (record_category is null or record_category = '' or policy_scope is null or policy_scope = '' or stage is null or stage = '' or metric_name is null or metric_name = '' or metric_value is null or metric_value = '' or metric_unit is null or metric_unit = '')
        """
    )


def _default_profile() -> dict:
    return {
        "birth_date": "",
        "age": "",
        "marital_status": "",
        "current_status": "",
        "target_route": "Express Entry",
        "education_level": "",
        "eca_status": None,
        "canadian_education": "",
        "sibling_in_canada": None,
        "language_score": "",
        "language_speaking_clb": "",
        "language_listening_clb": "",
        "language_reading_clb": "",
        "language_writing_clb": "",
        "language_test": "",
        "work_experience_years": "",
        "canadian_experience_years": "",
        "foreign_experience_years": "",
        "noc_teer": "",
        "french_score": "",
        "ee_category_interest": "",
        "ee_profile_status": "",
        "ee_profile_notes": "",
        "arranged_employment": None,
        "employer_support": None,
        "bc_pnp_stream_interest": "",
        "bc_pnp_category_interest": "",
        "bc_connection_type": "",
        "bc_connection": "",
        "bc_job_offer": "",
        "bc_occupation_focus": "",
        "province_nomination_interest": None,
        "profile_notes": "",
    }


def _normalize_profile_payload(profile: dict | None) -> dict:
    base = _default_profile()
    if not profile:
        return base

    normalized = {**base}
    normalized["birth_date"] = _clean_text(profile.get("birth_date"))
    normalized["age"] = _clean_text(profile.get("age"))
    normalized["marital_status"] = _normalize_marital_status_value(profile.get("marital_status"))
    normalized["current_status"] = _clean_text(profile.get("current_status"))
    normalized["target_route"] = _clean_text(profile.get("target_route")) or base["target_route"]
    normalized["education_level"] = _normalize_education_level_value(profile.get("education_level"))
    normalized["eca_status"] = _to_optional_bool(profile.get("eca_status"))
    normalized["canadian_education"] = _normalize_canadian_education_value(profile.get("canadian_education"))
    normalized["sibling_in_canada"] = _to_optional_bool(profile.get("sibling_in_canada"))
    normalized["language_score"] = _normalize_language_score_value(profile.get("language_score"))
    normalized["language_speaking_clb"] = _normalize_language_ability_value(profile.get("language_speaking_clb"))
    normalized["language_listening_clb"] = _normalize_language_ability_value(profile.get("language_listening_clb"))
    normalized["language_reading_clb"] = _normalize_language_ability_value(profile.get("language_reading_clb"))
    normalized["language_writing_clb"] = _normalize_language_ability_value(profile.get("language_writing_clb"))
    normalized["language_test"] = _clean_text(profile.get("language_test"))
    normalized["work_experience_years"] = _clean_text(profile.get("work_experience_years"))
    normalized["canadian_experience_years"] = _clean_text(profile.get("canadian_experience_years"))
    normalized["foreign_experience_years"] = _clean_text(profile.get("foreign_experience_years"))
    normalized["noc_teer"] = _clean_text(profile.get("noc_teer"))
    normalized["french_score"] = _normalize_french_score_value(profile.get("french_score"))
    normalized["ee_category_interest"] = _clean_text(profile.get("ee_category_interest"))
    normalized["ee_profile_status"] = _clean_text(profile.get("ee_profile_status"))
    normalized["ee_profile_notes"] = _clean_text(profile.get("ee_profile_notes"))
    normalized["bc_pnp_stream_interest"] = _clean_text(profile.get("bc_pnp_stream_interest"))
    normalized["bc_pnp_category_interest"] = _clean_text(profile.get("bc_pnp_category_interest"))
    normalized["bc_connection_type"] = _clean_text(profile.get("bc_connection_type"))
    normalized["bc_connection"] = _clean_text(profile.get("bc_connection"))
    normalized["bc_job_offer"] = _clean_text(profile.get("bc_job_offer"))
    normalized["bc_occupation_focus"] = _clean_text(profile.get("bc_occupation_focus"))
    normalized["profile_notes"] = _clean_text(profile.get("profile_notes"))
    normalized["employer_support"] = _to_optional_bool(profile.get("employer_support"))
    normalized["arranged_employment"] = _to_optional_bool(profile.get("arranged_employment"))
    normalized["province_nomination_interest"] = _to_optional_bool(profile.get("province_nomination_interest"))
    if not normalized["language_score"]:
        derived_language = _legacy_language_bucket_from_language_abilities(normalized)
        if derived_language:
            normalized["language_score"] = derived_language
    if normalized["work_experience_years"] and not normalized["foreign_experience_years"]:
        normalized["foreign_experience_years"] = normalized["work_experience_years"]
    elif normalized["foreign_experience_years"] and not normalized["work_experience_years"]:
        normalized["work_experience_years"] = normalized["foreign_experience_years"]
    return normalized


def _canonical_lookup(value: object, mapping: dict[str, str]) -> str:
    cleaned = _clean_text(value)
    if not cleaned:
        return ""
    lowered = cleaned.lower()
    return mapping.get(lowered, cleaned)


def _normalize_marital_status_value(value: object) -> str:
    return _canonical_lookup(
        value,
        {
            "single": "single",
            "미혼": "single",
            "married": "married",
            "common-law": "married",
            "기혼": "married",
            "기혼/사실혼": "married",
            "사실혼": "married",
            "other": "other",
            "기타": "other",
        },
    )


def _normalize_education_level_value(value: object) -> str:
    return _canonical_lookup(
        value,
        {
            "high school": "High school",
            "고등학교": "High school",
            "diploma": "Diploma",
            "전문학사/디플로마": "Diploma",
            "전문학사": "Diploma",
            "디플로마": "Diploma",
            "bachelor": "Bachelor",
            "학사": "Bachelor",
            "master": "Master",
            "석사": "Master",
            "phd": "PhD",
            "박사": "PhD",
        },
    )


def _normalize_language_score_value(value: object) -> str:
    cleaned = _clean_text(value)
    if not cleaned:
        return ""
    mapped = {
        "below clb 7": "Below CLB 7",
        "clb 7 미만": "Below CLB 7",
        "clb7 미만": "Below CLB 7",
        "below clb 5": "Below CLB 7",
        "clb 5": "Below CLB 7",
        "clb5": "Below CLB 7",
        "clb 6": "Below CLB 7",
        "clb6": "Below CLB 7",
        "clb 7": "CLB 7",
        "clb7": "CLB 7",
        "clb 8": "CLB 8",
        "clb8": "CLB 8",
        "clb 9": "CLB 9",
        "clb9": "CLB 9",
        "clb 10+": "CLB 10+",
        "clb10+": "CLB 10+",
        "clb 10": "CLB 10+",
        "clb10": "CLB 10+",
    }.get(cleaned.lower())
    if mapped:
        return mapped
    clb = _language_label_to_clb(cleaned)
    if clb is None:
        return cleaned
    return _legacy_language_bucket_from_clb(clb)


def _normalize_language_ability_value(value: object) -> str:
    cleaned = _clean_text(value)
    if not cleaned:
        return ""
    mapped = {
        "below clb 5": "Below CLB 5",
        "below clb5": "Below CLB 5",
        "below 5": "Below CLB 5",
        "clb 4 or below": "Below CLB 5",
        "clb4 or below": "Below CLB 5",
        "below clb 7": "Below CLB 7",
        "clb 7 미만": "Below CLB 7",
        "clb7 미만": "Below CLB 7",
        "clb 5": "CLB 5",
        "clb5": "CLB 5",
        "clb 6": "CLB 6",
        "clb6": "CLB 6",
        "clb 7": "CLB 7",
        "clb7": "CLB 7",
        "clb 8": "CLB 8",
        "clb8": "CLB 8",
        "clb 9": "CLB 9",
        "clb9": "CLB 9",
        "clb 10+": "CLB 10+",
        "clb10+": "CLB 10+",
        "clb 10": "CLB 10+",
        "clb10": "CLB 10+",
        "clb 11": "CLB 10+",
        "clb11": "CLB 10+",
        "clb 12": "CLB 10+",
        "clb12": "CLB 10+",
    }.get(cleaned.lower())
    if mapped:
        return mapped
    clb = _language_label_to_clb(cleaned)
    if clb is None:
        return cleaned
    return _language_ability_label_from_clb(clb)


def _language_label_to_clb(value: object) -> int | None:
    cleaned = _clean_text(value).lower()
    if not cleaned:
        return None
    compact = re.sub(r"[\s_]+", "", cleaned)
    explicit = {
        "belowclb5": 4,
        "below5": 4,
        "clb4orbelow": 4,
        "belowclb7": 6,
        "clb7미만": 6,
        "below7": 6,
        "clb5": 5,
        "clb6": 6,
        "clb7": 7,
        "clb8": 8,
        "clb9": 9,
        "clb10": 10,
        "clb10+": 10,
        "clb11": 10,
        "clb12": 10,
    }.get(compact)
    if explicit is not None:
        return explicit
    match = re.search(r"(\d+)", cleaned)
    if not match:
        return None
    clb = int(match.group(1))
    if clb <= 4:
        return 4
    if clb >= 10:
        return 10
    return clb


def _language_ability_label_from_clb(clb: int | None) -> str:
    if clb is None:
        return ""
    if clb <= 4:
        return "Below CLB 5"
    if clb >= 10:
        return "CLB 10+"
    return f"CLB {clb}"


def _legacy_language_bucket_from_clb(clb: int | None) -> str:
    if clb is None:
        return ""
    if clb >= 10:
        return "CLB 10+"
    if clb == 9:
        return "CLB 9"
    if clb == 8:
        return "CLB 8"
    if clb == 7:
        return "CLB 7"
    return "Below CLB 7"


def _legacy_language_bucket_from_language_abilities(profile: dict) -> str:
    resolved = _resolve_first_official_language(profile)
    if not resolved["complete_inputs"]:
        return ""
    return resolved["legacy_bucket"]


def _normalize_french_score_value(value: object) -> str:
    return _canonical_lookup(
        value,
        {
            "": "",
            "none": "None",
            "없음": "None",
            "nclc 5-6": "NCLC 5-6",
            "nclc5-6": "NCLC 5-6",
            "nclc 7": "NCLC 7",
            "nclc7": "NCLC 7",
            "nclc 8+": "NCLC 8+",
            "nclc8+": "NCLC 8+",
            "nclc 9+": "NCLC 9+",
            "nclc9+": "NCLC 9+",
        },
    )


def _normalize_canadian_education_value(value: object) -> str:
    return _canonical_lookup(
        value,
        {
            "none": "None",
            "없음": "None",
            "1-2 years": "1-2 years",
            "1-2년 과정": "1-2 years",
            "1-2년": "1-2 years",
            "3+ years": "3+ years",
            "3년 이상": "3+ years",
        },
    )


def _profile_owner_key(request: Request | None) -> str | None:
    if request is None:
        return None
    owner = str(request.headers.get("x-user-id") or "").strip()
    return owner or None


def _load_profile_payload(owner_id: str | None = None) -> dict:
    if not owner_id:
        return _build_profile_response(_default_profile(), None)
    stored = row("select data_json, updated_at from profiles where profile_id = ?", (owner_id,))
    profile = _normalize_profile_payload(json.loads(stored["data_json"]) if stored else None)
    return _build_profile_response(profile, stored["updated_at"] if stored else None)


PROFILE_REQUIRED_FIELDS = [
    ("birth_date", "생년월일", "Vancouver 기준 만 나이를 계산하는 기준입니다."),
    ("marital_status", "혼인 상태", "CRS 배우자 기준을 나누기 위해 필요합니다."),
    ("current_status", "현재 체류/거주 상태", "캐나다 안팎과 BC 연결성을 판단합니다."),
    ("education_level", "학력", "CRS와 BC PNP 인적자본 판단에 들어갑니다."),
    ("eca_status", "ECA/WES 평가", "해외 학력을 공식 점수에 반영할 수 있는지 확인합니다."),
    ("work_experience_years", "해외 경력", "연방 경력과 전환 여지를 계산합니다."),
    ("canadian_experience_years", "캐나다 경력", "CEC 및 BC 경로 가까움을 계산합니다."),
    ("language_test", "언어 시험", "공식 시험 기준을 알아야 점수 신뢰도를 계산할 수 있습니다."),
    ("french_score", "프랑스어 NCLC", "없음도 선택값으로 저장해야 합니다."),
    ("ee_category_interest", "EE 카테고리", "Express Entry 관찰 기준입니다."),
    ("bc_occupation_focus", "직업군", "BC PNP와 직업군 비교의 핵심입니다."),
    ("noc_teer", "TEER", "BC PNP 직무 적합도 판단에 필요합니다."),
    ("bc_connection_type", "BC 연결 유형", "BC와의 연결 강도를 나눕니다."),
    ("bc_job_offer", "BC 잡오퍼", "BC PNP 정합도를 크게 좌우합니다."),
    ("employer_support", "고용주 지원", "BC PNP 스트림에 따라 고용주 지원 여부가 필요합니다."),
    ("bc_pnp_stream_interest", "BC PNP 스트림", "비교할 BC PNP 스트림을 고정합니다."),
    ("bc_pnp_category_interest", "BC PNP 카테고리", "카테고리별 신호를 분리합니다."),
]


def _resolve_first_official_language(profile: dict) -> dict:
    legacy_language = _normalize_language_score_value(profile.get("language_score"))
    raw_abilities = {
        ability: _normalize_language_ability_value(profile.get(field))
        for ability, field, _ in FIRST_LANGUAGE_ABILITY_FIELDS
    }
    explicit_count = sum(1 for value in raw_abilities.values() if value)
    explicit_complete = explicit_count == len(FIRST_LANGUAGE_ABILITY_FIELDS)
    source_mode = "missing"
    fallback_label = ""
    if explicit_complete:
        source_mode = "per_ability"
    elif explicit_count and legacy_language:
        source_mode = "mixed_legacy_fallback"
        fallback_label = legacy_language
    elif explicit_count:
        source_mode = "mixed_inferred_fallback"
        provided_clbs = [
            _language_label_to_clb(value)
            for value in raw_abilities.values()
            if value and _language_label_to_clb(value) is not None
        ]
        fallback_label = _language_ability_label_from_clb(min(provided_clbs)) if provided_clbs else ""
    elif legacy_language:
        source_mode = "legacy_single_bucket"
        fallback_label = legacy_language

    abilities: dict[str, dict] = {}
    effective_clbs: list[int] = []
    display_parts: list[str] = []
    for ability, _, short_label in FIRST_LANGUAGE_ABILITY_FIELDS:
        explicit_label = raw_abilities[ability]
        source = "missing"
        effective_label = explicit_label
        if source_mode == "per_ability":
            source = "ability_input" if explicit_label else "missing"
        elif explicit_label:
            source = "ability_input"
        elif source_mode in {"mixed_legacy_fallback", "legacy_single_bucket"} and fallback_label:
            effective_label = fallback_label
            source = "legacy_language_score"
        elif source_mode == "mixed_inferred_fallback" and fallback_label:
            effective_label = fallback_label
            source = "lowest_provided_ability"
        clb = _language_label_to_clb(effective_label)
        if clb is not None:
            effective_clbs.append(clb)
        display_parts.append(f"{short_label[:1].upper()} {effective_label or '-'}")
        abilities[ability] = {
            "input_clb": explicit_label,
            "effective_clb": effective_label,
            "effective_clb_level": clb,
            "source": source,
        }

    min_clb = min(effective_clbs) if len(effective_clbs) == len(FIRST_LANGUAGE_ABILITY_FIELDS) else None
    legacy_bucket = _legacy_language_bucket_from_clb(min_clb) if min_clb is not None else legacy_language
    complete_inputs = explicit_complete or bool(legacy_language)
    return {
        "legacy_bucket": legacy_bucket,
        "legacy_language_score": legacy_language,
        "source_mode": source_mode,
        "abilities": abilities,
        "explicit_count": explicit_count,
        "explicit_complete": explicit_complete,
        "complete_inputs": complete_inputs,
        "used_legacy_fallback": source_mode in {"mixed_legacy_fallback", "legacy_single_bucket"},
        "used_inferred_fallback": source_mode == "mixed_inferred_fallback",
        "min_clb": min_clb,
        "meets_clb5_all": min_clb is not None and min_clb >= 5,
        "meets_clb7_all": min_clb is not None and min_clb >= 7,
        "meets_clb9_all": min_clb is not None and min_clb >= 9,
        "display": " / ".join(display_parts),
    }


def _has_first_official_language_input(profile: dict) -> bool:
    return _resolve_first_official_language(profile)["complete_inputs"]


def _first_official_language_missing_item(profile: dict) -> dict | None:
    resolved = _resolve_first_official_language(profile)
    if resolved["complete_inputs"]:
        return None
    missing_abilities = [
        ability
        for ability, _, _ in FIRST_LANGUAGE_ABILITY_FIELDS
        if not resolved["abilities"][ability]["input_clb"]
    ]
    if resolved["explicit_count"]:
        return {
            "key": "first_official_language",
            "title": "영어 4개 능력",
            "body": f"first official language는 speaking/listening/reading/writing CLB 4개가 모두 필요합니다. 현재 누락: {', '.join(missing_abilities)}.",
        }
    return {
        "key": "first_official_language",
        "title": "영어 CLB",
        "body": "language_score 하나 또는 speaking/listening/reading/writing CLB 4개 전체가 필요합니다.",
    }


def _profile_required_missing(profile: dict, *, allow_age_fallback: bool = True) -> list[dict]:
    missing = []
    for key, title, body in PROFILE_REQUIRED_FIELDS:
        value = profile.get(key)
        if key == "birth_date" and allow_age_fallback and not str(value or "").strip() and str(profile.get("age") or "").strip():
            continue
        if isinstance(value, bool):
            continue
        if not str(value or "").strip():
            missing.append({"key": key, "title": title, "body": body})
    language_missing = _first_official_language_missing_item(profile)
    if language_missing:
        missing.append(language_missing)
    return missing


def _profile_advisory_missing(profile: dict) -> list[dict]:
    advisories = []
    age_details = _profile_age_details(profile)
    language = _resolve_first_official_language(profile)
    if age_details["age"] is not None and age_details["age_basis"] == "legacy age fallback":
        advisories.append(
            {
                "key": "birth_date",
                "title": "생년월일 확인 필요",
                "body": "구형 age fallback 값으로 계산 중입니다. 생년월일을 확인하면 CRS와 경로 판단 신뢰도가 올라갑니다.",
            }
        )
    if language["source_mode"] == "legacy_single_bucket":
        advisories.append(
            {
                "key": "first_official_language_detail",
                "title": "영어 4개 능력 입력 권장",
                "body": "현재 language_score 하나를 speaking/listening/reading/writing 네 능력에 동일 적용해 계산 중입니다. ability별 CLB를 입력하면 공식 CRS와 변화 비교 정확도가 올라갑니다.",
            }
        )
    elif language["source_mode"] == "mixed_legacy_fallback":
        advisories.append(
            {
                "key": "first_official_language_detail",
                "title": "영어 4개 능력 보완 필요",
                "body": "일부 ability는 개별 CLB를 쓰고, 비어 있는 ability는 legacy language_score로 대체 계산 중입니다.",
            }
        )
    elif language["source_mode"] == "mixed_inferred_fallback":
        advisories.append(
            {
                "key": "first_official_language_detail",
                "title": "영어 4개 능력 보완 필요",
                "body": "일부 ability가 비어 있어 입력된 최저 CLB를 나머지 ability의 보수 fallback으로 사용 중입니다.",
            }
        )
    return advisories


def _profile_age_details(profile: dict) -> dict:
    birth_date_text = str(profile.get("birth_date") or "").strip()
    legacy_age = _to_int(profile.get("age"))
    if birth_date_text:
        try:
            birth_date = date.fromisoformat(birth_date_text)
        except ValueError:
            return {
                "age": legacy_age,
                "age_basis": "생년월일 형식이 올바르지 않아 기존 나이값을 사용했습니다." if legacy_age is not None else "생년월일 형식을 확인해 주세요.",
            }
        today = datetime.now(ZoneInfo("America/Vancouver")).date()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return {
            "age": age,
            "age_basis": f"birth_date: {birth_date.isoformat()} · Vancouver 기준 {today.isoformat()}",
        }
    if legacy_age is not None:
        return {
            "age": legacy_age,
            "age_basis": "legacy age fallback",
        }
    return {
        "age": None,
        "age_basis": "생년월일 대기",
    }


def _profile_birth_date_error(profile: dict) -> str | None:
    birth_date_text = str(profile.get("birth_date") or "").strip()
    if not birth_date_text:
        return None
    try:
        date.fromisoformat(birth_date_text)
    except ValueError:
        return "생년월일은 YYYY-MM-DD 형식이어야 합니다."
    return None


def _build_profile_response(profile: dict, updated_at: str | None = None) -> dict:
    age_details = _profile_age_details(profile)
    route_profiles = _build_route_profiles(profile)
    strongest_route = _strongest_route(profile, route_profiles)
    active_route_profile = route_profiles["bc_pnp"] if strongest_route == "BC PNP" else route_profiles["express_entry"]
    profile_missing = _profile_required_missing(profile, allow_age_fallback=True)
    advisory_missing = _profile_advisory_missing(profile)
    profile_complete = len(profile_missing) == 0
    route_missing = _unique_missing_items(active_route_profile.get("missing_requirements", []), advisory_missing)
    missing_requirements = profile_missing or route_missing
    computed_scores = _build_computed_scores(profile, route_profiles, profile_complete)
    diagnostics = _build_profile_diagnostics(profile, route_profiles, computed_scores)
    fit_score = active_route_profile["score"]
    fit_label = active_route_profile.get("fit_label") or _profile_fit_label(fit_score, profile_complete)[0]
    fit_tone = active_route_profile.get("fit_tone") or _profile_fit_label(fit_score, profile_complete)[1]
    score_drivers = active_route_profile["drivers"]
    uncertainties = [item["body"] for item in missing_requirements] if missing_requirements else []
    main_blocker = missing_requirements[0]["title"] if missing_requirements else "주요 막힘 없음"
    next_milestone = _profile_next_milestone(profile, strongest_route, missing_requirements)
    next_action = _profile_next_action(profile, strongest_route, profile_complete, missing_requirements)
    score_potential = _profile_score_potential(profile, strongest_route, fit_score, profile_complete)
    current_status = profile["current_status"] or "프로필 미연결"
    position_explanation = _profile_position_explanation(profile, profile_complete, strongest_route, active_route_profile, computed_scores)
    if profile_complete:
        auto_score = computed_scores["crs"]["score"] or fit_score
        bc_fit = computed_scores["bc_pnp"]["fit_score"] or active_route_profile["score"]
        pnp_range = computed_scores["bc_pnp"]["estimated_registration_range"] or [bc_fit, bc_fit]
        occupation = profile.get("bc_occupation_focus") or "미선택"
        teer = profile.get("noc_teer") or "미선택"
        ee_category = profile.get("ee_category_interest") or "미선택"
        ee_profile = route_profiles["express_entry"]
        ee_cutoff = ee_profile.get("latest_cutoff")
        ee_gap = ee_profile.get("cutoff_gap")
        ee_gap_text = f", EE 컷오프 대비 {ee_gap:+}점" if isinstance(ee_gap, int) else ""
        if _occupation_status(profile) == "직업군 확인됨" and _ee_category_status(profile) == "카테고리 확인됨":
            next_action = (
                f"자동 CRS {auto_score}점{f' / 최신 EE 컷오프 {ee_cutoff}점' if ee_cutoff else ''}{ee_gap_text}, "
                f"BC PNP 조건 정합도 {bc_fit} (추정 등록 점수대 {pnp_range[0]}-{pnp_range[1]}점)를 {occupation} · {teer} · {ee_category} 기준으로 다시 비교하세요."
            )
    main_status = f"{strongest_route} 기준 {fit_label}" if profile_complete else "프로필 등록 필요"
    score_display = f"조건 정합도 {fit_score}" if strongest_route == "BC PNP" and profile_complete else (
        f"CRS {active_route_profile.get('crs_score')} / cutoff {active_route_profile.get('latest_cutoff')}"
        if strongest_route == "Express Entry" and profile_complete and active_route_profile.get("latest_cutoff")
        else "N/A"
    )
    return {
        "profile": profile,
        "updated_at": updated_at,
        "profile_schema_version": PROFILE_SCHEMA_VERSION,
        "age": age_details["age"],
        "age_basis": age_details["age_basis"],
        "profile_complete": profile_complete,
        "profile_gate": "unlocked" if profile_complete else "locked",
        "computed_scores": computed_scores,
        "diagnostics": diagnostics,
        "route_profiles": route_profiles,
        "fit_score": fit_score,
        "fit_label": fit_label,
        "fit_tone": fit_tone,
        "current_status": current_status,
        "strongest_route": strongest_route,
        "main_blocker": main_blocker,
        "next_milestone": next_milestone,
        "next_action": next_action,
        "score": score_display,
        "score_potential": score_potential,
        "score_drivers": score_drivers,
        "uncertainties": uncertainties,
        "missing_requirements": missing_requirements,
        "position_explanation": position_explanation,
        "main_status": main_status,
    }


def _build_route_profiles(profile: dict) -> dict[str, dict]:
    return {
        "bc_pnp": _build_bc_pnp_profile(profile),
        "express_entry": _build_express_entry_profile(profile),
    }


def _build_computed_scores(profile: dict, route_profiles: dict[str, dict], profile_complete: bool) -> dict:
    crs = _compute_auto_crs(profile)
    bc_score = route_profiles["bc_pnp"]["score"]
    ee_score = route_profiles["express_entry"]["score"]
    ee_gap = route_profiles["express_entry"].get("cutoff_gap")
    closer_route = "Express Entry" if isinstance(ee_gap, int) and ee_gap >= 0 and ee_score >= bc_score else "BC PNP"
    pnp_low = max(35, min(135, round(bc_score * 0.95)))
    pnp_high = max(pnp_low + 6, min(160, round(bc_score * 1.25)))
    missing = _unique_missing_items(_profile_required_missing(profile, allow_age_fallback=True), _profile_advisory_missing(profile))
    return {
        "locked": not profile_complete,
        "crs": {
            "score": crs["score"],
            "status": "계산 점수" if profile_complete else "임시 계산 점수",
            "confidence": crs["confidence"],
            "basis": crs["basis"],
            "breakdown": crs["breakdown"],
            "breakdown_details": crs["breakdown_details"],
            "missing": missing,
        },
        "bc_pnp": {
            "fit_score": bc_score,
            "status": "적합도 + 추정 범위" if profile_complete else "임시 적합도 + 추정 범위",
            "estimated_registration_range": [pnp_low, pnp_high],
            "confidence": _bc_pnp_confidence(profile, route_profiles["bc_pnp"], profile_complete),
            "basis": [
                "직업군/TEER",
                "BC 잡오퍼",
                "고용주 지원",
                "BC 연결 유형",
                "학력/경력/언어",
            ],
            "missing": _unique_missing_items(route_profiles["bc_pnp"]["missing_requirements"], _profile_advisory_missing(profile)),
        },
        "express_entry": {
            "crs_score": route_profiles["express_entry"].get("crs_score"),
            "latest_cutoff": route_profiles["express_entry"].get("latest_cutoff"),
            "cutoff_gap": route_profiles["express_entry"].get("cutoff_gap"),
            "readiness_label": route_profiles["express_entry"].get("readiness_label"),
            "status": "CRS 경쟁력 + 컷오프 거리" if profile_complete else "임시 CRS 경쟁력 + 컷오프 거리",
            "missing": route_profiles["express_entry"].get("missing_requirements", []),
        },
        "comparison": {
            "closer_route": closer_route,
            "express_entry_fit": ee_score,
            "bc_pnp_fit": bc_score,
            "next_action": _profile_next_action(profile, closer_route, profile_complete, missing),
        },
    }


def _compute_auto_crs(profile: dict) -> dict:
    spouse = str(profile.get("marital_status") or "").lower() == "married"
    age_details = _profile_age_details(profile)
    age = age_details["age"]
    education = _normalize_education_level_value(profile.get("education_level"))
    language = _resolve_first_official_language(profile)
    french = _normalize_french_score_value(profile.get("french_score"))
    canadian_education = _normalize_canadian_education_value(profile.get("canadian_education"))
    canadian_years = _experience_years(profile.get("canadian_experience_years"))
    foreign_years = _foreign_experience_years(profile)

    age_points = _crs_age_points(age, spouse) if age is not None else 0
    education_points = _crs_education_points(education, spouse, bool(profile.get("eca_status")))
    language_points, language_details = _crs_first_language_points(language, spouse)
    canadian_experience_points = _crs_canadian_experience_points(canadian_years, spouse)
    skill_transferability = _crs_skill_transferability_breakdown(education, language, canadian_years, foreign_years)
    additional = _crs_additional_points_breakdown(profile, language, french, canadian_education)

    core_total = age_points + education_points + language_points + canadian_experience_points
    spouse_total = 0
    skill_total = skill_transferability["score"]
    additional_total = additional["score"]
    total_score = min(core_total + spouse_total + skill_total + additional_total, 1200)

    basis = _unique_non_empty(
        [
            "Canada.ca CRS 구조 기준: core/human capital + spouse factors + skill transferability + additional points",
            _first_language_basis_line(language),
            "2025-03-25 이후 job offer CRS additional points 제거 반영",
            "배우자 세부 입력 부재로 spouse factors는 0점 유지, principal applicant 표만 적용",
            "학력/ECA는 현재 입력 한계상 recognized 여부를 기준으로 보수 계산",
        ]
    )

    components = {
        "age": {
            "score": age_points,
            "max_points": 100 if spouse else 110,
            "basis": age_details["age_basis"],
            "confidence": 72 if age_details["age_basis"] == "legacy age fallback" else 92,
        },
        "education": {
            "score": education_points,
            "max_points": 140 if spouse else 150,
            "basis": "ECA 완료 시 선택 학력 표를 그대로 반영, 미완료 시 provisional recognition rule 적용",
            "confidence": 68 if not profile.get("eca_status") else 90,
        },
        "first_language": {
            "score": language_points,
            "max_points": 128 if spouse else 136,
            "basis": language_details["basis"],
            "confidence": language_details["confidence"],
            "mode": language["source_mode"],
            "abilities": language_details["abilities"],
            "thresholds": language_details["thresholds"],
        },
        "canadian_experience": {
            "score": canadian_experience_points,
            "max_points": 70 if spouse else 80,
            "basis": f"입력값 {profile.get('canadian_experience_years') or '0'} -> full-year bucket {canadian_years}",
            "confidence": 86 if profile.get("canadian_experience_years") else 60,
        },
        "spouse": {
            "score": spouse_total,
            "max_points": 40,
            "basis": "배우자 학력/언어/캐나다 경력 입력이 없어 spouse factors는 v1에서 미반영",
            "confidence": 42,
        },
        "skill_transferability": skill_transferability,
        **additional["components"],
    }

    breakdown = {
        "age": age_points,
        "education": education_points,
        "first_language": language_points,
        "canadian_experience": canadian_experience_points,
        "spouse": spouse_total,
        "skill_transferability": skill_total,
        "french": additional["components"]["french"]["score"],
        "canadian_education": additional["components"]["canadian_education"]["score"],
        "sibling": additional["components"]["sibling"]["score"],
        "provincial_nomination": additional["components"]["provincial_nomination"]["score"],
        "job_offer": additional["components"]["job_offer"]["score"],
    }

    breakdown_details = {
        "total": total_score,
        "core_human_capital": {
            "score": core_total,
            "max_points": 460 if spouse else 500,
        },
        "first_language": {
            "score": language_points,
            "max_points": 128 if spouse else 136,
            "basis": language_details["basis"],
            "confidence": language_details["confidence"],
            "mode": language["source_mode"],
            "legacy_bucket": language["legacy_bucket"],
            "thresholds": language_details["thresholds"],
            "abilities": language_details["abilities"],
        },
        "spouse_factors": {
            "score": spouse_total,
            "max_points": 40,
        },
        "skill_transferability": {
            "score": skill_total,
            "max_points": 100,
            "factors": skill_transferability.get("factors", {}),
        },
        "additional_points": {
            "score": additional_total,
            "max_points": 600,
            "factors": {
                key: value["score"]
                for key, value in additional["components"].items()
            },
        },
        "components": components,
    }

    confidence = 90
    if age_details["age_basis"] == "legacy age fallback":
        confidence -= 18
    if not profile.get("eca_status"):
        confidence -= 14
    if not str(profile.get("language_test") or "").strip():
        confidence -= 8
    if not language["complete_inputs"]:
        confidence -= 10
    elif language["used_legacy_fallback"]:
        confidence -= 8
    elif language["used_inferred_fallback"]:
        confidence -= 12
    if not education:
        confidence -= 10
    if total_score == 0:
        confidence = 20

    return {
        "score": total_score,
        "confidence": max(20, min(confidence, 92)),
        "basis": basis if total_score else ["필수 입력 대기"],
        "breakdown": breakdown,
        "breakdown_details": breakdown_details,
    }


def _crs_education_points(education: str, spouse: bool, eca_status: bool) -> int:
    points = {
        "High school": 28 if spouse else 30,
        "Diploma": 91 if spouse else 98,
        "Bachelor": 112 if spouse else 120,
        "Master": 126 if spouse else 135,
        "PhD": 140 if spouse else 150,
    }.get(education, 0)
    if not points:
        return 0
    if eca_status:
        return points
    return {
        "High school": 30,
        "Diploma": 84,
        "Bachelor": 102,
        "Master": 112,
        "PhD": 118,
    }.get(education, min(points, 90))


def _crs_first_language_points(language: dict, spouse: bool) -> tuple[int, dict]:
    ability_details: dict[str, dict] = {}
    total_score = 0
    for ability, _, _ in FIRST_LANGUAGE_ABILITY_FIELDS:
        clb = language["abilities"][ability]["effective_clb_level"]
        ability_score = _crs_first_language_ability_points(clb, spouse)
        total_score += ability_score
        ability_details[ability] = {
            **language["abilities"][ability],
            "score": ability_score,
            "max_points": 32 if spouse else 34,
        }
    confidence = 90
    if language["source_mode"] == "legacy_single_bucket":
        confidence = 72
    elif language["source_mode"] == "mixed_legacy_fallback":
        confidence = 78
    elif language["source_mode"] == "mixed_inferred_fallback":
        confidence = 64
    thresholds = {
        "clb5_all": language["meets_clb5_all"],
        "clb7_all": language["meets_clb7_all"],
        "clb9_all": language["meets_clb9_all"],
        "min_clb": language["min_clb"],
    }
    return total_score, {
        "basis": _first_language_basis_line(language),
        "confidence": confidence,
        "abilities": ability_details,
        "thresholds": thresholds,
    }


def _crs_first_language_ability_points(clb: int | None, spouse: bool) -> int:
    if clb is None:
        return 0
    if clb <= 4:
        return 0
    if clb <= 6:
        return 6
    if clb == 7:
        return 16 if spouse else 17
    if clb == 8:
        return 22 if spouse else 23
    if clb == 9:
        return 29 if spouse else 31
    return 32 if spouse else 34


def _crs_skill_transferability_breakdown(education: str, language: dict, canadian_years: int, foreign_years: int) -> dict:
    education_language = _crs_skill_education_language_points(education, language)
    education_canadian_experience = _crs_skill_education_canadian_experience_points(education, canadian_years)
    foreign_work_language = _crs_skill_foreign_work_language_points(foreign_years, language)
    foreign_work_canadian_experience = _crs_skill_foreign_work_canadian_experience_points(foreign_years, canadian_years)
    certificate_language = 0
    uncapped_score = (
        education_language
        + education_canadian_experience
        + foreign_work_language
        + foreign_work_canadian_experience
        + certificate_language
    )
    total_score = min(100, uncapped_score)
    language_threshold = _crs_skill_language_threshold(language)
    language_basis = _crs_skill_language_basis(language)
    confidence = 84
    if language["used_legacy_fallback"]:
        confidence = 74
    elif language["used_inferred_fallback"]:
        confidence = 66
    return {
        "score": total_score,
        "max_points": 100,
        "basis": f"공식 transferability 구조 중 교육+언어, 교육+캐나다경력, 해외경력+언어, 해외경력+캐나다경력 반영 ({language_basis})",
        "confidence": confidence,
        "factors": {
            "education_language": {
                "score": education_language,
                "basis": f"학력 버킷과 4개 ability 기준 언어 threshold 조합 ({language_threshold})",
            },
            "education_canadian_experience": {
                "score": education_canadian_experience,
                "basis": "학력 버킷과 캐나다 경력 연차 조합",
            },
            "foreign_work_language": {
                "score": foreign_work_language,
                "basis": f"해외 경력 연차와 4개 ability 기준 언어 threshold 조합 ({language_threshold})",
            },
            "foreign_work_canadian_experience": {
                "score": foreign_work_canadian_experience,
                "basis": "해외 경력 연차와 캐나다 경력 연차 조합",
            },
            "certificate_language": {
                "score": certificate_language,
                "basis": "trade certificate 입력이 없어 v1 미반영",
            },
        },
    }


def _crs_additional_points_breakdown(profile: dict, language: dict, french: str, canadian_education: str) -> dict:
    if french in {"NCLC 7", "NCLC 8+", "NCLC 9+"}:
        french_points = 50 if language["meets_clb5_all"] else 25
    else:
        french_points = 0
    canadian_education_points = {
        "1-2 years": 15,
        "3+ years": 30,
    }.get(canadian_education, 0)
    sibling_points = 15 if profile.get("sibling_in_canada") else 0
    provincial_nomination_points = 0
    job_offer_points = 0
    components = {
        "french": {
            "score": french_points,
            "max_points": 50,
            "basis": "French additional points 표를 사용하되 영어는 4개 ability의 CLB 5 이상 여부로 25/50점을 구분",
            "confidence": 70 if french_points and language["used_inferred_fallback"] else (76 if french_points and language["used_legacy_fallback"] else 84),
        },
        "canadian_education": {
            "score": canadian_education_points,
            "max_points": 30,
            "basis": "선택한 캐나다 학력 버킷 추가점",
            "confidence": 88 if canadian_education_points else 84,
        },
        "sibling": {
            "score": sibling_points,
            "max_points": 15,
            "basis": "캐나다 시민권자/영주권자 형제자매 여부",
            "confidence": 88 if profile.get("sibling_in_canada") is not None else 62,
        },
        "provincial_nomination": {
            "score": provincial_nomination_points,
            "max_points": 600,
            "basis": "현재 입력은 nomination interest뿐이라 actual nomination으로 간주하지 않음",
            "confidence": 90,
        },
        "job_offer": {
            "score": job_offer_points,
            "max_points": 0,
            "basis": "2025-03-25 이후 Express Entry CRS additional points에서 job offer 제거 반영",
            "confidence": 92,
        },
    }
    return {
        "score": sum(item["score"] for item in components.values()),
        "components": components,
    }


def _crs_skill_education_language_points(education: str, language: dict) -> int:
    tier = _crs_education_transferability_tier(education)
    threshold = _crs_skill_language_threshold(language)
    if tier == "none" or threshold == "below_clb7":
        return 0
    if tier == "post_secondary":
        return 25 if threshold == "clb9_all" else 13
    return 50 if threshold == "clb9_all" else 25


def _crs_skill_education_canadian_experience_points(education: str, canadian_years: int) -> int:
    tier = _crs_education_transferability_tier(education)
    if tier == "none" or canadian_years <= 0:
        return 0
    if tier == "post_secondary":
        return 25 if canadian_years >= 2 else 13
    return 50 if canadian_years >= 2 else 25


def _crs_skill_foreign_work_language_points(foreign_years: int, language: dict) -> int:
    threshold = _crs_skill_language_threshold(language)
    if foreign_years <= 0 or threshold == "below_clb7":
        return 0
    if foreign_years >= 3:
        return 50 if threshold == "clb9_all" else 25
    return 25 if threshold == "clb9_all" else 13


def _crs_skill_language_threshold(language: dict) -> str:
    if language["meets_clb9_all"]:
        return "clb9_all"
    if language["meets_clb7_all"]:
        return "clb7_all"
    return "below_clb7"


def _crs_skill_language_basis(language: dict) -> str:
    threshold = _crs_skill_language_threshold(language)
    if threshold == "clb9_all":
        return "CLB 9 이상 all abilities"
    if threshold == "clb7_all":
        return "CLB 7 이상 all abilities"
    return "CLB 7 all abilities 미충족"


def _first_language_basis_line(language: dict) -> str:
    if language["source_mode"] == "per_ability":
        return "First official language는 speaking/listening/reading/writing ability별 CLB 입력을 우선 적용"
    if language["source_mode"] == "mixed_legacy_fallback":
        return "First official language는 ability별 입력을 우선 적용하고, 비어 있는 ability는 legacy language_score로 보완"
    if language["source_mode"] == "mixed_inferred_fallback":
        return "First official language는 일부 ability만 입력되어, 비어 있는 ability에 입력된 최저 CLB를 보수 fallback으로 사용"
    if language["source_mode"] == "legacy_single_bucket":
        return "First official language는 legacy language_score 하나를 4개 ability에 동일 적용한 fallback 계산"
    return "First official language 입력이 비어 있어 언어 점수를 계산하지 못함"


def _crs_skill_foreign_work_canadian_experience_points(foreign_years: int, canadian_years: int) -> int:
    if foreign_years <= 0 or canadian_years <= 0:
        return 0
    if foreign_years >= 3:
        return 50 if canadian_years >= 2 else 25
    return 25 if canadian_years >= 2 else 13


def _crs_education_transferability_tier(education: str) -> str:
    if education == "Diploma":
        return "post_secondary"
    if education in {"Bachelor", "Master", "PhD"}:
        return "advanced"
    return "none"


def _crs_age_points(age: int, spouse: bool) -> int:
    without_spouse = {
        18: 99,
        19: 105,
        30: 105,
        31: 99,
        32: 94,
        33: 88,
        34: 83,
        35: 77,
        36: 72,
        37: 66,
        38: 61,
        39: 55,
        40: 50,
        41: 39,
        42: 28,
        43: 17,
        44: 6,
    }
    with_spouse = {
        18: 90,
        19: 95,
        30: 95,
        31: 90,
        32: 85,
        33: 80,
        34: 75,
        35: 70,
        36: 65,
        37: 60,
        38: 55,
        39: 50,
        40: 45,
        41: 35,
        42: 25,
        43: 15,
        44: 5,
    }
    if 20 <= age <= 29:
        return 100 if spouse else 110
    if age <= 17 or age >= 45:
        return 0
    return (with_spouse if spouse else without_spouse).get(age, 0)


def _crs_canadian_experience_points(years: int, spouse: bool) -> int:
    if years >= 5:
        return 70 if spouse else 80
    if years == 4:
        return 63 if spouse else 72
    if years == 3:
        return 56 if spouse else 64
    if years == 2:
        return 46 if spouse else 53
    if years == 1:
        return 35 if spouse else 40
    return 0


def _experience_years(value: object) -> int:
    cleaned = _clean_text(value)
    if not cleaned:
        return 0
    direct = _to_int(cleaned)
    if direct is not None:
        return max(0, direct)

    lowered = cleaned.lower()
    year_match = re.search(r"(\d+)\s*(?:years?|yrs?|년)", lowered)
    month_match = re.search(r"(\d+)\s*(?:months?|mos?|개월)", lowered)
    total_months = 0
    if year_match:
        total_months += int(year_match.group(1)) * 12
    if month_match:
        total_months += int(month_match.group(1))
    if total_months:
        return max(0, total_months // 12)
    return 0


def _foreign_experience_years(profile: dict) -> int:
    primary = _experience_years(profile.get("work_experience_years"))
    fallback = _experience_years(profile.get("foreign_experience_years"))
    return primary if primary else fallback


def _foreign_experience_display(profile: dict) -> str:
    return str(profile.get("work_experience_years") or profile.get("foreign_experience_years") or "").strip()


def _first_official_language_summary(profile: dict) -> str:
    resolved = _resolve_first_official_language(profile)
    if resolved["source_mode"] == "per_ability":
        return resolved["display"]
    if resolved["source_mode"] in {"mixed_legacy_fallback", "mixed_inferred_fallback"}:
        return f"{resolved['display']} ({resolved['legacy_bucket'] or 'partial'})"
    return resolved["legacy_bucket"] or ""


def _build_bc_pnp_profile(profile: dict) -> dict:
    first_language_summary = _first_official_language_summary(profile)
    first_language_bucket = _resolve_first_official_language(profile)["legacy_bucket"]
    missing = []
    if not str(profile.get("current_status") or "").strip():
        missing.append({"title": "현재 상태", "body": "현재 근무/체류 상태가 BC PNP 적합도 판단의 기준입니다."})
    if not str(profile.get("bc_connection_type") or "").strip():
        missing.append({"title": "BC 연결 유형", "body": "BC 잡오퍼, 근무, 학업, 가족 연결을 분리해야 합니다."})
    if not str(profile.get("bc_job_offer") or "").strip():
        missing.append({"title": "BC 잡오퍼", "body": "BC PNP 경로는 잡오퍼 여부가 핵심 판단값입니다."})
    if not str(profile.get("bc_pnp_stream_interest") or "").strip():
        missing.append({"title": "BC PNP 스트림", "body": "비교할 BC PNP 스트림을 선택해야 합니다."})
    if not str(profile.get("bc_pnp_category_interest") or "").strip():
        missing.append({"title": "BC PNP 카테고리", "body": "직업군과 카테고리 신호를 함께 비교합니다."})
    if not str(profile.get("bc_occupation_focus") or "").strip():
        missing.append({"title": "직업군", "body": "직업군을 선택해야 BC PNP/EE 비교가 의미 있게 열립니다."})
    if not str(profile.get("noc_teer") or "").strip():
        missing.append({"title": "TEER", "body": "직무 매칭 기준은 TEER로 고정합니다."})
    if not str(profile.get("work_experience_years") or "").strip():
        missing.append({"title": "해외 경력", "body": "경력 기간은 스트림 적합도와 신뢰도에 들어갑니다."})
    if not str(profile.get("education_level") or "").strip():
        missing.append({"title": "학력", "body": "학력은 BC PNP 인적자본 판단에도 사용됩니다."})
    if not _has_first_official_language_input(profile):
        missing.append({"title": "영어 CLB", "body": "CLB는 EE와 BC PNP 모두에서 쓰는 공통 언어 기준입니다."})
    if not profile.get("employer_support") and _bc_pnp_stream_needs_employer(profile):
        missing.append({"title": "고용주 지원", "body": "이 BC PNP 경로는 보통 고용주 지원이 중요합니다."})
    occupation_is_other = _occupation_status(profile) == "직업군 재분류 필요"
    if occupation_is_other:
        missing.append({"key": "bc_occupation_focus", "title": "직업군 세분화", "body": "직업군이 Other면 BC PNP 정합도를 높게 단정할 수 없습니다. 구체 직업군을 선택해야 합니다."})
    score = 24
    score += _bc_connection_points(profile.get("bc_connection_type"))
    score += _bc_job_offer_points(profile.get("bc_job_offer"))
    score += _score_text_presence(profile.get("bc_pnp_stream_interest"), 8)
    score += _score_text_presence(profile.get("bc_pnp_category_interest"), 8)
    score += _score_text_presence(profile.get("bc_occupation_focus"), 6)
    score += _score_text_presence(profile.get("noc_teer"), 6)
    score += _score_numeric(profile.get("work_experience_years"), 6, 5)
    score += _bc_education_points(profile.get("education_level"))
    score += _bc_pnp_language_points(first_language_bucket)
    if profile.get("employer_support"):
        score += 10
    if profile.get("province_nomination_interest"):
        score += 5
    if occupation_is_other:
        score = min(score, 58)
    if _profile_age_details(profile)["age_basis"] == "legacy age fallback":
        score = min(score, 72)
    score = min(score, 100)
    ready = len(missing) == 0
    if occupation_is_other:
        fit_label, fit_tone = ("직업군 재판단 필요", "warn")
    elif not ready:
        fit_label, fit_tone = ("정보 보강 필요", "warn")
    elif score >= 85:
        fit_label, fit_tone = ("조건 정합도 높음", "good")
    elif score >= 70:
        fit_label, fit_tone = ("조건 정합도 보통 이상", "good")
    elif score >= 55:
        fit_label, fit_tone = ("조건 확인 필요", "warn")
    else:
        fit_label, fit_tone = ("보강 필요", "warn")
    drivers = _unique_non_empty([
        f"BC 연결: {profile['bc_connection_type']}" if profile.get("bc_connection_type") else "",
        f"잡오퍼: {profile['bc_job_offer']}" if profile.get("bc_job_offer") else "",
        f"스트림: {profile['bc_pnp_stream_interest']}" if profile.get("bc_pnp_stream_interest") else "",
        f"카테고리: {profile['bc_pnp_category_interest']}" if profile.get("bc_pnp_category_interest") else "",
        f"직업군: {profile['bc_occupation_focus']}" if profile.get("bc_occupation_focus") else "",
        f"TEER: {profile['noc_teer']}" if profile.get("noc_teer") else "",
        f"영어 CLB: {first_language_summary}" if first_language_summary else "",
        "고용주 지원 있음" if profile.get("employer_support") else "",
    ])
    signals = _unique_non_empty([
        f"BC 연결: {profile['bc_connection_type']}" if profile.get("bc_connection_type") else "",
        f"스트림: {profile['bc_pnp_stream_interest']}" if profile.get("bc_pnp_stream_interest") else "",
        f"카테고리: {profile['bc_pnp_category_interest']}" if profile.get("bc_pnp_category_interest") else "",
        f"직업군: {profile['bc_occupation_focus']}" if profile.get("bc_occupation_focus") else "",
        f"TEER: {profile['noc_teer']}" if profile.get("noc_teer") else "",
        f"영어 CLB: {first_language_summary}" if first_language_summary else "",
        "고용주 지원" if profile.get("employer_support") else "",
    ])
    return {
        "route": "BC PNP",
        "score": score,
        "fit_label": fit_label,
        "fit_tone": fit_tone,
        "ready": ready,
        "summary": "BC PNP는 직업군, TEER, BC 잡오퍼, 고용주 지원, BC 연결성을 기준으로 조건 정합도를 봅니다.",
        "focus": profile.get("bc_pnp_category_interest") or profile.get("bc_pnp_stream_interest") or "BC PNP",
        "drivers": drivers or ["BC PNP 입력 대기"],
        "signals": signals or ["BC PNP 입력 대기"],
        "missing_requirements": _unique_missing_items(missing),
    }


def _build_express_entry_profile(profile: dict) -> dict:
    age_details = _profile_age_details(profile)
    foreign_experience_text = _foreign_experience_display(profile)
    first_language_summary = _first_official_language_summary(profile)
    missing = []
    if not str(profile.get("current_status") or "").strip():
        missing.append({"title": "현재 상태", "body": "현재 체류 상태가 Express Entry 적합도 판단에 필요합니다."})
    if not str(profile.get("ee_category_interest") or "").strip():
        missing.append({"title": "EE 카테고리", "body": "추적할 Express Entry 카테고리를 선택해야 합니다."})
    if age_details["age"] is None:
        missing.append({"title": "나이", "body": "CRS 자동 계산에 필요합니다."})
    if not _has_first_official_language_input(profile):
        missing.append({"title": "영어 CLB", "body": "언어 점수는 CRS와 카테고리 경쟁력을 좌우합니다."})
    if not str(profile.get("education_level") or "").strip():
        missing.append({"title": "학력", "body": "학력은 CRS 핵심 항목입니다."})
    if not profile.get("eca_status"):
        missing.append({"title": "ECA/WES 평가", "body": "해외 학력을 점수에 반영할 신뢰도를 정합니다."})
    if not str(profile.get("canadian_experience_years") or "").strip():
        missing.append({"title": "캐나다 경력", "body": "CEC와 CRS 계산의 핵심 항목입니다."})
    if profile.get("ee_category_interest") == "French" and not str(profile.get("french_score") or "").strip():
        missing.append({"title": "프랑스어 NCLC", "body": "프랑스어 카테고리는 NCLC 기준이 필요합니다."})
    if profile.get("ee_category_interest") in {"PNP", "Provincial Nominee"} and not profile.get("province_nomination_interest"):
        missing.append({"title": "PNP 관심", "body": "PNP 기반 EE 경로는 노미네이션 전략을 함께 봅니다."})
    if profile.get("ee_category_interest") in {"CEC", "FSW", "FST", "Healthcare", "Trades"} and not foreign_experience_text:
        missing.append({"title": "해외 경력", "body": "여러 EE 카테고리에서 해외 경력이 경쟁력을 바꿉니다."})
    crs = _compute_auto_crs(profile)
    snapshot = _express_entry_cutoff_snapshot(profile)
    latest_cutoff = snapshot.get("latest_cutoff")
    cutoff_record = snapshot.get("record") or {}
    cutoff_gap = crs["score"] - latest_cutoff if latest_cutoff is not None else None
    category_known = bool(snapshot.get("category_known"))
    structure_score = 18
    structure_score += _score_text_presence(first_language_summary, 8)
    structure_score += _score_text_presence(profile.get("language_test"), 4)
    structure_score += _score_text_presence(profile.get("education_level"), 4)
    structure_score += _score_text_presence(profile.get("canadian_experience_years"), 6)
    structure_score += _score_text_presence(profile.get("ee_category_interest"), 6)
    structure_score += _score_text_presence(foreign_experience_text, 4)
    if profile.get("eca_status"):
        structure_score += 6
    if profile.get("arranged_employment"):
        structure_score += 4
    if profile.get("province_nomination_interest"):
        structure_score += 4
    if profile.get("french_score") and profile.get("french_score") != "None":
        structure_score += 4
    if cutoff_gap is None:
        score = min(58, structure_score)
    elif cutoff_gap <= -200:
        score = min(24, structure_score)
    elif cutoff_gap <= -150:
        score = min(32, structure_score)
    elif cutoff_gap <= -100:
        score = min(42, structure_score)
    elif cutoff_gap <= -50:
        score = min(54, structure_score)
    elif cutoff_gap < 0:
        score = min(66, structure_score + 4)
    elif cutoff_gap < 25:
        score = min(78, structure_score + 8)
    else:
        score = min(92, structure_score + 12)
    ready = len(missing) == 0
    readiness_label, readiness_tone = _express_entry_readiness_label(category_known, cutoff_gap)
    if age_details["age_basis"] == "legacy age fallback":
        missing.append(
            {
                "key": "birth_date",
                "title": "생년월일 확인 필요",
                "body": "구형 age fallback 값으로 계산 중입니다. 생년월일을 확인하면 CRS 계산 신뢰도가 올라갑니다.",
            }
        )
    drivers = _unique_non_empty([
        f"자동 CRS {crs['score']}점" if crs["basis"] else "",
        f"카테고리: {profile['ee_category_interest']}" if profile.get("ee_category_interest") else "",
        f"언어: {first_language_summary} · {profile['language_test']}" if first_language_summary or profile.get("language_test") else "",
        f"캐나다 경력: {profile['canadian_experience_years']}년" if profile.get("canadian_experience_years") else "",
        f"해외 경력: {foreign_experience_text}년" if foreign_experience_text else "",
        f"학력: {profile['education_level']}" if profile.get("education_level") else "",
        "ECA/WES 완료" if profile.get("eca_status") else "",
        "프랑스어 신호 있음" if profile.get("french_score") and profile.get("french_score") != "None" else "",
        f"최신 컷오프 {latest_cutoff}점" if latest_cutoff is not None else "",
        f"컷오프 대비 {cutoff_gap:+}점" if cutoff_gap is not None else "",
    ])
    signals = _unique_non_empty([
        f"EE 카테고리: {profile['ee_category_interest']}" if profile.get("ee_category_interest") else "",
        f"자동 CRS: {crs['score']}" if crs["basis"] else "",
        f"최신 컷오프: {latest_cutoff}" if latest_cutoff is not None else "",
        f"컷오프 차이: {cutoff_gap:+}" if cutoff_gap is not None else "",
        f"언어: {first_language_summary}" if first_language_summary else "",
        f"시험: {profile['language_test']}" if profile.get("language_test") else "",
        f"캐나다 경력: {profile['canadian_experience_years']}" if profile.get("canadian_experience_years") else "",
        f"프랑스어: {profile['french_score']}" if profile.get("french_score") else "",
        "ECA/WES 완료" if profile.get("eca_status") else "",
    ])
    return {
        "route": "Express Entry",
        "score": score,
        "fit_label": readiness_label,
        "fit_tone": readiness_tone,
        "ready": ready,
        "summary": "Express Entry는 자동 CRS 자체보다 최신 컷오프 대비 거리와 카테고리 경쟁력을 기준으로 읽습니다.",
        "focus": profile.get("ee_category_interest") or "Express Entry",
        "drivers": drivers or ["Express Entry 입력 대기"],
        "signals": signals or ["Express Entry 입력 대기"],
        "missing_requirements": _unique_missing_items(missing),
        "crs_score": crs["score"],
        "latest_cutoff": latest_cutoff,
        "cutoff_gap": cutoff_gap,
        "readiness_label": readiness_label,
        "benchmark_label": snapshot.get("benchmark_label"),
        "cutoff_basis_label": "임시 기준" if not category_known else "카테고리 기준",
        "latest_cutoff_stage": cutoff_record.get("stage"),
        "latest_cutoff_event_date": cutoff_record.get("event_date"),
    }


def _bc_pnp_stream_needs_employer(profile: dict) -> bool:
    stream = str(profile.get("bc_pnp_stream_interest") or "").lower()
    category = str(profile.get("bc_pnp_category_interest") or "").lower()
    return any(keyword in f"{stream} {category}" for keyword in ["skills", "health", "child", "tech", "construction", "trade"])


def _score_text_presence(value: object, max_points: int) -> int:
    return max_points if str(value or "").strip() else 0


def _bc_pnp_language_points(value: object) -> int:
    language = str(value or "").strip()
    return {
        "Below CLB 7": 0,
        "CLB 7": 2,
        "CLB 8": 4,
        "CLB 9": 6,
        "CLB 10+": 8,
    }.get(language, 0)


def _bc_connection_points(value: object) -> int:
    connection = str(value or "").strip().lower()
    if not connection or connection in {"no clear connection", "none", "없음"}:
        return 0
    if any(keyword in connection for keyword in ["job offer", "work history"]):
        return 8
    if any(keyword in connection for keyword in ["study", "family", "community"]):
        return 6
    return 4


def _bc_job_offer_points(value: object) -> int:
    job_offer = str(value or "").strip().lower()
    if job_offer in {"yes", "있음"}:
        return 10
    if job_offer in {"pending", "진행 중"}:
        return 6
    return 0


def _bc_education_points(value: object) -> int:
    education = str(value or "").strip()
    return {
        "High school": 1,
        "Diploma": 2,
        "Bachelor": 3,
        "Master": 4,
        "PhD": 4,
    }.get(education, 0)


def _score_numeric(value: object, max_points: int, max_scale: int) -> int:
    numeric = _to_int(value)
    if numeric is None:
        return 0
    return min(max_points, round((numeric / max_scale) * max_points))


def _unique_non_empty(items: list[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        cleaned = str(item or "").strip()
        if cleaned and cleaned not in result:
            result.append(cleaned)
    return result


def _unique_missing_items(*groups: list[dict]) -> list[dict]:
    result: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for group in groups:
        for item in group or []:
            key = (str(item.get("key") or ""), str(item.get("title") or ""))
            if key in seen:
                continue
            seen.add(key)
            result.append(item)
    return result


def _occupation_status(profile: dict) -> str:
    occupation = str(profile.get("bc_occupation_focus") or "").strip().lower()
    if not occupation:
        return "직업군 미입력"
    if occupation in {"other", "etc", "기타", "not sure", "unknown", "미정", "모름", "미선택"}:
        return "직업군 재분류 필요"
    if any(keyword in occupation for keyword in ["closest", "가장 가까운", "재분류", "not sure", "unknown"]):
        return "직업군 재분류 필요"
    return "직업군 확인됨"


def _ee_category_status(profile: dict) -> str:
    category = str(profile.get("ee_category_interest") or "").strip().lower()
    if not category:
        return "카테고리 미입력"
    if category in {"not sure", "unknown", "미정", "모름"}:
        return "카테고리 미정"
    return "카테고리 확인됨"


def _recommended_occupation_groups(profile: dict) -> list[str]:
    occupation = str(profile.get("bc_occupation_focus") or "").strip().lower()
    category = str(profile.get("bc_pnp_category_interest") or "").strip().lower()
    teer = str(profile.get("noc_teer") or "").strip().lower()
    if any(keyword in occupation for keyword in ["service", "hospitality", "operation", "restaurant", "retail", "hotel", "food", "customer-facing", "접객", "서비스", "운영"]):
        return ["서비스/접객/운영", "행정/사무/고객지원", "운송/물류", "제조/농식품"]
    if any(keyword in occupation for keyword in ["admin", "office", "customer support", "customer success", "coordinator", "assistant", "행정", "사무", "고객지원"]):
        return ["행정/사무/고객지원", "서비스/접객/운영", "운송/물류", "제조/농식품"]
    if any(keyword in occupation for keyword in ["transport", "logistics", "warehouse", "supply chain", "driver", "dispatch", "운송", "물류"]):
        return ["운송/물류", "제조/농식품", "서비스/접객/운영", "건설/기능직"]
    if any(keyword in occupation for keyword in ["manufacturing", "production", "factory", "agri", "food processing", "farm", "manufacture", "제조", "농식품", "생산"]):
        return ["제조/농식품", "운송/물류", "서비스/접객/운영", "건설/기능직"]
    if "trade" in category or "teer 2" in teer:
        return ["건설/기능직", "운송/물류", "제조/농식품", "서비스/접객/운영"]
    if "health" in category or "child" in category:
        return ["Healthcare", "Education", "서비스/접객/운영", "행정/사무/고객지원"]
    if "tech" in category:
        return ["Tech / Software", "Design / Product", "행정/사무/고객지원", "서비스/접객/운영"]
    if "construction" in category:
        return ["건설/기능직", "운송/물류", "제조/농식품", "서비스/접객/운영"]
    if "regional" in category or "general" in category or teer in {"teer 3", "teer 4", "teer 5"}:
        return ["서비스/접객/운영", "행정/사무/고객지원", "운송/물류", "제조/농식품"]
    return ["서비스/접객/운영", "행정/사무/고객지원", "운송/물류", "제조/농식품"]


def _bc_pnp_confidence(profile: dict, route_profile: dict, profile_complete: bool) -> int:
    if not profile_complete:
        return 24
    confidence = 82 if (route_profile.get("score") or 0) >= 70 else 66
    if _occupation_status(profile) != "직업군 확인됨":
        confidence -= 32
    if _profile_age_details(profile)["age_basis"] == "legacy age fallback":
        confidence -= 10
    return max(20, min(confidence, 88))


def _build_profile_diagnostics(profile: dict, route_profiles: dict[str, dict], computed_scores: dict) -> dict:
    blocking_inputs = _unique_missing_items(
        _profile_required_missing(profile, allow_age_fallback=True),
        _profile_advisory_missing(profile),
        route_profiles.get("bc_pnp", {}).get("missing_requirements", []),
        route_profiles.get("express_entry", {}).get("missing_requirements", []),
    )
    return {
        "occupation_status": _occupation_status(profile),
        "ee_category_status": _ee_category_status(profile),
        "crs_confidence": computed_scores.get("crs", {}).get("confidence"),
        "pnp_confidence": computed_scores.get("bc_pnp", {}).get("confidence"),
        "blocking_inputs": blocking_inputs,
        "recommended_occupation_groups": _recommended_occupation_groups(profile),
    }


def _strongest_route(profile: dict, route_profiles: dict[str, dict]) -> str:
    target = str(profile.get("target_route") or "").strip()
    bc_score = route_profiles["bc_pnp"]["score"]
    ee_score = route_profiles["express_entry"]["score"]
    ee_gap = route_profiles["express_entry"].get("cutoff_gap")
    if target in {"BC PNP", "Express Entry"}:
        target_key = target.lower().replace(" ", "_")
        other_score = ee_score if target_key == "bc_pnp" else bc_score
        if target == "Express Entry" and isinstance(ee_gap, int) and ee_gap < -60 and bc_score >= 60:
            return "BC PNP"
        if not _has_route_signals(profile) or route_profiles[target_key]["ready"] or route_profiles[target_key]["score"] >= other_score:
            return target
    if target == "Both":
        if isinstance(ee_gap, int):
            if ee_gap >= 0 and ee_score >= bc_score:
                return "Express Entry"
            if ee_gap < 0 and bc_score >= 55:
                return "BC PNP"
        return "BC PNP" if bc_score >= ee_score else "Express Entry"
    if bc_score > ee_score:
        return "BC PNP"
    return "Express Entry"


def _has_route_signals(profile: dict) -> bool:
    fields = [
        "birth_date",
        "marital_status",
        "bc_connection",
        "bc_connection_type",
        "bc_pnp_stream_interest",
        "bc_pnp_category_interest",
        "bc_job_offer",
        "bc_occupation_focus",
        "ee_category_interest",
        "language_test",
        "language_score",
        "eca_status",
        "canadian_education",
        "canadian_experience_years",
        "foreign_experience_years",
        "education_level",
        "french_score",
        "ee_profile_status",
    ]
    return _has_first_official_language_input(profile) or any(bool(str(profile.get(field) or "").strip()) for field in fields)


def _profile_fit_label(score: int, profile_complete: bool) -> tuple[str, str]:
    if not profile_complete and score < 55:
        return ("프로필 필요", "warn")
    if score >= 85:
        return ("정합도 높음", "good")
    if score >= 70:
        return ("보통 이상", "good")
    if score >= 55:
        return ("관찰 필요", "warn")
    return ("보강 필요", "warn")


def _express_entry_cutoff_snapshot(profile: dict) -> dict:
    records = rows(
        """
        select r.*, src.title as source_title, src.publisher
        from official_records r
        join sources src on src.source_id = r.source_id
        where r.policy_scope = 'federal'
          and coalesce(r.minimum_score, '') <> ''
        """
    )
    records = sorted(records, key=_record_sort_key, reverse=True)
    interest = str(profile.get("ee_category_interest") or "").strip().lower()
    category_known = bool(interest) and interest not in {"not sure", "unknown", "미정", "없음"}

    def _matches(record: dict, keywords: list[str]) -> bool:
        stage = str(record.get("stage") or "").lower()
        title = str(record.get("title") or "").lower()
        return any(keyword in f"{stage} {title}" for keyword in keywords)

    if not category_known:
        scored_records = [record for record in records if _to_int(record.get("minimum_score")) is not None]
        non_pnp_records = [record for record in scored_records if not _matches(record, ["provincial nominee program", "pnp"])]
        benchmark_pool = (non_pnp_records or scored_records)[:12]
        conservative = max(benchmark_pool, key=lambda record: _to_int(record.get("minimum_score")) or 0) if benchmark_pool else None
        return {
            "benchmark_label": "보수 기준",
            "category_known": False,
            "record": conservative,
            "latest_cutoff": _to_int(conservative.get("minimum_score")) if conservative else None,
        }

    benchmarks: list[tuple[str, list[str]]] = []
    if interest in {"french", "francophone"}:
        benchmarks = [("French-language", ["french-language", "french language"])]
    elif interest in {"cec", "canadian experience class"}:
        benchmarks = [("Canadian Experience Class", ["canadian experience class"])]
    elif interest in {"pnp", "provincial nominee", "provincial nominee program"}:
        benchmarks = [("Provincial Nominee Program", ["provincial nominee program"])]
    elif interest in {"trades", "trade", "federal skilled trades", "fst"}:
        benchmarks = [("Trade occupations", ["trade occupations", "federal skilled trades"])]
    elif interest in {"healthcare", "health care", "healthcare and social services"}:
        benchmarks = [("Healthcare", ["healthcare", "health care"])]
    else:
        benchmarks = [("All-program", ["no program specified", "general"])]

    for benchmark_label, keywords in benchmarks:
        for record in records:
            if _matches(record, keywords):
                return {
                    "benchmark_label": benchmark_label,
                    "category_known": category_known,
                    "record": record,
                    "latest_cutoff": _to_int(record.get("minimum_score")),
                }

    fallback = records[0] if records else None
    return {
        "benchmark_label": "Latest draw",
        "category_known": category_known,
        "record": fallback,
        "latest_cutoff": _to_int(fallback.get("minimum_score")) if fallback else None,
    }


def _express_entry_readiness_label(category_known: bool, cutoff_gap: int | None) -> tuple[str, str]:
    if cutoff_gap is None:
        return ("카테고리 확인 필요" if not category_known else "보강 필요", "warn")
    if cutoff_gap <= -150:
        return ("장기 보강", "warn")
    if cutoff_gap <= -40:
        return ("카테고리 확인 필요" if not category_known else "보강 필요", "warn")
    if cutoff_gap < 0:
        return ("카테고리 확인 필요" if not category_known else "관찰 필요", "warn")
    if cutoff_gap < 25:
        return ("경쟁 가능", "good")
    return ("컷오프 상회", "good")


def _profile_score_drivers(profile: dict) -> list[str]:
    drivers = []
    first_language_summary = _first_official_language_summary(profile)
    if first_language_summary:
        drivers.append(f"영어 CLB {first_language_summary}")
    age_details = _profile_age_details(profile)
    if age_details["age"] is not None:
        drivers.append(f"만 나이 {age_details['age']}세")
    if profile.get("work_experience_years"):
        drivers.append(f"해외 경력 {profile['work_experience_years']}년")
    if profile.get("canadian_experience_years"):
        drivers.append(f"캐나다 경력 {profile['canadian_experience_years']}년")
    if profile.get("noc_teer"):
        drivers.append(f"TEER {profile['noc_teer']}")
    if profile.get("education_level"):
        drivers.append(f"학력: {profile['education_level']}")
    if profile.get("ee_category_interest"):
        drivers.append(f"EE 카테고리: {profile['ee_category_interest']}")
    if profile.get("bc_pnp_stream_interest"):
        drivers.append(f"BC PNP 스트림: {profile['bc_pnp_stream_interest']}")
    if profile.get("employer_support"):
        drivers.append("고용주 지원 있음")
    if profile.get("bc_connection_type"):
        drivers.append(f"BC 연결: {profile['bc_connection_type']}")
    return drivers or ["프로필 입력 대기"]


def _profile_next_milestone(profile: dict, route: str, missing_requirements: list[dict]) -> str:
    if missing_requirements:
        return f"{missing_requirements[0]['title']} 입력 후 {route} 비교 열기"
    return f"최신 공식 신호와 {route}를 다시 비교"


def _profile_next_action(profile: dict, route: str, profile_complete: bool, missing_requirements: list[dict]) -> str:
    if not profile_complete:
        title = missing_requirements[0]["title"] if missing_requirements else "필수 프로필"
        return f"{title}까지 완료하면 개인화 {route} 비교가 열립니다."
    if _occupation_status(profile) != "직업군 확인됨" or _ee_category_status(profile) != "카테고리 확인됨":
        return "직업군과 EE 카테고리를 먼저 고른 뒤, 생년월일을 확인하고 전체 경로를 재진단하세요."
    if _profile_age_details(profile)["age_basis"] == "legacy age fallback":
        return "생년월일을 확인해 CRS 계산을 고정하고, 최신 EE 컷오프 거리와 BC PNP 조건 정합도를 다시 비교하세요."
    return f"{route}를 최신 공식 신호와 대조하고, BC PNP 조건 정합도와 EE 컷오프 거리를 함께 비교하세요."


def _profile_score_potential(profile: dict, route: str, score: int, profile_complete: bool) -> str:
    if not profile_complete:
        return "프로필 완료 전까지 잠금"
    if route == "BC PNP" and _occupation_status(profile) != "직업군 확인됨":
        return "직업군을 구체화한 뒤 BC PNP 조건 정합도를 다시 계산합니다."
    if route == "Express Entry":
        snapshot = _express_entry_cutoff_snapshot(profile)
        latest_cutoff = snapshot.get("latest_cutoff")
        cutoff_gap = None
        if latest_cutoff is not None:
            cutoff_gap = _compute_auto_crs(profile)["score"] - latest_cutoff
        if cutoff_gap is None:
            return "최신 컷오프를 확인한 뒤 경쟁력을 다시 계산합니다."
        if cutoff_gap >= 0:
            return f"현재 기준 컷오프보다 {cutoff_gap}점 높습니다."
        return f"현재 기준 컷오프까지 {abs(cutoff_gap)}점 보강이 필요합니다."
    gap = max(0, 100 - score)
    if gap == 0:
        return "현재 휴리스틱 범위의 상단에 가깝습니다."
    return f"약한 입력을 보강하면 {route} 적합도 +{gap}까지 여지가 있습니다."


def _profile_position_explanation(profile: dict, profile_complete: bool, strongest_route: str, route_profile: dict, computed_scores: dict) -> str:
    if profile_complete:
        auto_score = computed_scores["crs"]["score"] or "N/A"
        bc_fit = computed_scores["bc_pnp"]["fit_score"] or route_profile["score"]
        pnp_range = computed_scores["bc_pnp"]["estimated_registration_range"] or [bc_fit, bc_fit]
        occupation = profile.get("bc_occupation_focus") or "미선택"
        teer = profile.get("noc_teer") or "미선택"
        ee_category = profile.get("ee_category_interest") or "미선택"
        ee_profile = computed_scores.get("express_entry") or {}
        latest_cutoff = ee_profile.get("latest_cutoff")
        cutoff_gap = ee_profile.get("cutoff_gap")
        readiness = ee_profile.get("readiness_label") or route_profile.get("fit_label") or "보강 필요"
        return (
            f"자동 CRS {auto_score}점{f', 최신 EE 컷오프 {latest_cutoff}점 대비 {cutoff_gap:+}점' if isinstance(cutoff_gap, int) and latest_cutoff is not None else ''}, "
            f"BC PNP 조건 정합도 {bc_fit} (추정 등록 점수대 {pnp_range[0]}-{pnp_range[1]}점), 직업군 {occupation}, TEER {teer}, "
            f"EE 카테고리 {ee_category}를 기준으로 EE는 {readiness} 상태로, BC PNP는 조건 정합도로 해석합니다."
            f"{' 직업군과 카테고리 선택 후 재진단이 필요합니다.' if _occupation_status(profile) != '직업군 확인됨' or _ee_category_status(profile) != '카테고리 확인됨' else ''}"
        )
    return "공식 브리핑은 볼 수 있지만, CRS/PNP 비교와 개인 영향은 프로필 완료 후 잠금 해제됩니다."


def _clean_text(value: object) -> str:
    return str(value or "").strip()


def _to_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _to_optional_bool(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    cleaned = str(value).strip().lower()
    if not cleaned:
        return None
    if cleaned in {"1", "true", "yes", "on", "y", "있음", "예", "완료"}:
        return True
    if cleaned in {"0", "false", "no", "off", "n", "없음", "아니오", "대기"}:
        return False
    return None


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _trend_group_key(record: dict) -> str:
    category = record.get("record_category") or record.get("record_type") or "unknown"
    scope = record.get("policy_scope") or "unknown"
    program = record.get("program") or record.get("source_id") or "미분류"
    stage = record.get("stage") or ""
    if category == "processing_time":
        return f"{scope}|{program}|{stage}"
    if category == "draw":
        return f"{scope}|{program}"
    return f"{scope}|{category}|{program}|{stage}"


def _trend_label(record: dict, fallback: str) -> str:
    category = record.get("record_category") or record.get("record_type") or "unknown"
    program = record.get("program") or record.get("source_id") or "미분류"
    stage = record.get("stage") or ""
    if category == "processing_time":
        stage_tail = stage.split(" · ", 1)[-1] if " · " in stage else stage
        return f"{program} · {stage_tail}".strip(" ·")
    if category == "draw":
        return program
    return record.get("title") or fallback


def _trend_metric_name(record: dict) -> str:
    category = record.get("record_category") or record.get("record_type") or "unknown"
    if category == "processing_time":
        return "processing_time"
    if record.get("minimum_score"):
        return "minimum_score"
    if record.get("invitations"):
        return "invitations"
    return "value"


def _trend_metric_unit(record: dict) -> str:
    category = record.get("record_category") or record.get("record_type") or "unknown"
    if category == "processing_time":
        return record.get("metric_unit") or "time"
    if record.get("minimum_score"):
        return "points"
    if record.get("invitations"):
        return "count"
    return ""


def _express_entry_round_payload(record: dict) -> dict:
    return {
        "title": record.get("title"),
        "event_date": record.get("event_date"),
        "program": record.get("program"),
        "stage": record.get("stage"),
        "minimum_score": record.get("minimum_score") or None,
        "invitations": record.get("invitations") or None,
        "record_type": record.get("record_type"),
        "source_id": record.get("source_id"),
        "source_title": record.get("source_title"),
        "publisher": record.get("publisher"),
        "source_url": record.get("source_url"),
        "data_basis_at": record.get("data_basis_at"),
        "observed_at": record.get("observed_at"),
    }


def _bc_pnp_draw_payload(record: dict) -> dict:
    return {
        "title": record.get("title"),
        "event_date": record.get("event_date"),
        "program": record.get("program"),
        "stage": record.get("stage"),
        "minimum_score": record.get("minimum_score") or None,
        "invitations": record.get("invitations") or None,
        "record_type": record.get("record_type"),
        "source_id": record.get("source_id"),
        "source_title": record.get("source_title"),
        "publisher": record.get("publisher"),
        "source_url": record.get("source_url"),
        "data_basis_at": record.get("data_basis_at"),
        "observed_at": record.get("observed_at"),
    }


def _processing_time_payload(record: dict) -> dict:
    return {
        "title": record.get("title"),
        "event_date": record.get("event_date"),
        "program": record.get("program"),
        "stage": record.get("stage"),
        "processing_time": record.get("processing_time") or None,
        "record_type": record.get("record_type"),
        "source_id": record.get("source_id"),
        "source_title": record.get("source_title"),
        "publisher": record.get("publisher"),
        "source_url": record.get("source_url"),
        "data_basis_at": record.get("data_basis_at"),
        "observed_at": record.get("observed_at"),
    }


def _policy_change_payload(change: dict) -> dict:
    return {
        "change_id": change.get("change_id"),
        "title": change.get("title"),
        "summary_ko": change.get("summary_ko"),
        "reasoning_ko": change.get("reasoning_ko"),
        "change_type": change.get("change_type"),
        "impact_level": change.get("impact_level"),
        "needs_review": change.get("needs_review"),
        "detected_at": change.get("detected_at"),
        "source_id": change.get("source_id"),
        "source_title": change.get("source_title"),
        "publisher": change.get("publisher"),
        "source_url": change.get("source_url"),
    }


def _summarize_processing_time_sources(records: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for record in records:
        grouped.setdefault(record.get("source_id") or "unknown", []).append(record)

    summary = []
    for source_id, items in grouped.items():
        items = sorted(items, key=_record_sort_key, reverse=True)
        latest = items[0]
        summary.append(
            {
                "source_id": source_id,
                "title": latest.get("source_title") or latest.get("title"),
                "publisher": latest.get("publisher"),
                "count": len(items),
                "latest_event_date": latest.get("event_date"),
                "latest_record": _processing_time_payload(latest),
            }
        )
    summary.sort(key=_express_entry_source_sort_key, reverse=True)
    return summary


def _summarize_policy_sources(changes: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for change in changes:
        grouped.setdefault(change.get("source_id") or "unknown", []).append(change)

    summary = []
    for source_id, items in grouped.items():
        items = sorted(items, key=_policy_change_sort_key, reverse=True)
        latest = items[0]
        summary.append(
            {
                "source_id": source_id,
                "title": latest.get("source_title") or latest.get("title"),
                "publisher": latest.get("publisher"),
                "count": len(items),
                "latest_detected_at": latest.get("detected_at"),
                "latest_change": _policy_change_payload(latest),
            }
        )
    summary.sort(key=_policy_source_sort_key, reverse=True)
    return summary


def _build_processing_overview_group(label: str, records: list[dict]) -> dict:
    return {
        "label": label,
        "record_count": len(records),
        "latest_records": [_processing_time_payload(record) for record in records[:4]],
        "source_summary": _summarize_processing_time_sources(records),
    }


def _build_policy_overview_group(label: str, changes: list[dict]) -> dict:
    return {
        "label": label,
        "change_count": len(changes),
        "latest_changes": [_policy_change_payload(change) for change in changes[:4]],
        "source_summary": _summarize_policy_sources(changes),
    }


def _build_status_overview_group(label: str, sources: list[dict], changes: list[dict], source_ids: list[str]) -> dict:
    group_sources = [source for source in sources if source.get("source_id") in source_ids]
    group_changes = [change for change in changes if change.get("source_id") in source_ids]
    source_summary = sorted(group_sources, key=lambda item: (_status_rank(item), item.get("title") or ""), reverse=False)
    latest_changes = sorted(group_changes, key=lambda item: _policy_change_sort_key(item), reverse=True)
    return {
        "label": label,
        "source_count": len(group_sources),
        "ok_count": sum(1 for item in group_sources if item.get("status") == "ok"),
        "error_count": sum(1 for item in group_sources if item.get("status") == "error"),
        "unknown_count": sum(1 for item in group_sources if item.get("status") == "unknown"),
        "source_summary": _status_source_summary(group_sources),
        "latest_changes": [_policy_change_payload(change) for change in latest_changes[:4]],
        "latest_signal": _status_latest_signal(group_sources, latest_changes),
    }


def _status_rank(item: dict) -> int:
    if item.get("status") == "error":
        return 0
    if item.get("status") == "unknown":
        return 1
    if item.get("changed") or (item.get("new_records") or 0) > 0 or item.get("last_changed_at"):
        return 2
    return 3


def _status_source_summary(sources: list[dict]) -> list[dict]:
    summary = []
    for source in sources:
        summary.append(
            {
                "source_id": source.get("source_id"),
                "title": source.get("title"),
                "publisher": source.get("publisher"),
                "status": source.get("status"),
                "checked_at": source.get("checked_at"),
                "changed": bool(source.get("changed")),
                "new_records": source.get("new_records") or 0,
                "error": source.get("error"),
            }
        )
    return summary


def _status_latest_signal(sources: list[dict], changes: list[dict]) -> dict | None:
    active_changes = [change for change in changes if change.get("needs_review")]
    if active_changes:
        latest = sorted(active_changes, key=_policy_change_sort_key, reverse=True)[0]
        return _policy_change_payload(latest)
    changed_sources = [source for source in sources if source.get("changed") or (source.get("new_records") or 0) > 0]
    if changed_sources:
        latest = sorted(changed_sources, key=lambda item: item.get("checked_at") or "", reverse=True)[0]
        return {
            "title": latest.get("title"),
            "summary_ko": f"{latest.get('title')}에 새 운영 신호가 있습니다.",
            "change_type": "program_status",
            "impact_level": "medium",
            "needs_review": 1,
            "reasoning_ko": f"{latest.get('title')} 소스의 최근 점검 결과를 기반으로 운영 상태 변화를 반영했습니다.",
            "detected_at": latest.get("checked_at"),
            "source_id": latest.get("source_id"),
            "source_title": latest.get("title"),
            "publisher": latest.get("publisher"),
            "source_url": "",
        }
    return None


def _summarize_bc_pnp_categories(records: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for record in records:
        key = _bc_pnp_category_key(record)
        grouped.setdefault(key, []).append(record)

    summary = []
    for key, items in grouped.items():
        items = sorted(items, key=_record_sort_key, reverse=True)
        latest = items[0]
        summary.append(
            {
                "label": _bc_pnp_category_label(key),
                "count": len(items),
                "latest_round": _bc_pnp_draw_payload(latest),
                "latest_score": latest.get("minimum_score") or None,
                "latest_invitations": latest.get("invitations") or None,
                "latest_event_date": latest.get("event_date"),
            }
        )
    summary.sort(key=_express_entry_summary_sort_key, reverse=True)
    return summary[:8]


def _summarize_draw_sources(records: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for record in records:
        grouped.setdefault(record.get("source_id") or "unknown", []).append(record)

    summary = []
    for source_id, items in grouped.items():
        items = sorted(items, key=_record_sort_key, reverse=True)
        latest = items[0]
        summary.append(
            {
                "source_id": source_id,
                "title": latest.get("source_title") or latest.get("title"),
                "publisher": latest.get("publisher"),
                "count": len(items),
                "latest_event_date": latest.get("event_date"),
                "latest_round": _bc_pnp_draw_payload(latest),
            }
        )
    summary.sort(key=_express_entry_source_sort_key, reverse=True)
    return summary


def _bc_pnp_category_key(record: dict) -> str:
    text = f"{record.get('title') or ''} {record.get('stage') or ''} {record.get('program') or ''}".lower()
    score_band = _bc_pnp_score_band_key(text)
    if score_band:
        return score_band
    if "health" in text:
        return "health"
    if "child" in text:
        return "childcare"
    if "construction" in text:
        return "construction"
    if "tech" in text:
        return "tech"
    if "trade" in text:
        return "trade"
    if "innovate" in text or "high economic impact" in text:
        return "high_economic_impact"
    if "entrepreneur" in text:
        return "entrepreneur"
    if "regional" in text:
        return "regional"
    if "eebc" in text or "express entry bc" in text:
        return "express_entry_bc"
    if "skills" in text:
        return "skills_immigration"
    if "base" in text:
        return "base"
    return "general"


def _bc_pnp_score_band_key(text: str) -> str | None:
    match = re.search(r"\b(\d{1,3})\s*-\s*(\d{1,3})\b", text)
    if not match:
        return None
    low, high = match.groups()
    return f"score_band_{low}_{high}"


def _bc_pnp_category_label(key: str) -> str:
    if key.startswith("score_band_"):
        return key.removeprefix("score_band_").replace("_", " - ")
    labels = {
        "health": "Health",
        "childcare": "Childcare",
        "construction": "Construction",
        "tech": "Tech",
        "trade": "Trade",
        "high_economic_impact": "High Economic Impact",
        "entrepreneur": "Entrepreneur",
        "regional": "Regional",
        "express_entry_bc": "Express Entry BC",
        "skills_immigration": "Skills Immigration",
        "base": "Base",
        "general": "General / Other",
    }
    return labels.get(key, key)


def _summarize_express_entry_categories(records: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for record in records:
        key = _express_entry_category_key(record)
        grouped.setdefault(key, []).append(record)

    summary = []
    for key, items in grouped.items():
        items = sorted(items, key=_record_sort_key, reverse=True)
        latest = items[0]
        summary.append(
            {
                "label": _express_entry_category_label(key),
                "count": len(items),
                "latest_round": _express_entry_round_payload(latest),
                "latest_score": latest.get("minimum_score") or None,
                "latest_invitations": latest.get("invitations") or None,
                "latest_event_date": latest.get("event_date"),
            }
        )
    summary.sort(key=_express_entry_summary_sort_key, reverse=True)
    return summary[:8]


def _summarize_express_entry_sources(records: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for record in records:
        grouped.setdefault(record.get("source_id") or "unknown", []).append(record)

    summary = []
    for source_id, items in grouped.items():
        items = sorted(items, key=_record_sort_key, reverse=True)
        latest = items[0]
        summary.append(
            {
                "source_id": source_id,
                "title": latest.get("source_title") or latest.get("title"),
                "publisher": latest.get("publisher"),
                "count": len(items),
                "latest_event_date": latest.get("event_date"),
                "latest_round": _express_entry_round_payload(latest),
            }
        )
    summary.sort(key=_express_entry_source_sort_key, reverse=True)
    return summary


def _express_entry_category_key(record: dict) -> str:
    stage = record.get("stage") or ""
    if "No Program Specified" in stage:
        return "all_program"
    if "Provincial Nominee Program" in stage:
        return "pnp"
    if "Canadian Experience Class" in stage:
        return "cec"
    if "french" in stage.lower():
        return "french"
    if "Federal Skilled Trades" in stage:
        return "fst"
    if "Federal Skilled Worker" in stage:
        return "fsw"
    if "Healthcare" in stage:
        return "healthcare"
    if "Agriculture and agri-food" in stage:
        return "agriculture"
    if "Education" in stage:
        return "education"
    if "Physicians" in stage:
        return "physicians"
    if "Senior managers" in stage:
        return "senior_managers"
    if "STEM" in stage:
        return "stem"
    if "Transport" in stage:
        return "transport"
    if "Trade" in stage:
        return "trades"
    return stage or "unknown"


def _express_entry_category_label(key: str) -> str:
    labels = {
        "all_program": "All-program draws",
        "pnp": "Provincial Nominee Program",
        "cec": "Canadian Experience Class",
        "french": "French-language draws",
        "fst": "Federal Skilled Trades",
        "fsw": "Federal Skilled Worker",
        "healthcare": "Healthcare occupations",
        "agriculture": "Agriculture and agri-food occupations",
        "education": "Education occupations",
        "physicians": "Physicians with Canadian Work Experience",
        "senior_managers": "Senior managers with Canadian Work Experience",
        "stem": "STEM occupations",
        "transport": "Transport occupations",
        "trades": "Trade occupations",
    }
    return labels.get(key, key)


def _express_entry_summary_sort_key(item: dict) -> tuple[int, str, str]:
    latest_date = item.get("latest_event_date") or ""
    try:
        parsed = datetime.strptime(latest_date, "%B %d, %Y").date().isoformat()
    except ValueError:
        parsed = ""
    return (int(item.get("count") or 0), parsed, item.get("label") or "")


def _express_entry_source_sort_key(item: dict) -> tuple[int, str, str]:
    latest_date = item.get("latest_event_date") or ""
    try:
        parsed = datetime.strptime(latest_date, "%B %d, %Y").date().isoformat()
    except ValueError:
        parsed = ""
    return (int(item.get("count") or 0), parsed, item.get("title") or "")


def _policy_change_sort_key(item: dict) -> tuple[str, str]:
    return (item.get("detected_at") or "", item.get("title") or "")


def _policy_source_sort_key(item: dict) -> tuple[int, str, str]:
    latest_detected = item.get("latest_detected_at") or ""
    return (int(item.get("count") or 0), latest_detected, item.get("title") or "")


def _build_insight_payload(records: list[dict], window_days: int, compare_days: int) -> dict:
    dated_records = [(record, _record_event_date(record)) for record in records]
    dated_records = [(record, date_value) for record, date_value in dated_records if date_value]
    if not dated_records:
        return {
            "window": {"recent_days": window_days, "compare_days": compare_days, "anchor_date": None},
            "sections": {
                "bc_pnp": _empty_insight_section("BC PNP"),
                "express_entry": _empty_insight_section("Express Entry"),
                "processing_time": _empty_processing_section(),
                "momentum": [],
            },
        }

    anchor_date = max(date_value for _, date_value in dated_records)
    recent_start = anchor_date - timedelta(days=window_days)
    previous_start = recent_start - timedelta(days=compare_days)

    recent_records = [record for record, date_value in dated_records if recent_start <= date_value <= anchor_date]
    previous_records = [record for record, date_value in dated_records if previous_start <= date_value < recent_start]

    bc_recent = [record for record in recent_records if record.get("record_category") == "draw" and record.get("policy_scope") == "bc_pnp"]
    bc_previous = [record for record in previous_records if record.get("record_category") == "draw" and record.get("policy_scope") == "bc_pnp"]
    ee_recent = [record for record in recent_records if record.get("record_category") == "draw" and record.get("policy_scope") == "federal"]
    ee_previous = [record for record in previous_records if record.get("record_category") == "draw" and record.get("policy_scope") == "federal"]

    bc_categories = _category_momentum(bc_recent, bc_previous, _bc_pnp_category_key, _bc_pnp_category_label)
    ee_categories = _category_momentum(ee_recent, ee_previous, _express_entry_category_key, _express_entry_category_label)
    processing = _processing_time_momentum(recent_records, previous_records)

    momentum = []
    for item in bc_categories[:3]:
        momentum.append({**item, "program": "BC PNP"})
    for item in ee_categories[:3]:
        momentum.append({**item, "program": "Express Entry"})
    momentum.sort(key=lambda item: (item.get("momentum", 0), item.get("count_delta", 0), item.get("label") or ""), reverse=True)

    return {
        "window": {
            "recent_days": window_days,
            "compare_days": compare_days,
            "anchor_date": anchor_date.isoformat(),
            "recent_start": recent_start.isoformat(),
            "previous_start": previous_start.isoformat(),
        },
        "sections": {
            "bc_pnp": _program_insight_section("BC PNP", bc_recent, bc_previous, bc_categories),
            "express_entry": _program_insight_section("Express Entry", ee_recent, ee_previous, ee_categories),
            "processing_time": processing,
            "momentum": momentum[:6],
        },
    }


def _empty_insight_section(label: str) -> dict:
    return {
        "label": label,
        "recent_count": 0,
        "previous_count": 0,
        "count_delta": 0,
        "avg_score_recent": None,
        "avg_score_previous": None,
        "score_delta": None,
        "avg_invitations_recent": None,
        "avg_invitations_previous": None,
        "invitation_delta": None,
        "direction": "steady",
        "rising_categories": [],
        "falling_categories": [],
    }


def _empty_processing_section() -> dict:
    return {
        "bc_pnp": {"label": "BC PNP", "recent_avg_days": None, "previous_avg_days": None, "delta_days": None, "direction": "steady"},
        "ircc": {"label": "IRCC", "recent_avg_days": None, "previous_avg_days": None, "delta_days": None, "direction": "steady"},
    }


def _program_insight_section(label: str, recent_records: list[dict], previous_records: list[dict], categories: list[dict]) -> dict:
    recent_scores = [_numeric_value(record.get("minimum_score")) for record in recent_records]
    previous_scores = [_numeric_value(record.get("minimum_score")) for record in previous_records]
    recent_invitations = [_numeric_value(record.get("invitations")) for record in recent_records]
    previous_invitations = [_numeric_value(record.get("invitations")) for record in previous_records]
    avg_score_recent = _average(recent_scores)
    avg_score_previous = _average(previous_scores)
    avg_invitations_recent = _average(recent_invitations)
    avg_invitations_previous = _average(previous_invitations)
    score_delta = _delta(avg_score_recent, avg_score_previous)
    invitation_delta = _delta(avg_invitations_recent, avg_invitations_previous)
    count_delta = len(recent_records) - len(previous_records)
    direction = _trend_direction(score_delta, invitation_delta)
    return {
        "label": label,
        "recent_count": len(recent_records),
        "previous_count": len(previous_records),
        "count_delta": count_delta,
        "avg_score_recent": avg_score_recent,
        "avg_score_previous": avg_score_previous,
        "score_delta": score_delta,
        "avg_invitations_recent": avg_invitations_recent,
        "avg_invitations_previous": avg_invitations_previous,
        "invitation_delta": invitation_delta,
        "direction": direction,
        "rising_categories": [item for item in categories if (item.get("momentum") or 0) > 0][:4],
        "falling_categories": [item for item in categories if (item.get("momentum") or 0) < 0][:4],
    }


def _processing_time_momentum(recent_records: list[dict], previous_records: list[dict]) -> dict:
    bc_recent = [_processing_days(record.get("processing_time")) for record in recent_records if record.get("policy_scope") == "bc_pnp" and record.get("record_category") == "processing_time"]
    bc_previous = [_processing_days(record.get("processing_time")) for record in previous_records if record.get("policy_scope") == "bc_pnp" and record.get("record_category") == "processing_time"]
    ircc_recent = [_processing_days(record.get("processing_time")) for record in recent_records if record.get("source_id") == "ircc_processing_times" and record.get("record_category") == "processing_time"]
    ircc_previous = [_processing_days(record.get("processing_time")) for record in previous_records if record.get("source_id") == "ircc_processing_times" and record.get("record_category") == "processing_time"]
    return {
        "bc_pnp": _processing_section("BC PNP", bc_recent, bc_previous),
        "ircc": _processing_section("IRCC", ircc_recent, ircc_previous),
    }


def _processing_section(label: str, recent_values: list[float | None], previous_values: list[float | None]) -> dict:
    recent = _average([value for value in recent_values if value is not None])
    previous = _average([value for value in previous_values if value is not None])
    delta = _delta(recent, previous)
    return {
        "label": label,
        "recent_avg_days": recent,
        "previous_avg_days": previous,
        "delta_days": delta,
        "direction": _trend_direction(delta, None, reverse=True),
    }


def _category_momentum(recent_records: list[dict], previous_records: list[dict], key_fn, label_fn) -> list[dict]:
    recent_grouped = _group_by_key(recent_records, key_fn)
    previous_grouped = _group_by_key(previous_records, key_fn)
    keys = set(recent_grouped) | set(previous_grouped)
    summary = []
    for key in keys:
        recent_items = recent_grouped.get(key, [])
        previous_items = previous_grouped.get(key, [])
        recent_scores = [_numeric_value(item.get("minimum_score")) for item in recent_items]
        previous_scores = [_numeric_value(item.get("minimum_score")) for item in previous_items]
        recent_invites = [_numeric_value(item.get("invitations")) for item in recent_items]
        previous_invites = [_numeric_value(item.get("invitations")) for item in previous_items]
        latest = sorted(recent_items or previous_items, key=_record_sort_key, reverse=True)[0]
        count_delta = len(recent_items) - len(previous_items)
        score_delta = _delta(_average(recent_scores), _average(previous_scores))
        invitation_delta = _delta(_average(recent_invites), _average(previous_invites))
        summary.append(
            {
                "key": key,
                "label": label_fn(key),
                "count_recent": len(recent_items),
                "count_previous": len(previous_items),
                "count_delta": count_delta,
                "score_delta": score_delta,
                "invitation_delta": invitation_delta,
                "momentum": (count_delta * 3) + (-(score_delta or 0)) + (invitation_delta or 0),
                "latest_event_date": latest.get("event_date"),
                "latest_score": latest.get("minimum_score") or None,
                "latest_invitations": latest.get("invitations") or None,
            }
        )
    summary.sort(key=lambda item: (item.get("momentum", 0), item.get("count_delta", 0), item.get("label") or ""), reverse=True)
    return summary


def _group_by_key(records: list[dict], key_fn) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for record in records:
        key = key_fn(record)
        grouped.setdefault(key, []).append(record)
    return grouped


def _record_event_date(record: dict) -> date | None:
    for candidate in (record.get("event_date"), record.get("observed_at"), record.get("data_basis_at")):
        parsed = _parse_date_value(candidate)
        if parsed:
            return parsed
    return None


def _parse_date_value(value: object) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%B %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _numeric_value(value: object) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() == "n/a":
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _processing_days(value: object) -> float | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text or text == "n/a":
        return None
    match = re.search(r"\d+(?:\.\d+)?", text)
    if not match:
        return None
    number = float(match.group(0))
    if "week" in text:
        return number * 7
    if "month" in text:
        return number * 30
    return number


def _average(values: list[float | None]) -> float | None:
    cleaned = [value for value in values if value is not None]
    if not cleaned:
        return None
    return round(sum(cleaned) / len(cleaned), 1)


def _delta(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return round(current - previous, 1)


def _trend_direction(score_delta: float | None, invitation_delta: float | None, *, reverse: bool = False) -> str:
    if score_delta is None and invitation_delta is None:
        return "steady"
    if reverse:
        if score_delta is not None and score_delta < 0:
            return "improving"
        if score_delta is not None and score_delta > 0:
            return "weakening"
        return "steady"
    if score_delta is not None and score_delta < 0:
        return "improving"
    if score_delta is not None and score_delta > 0:
        return "weakening"
    if invitation_delta is not None and invitation_delta > 0:
        return "improving"
    if invitation_delta is not None and invitation_delta < 0:
        return "weakening"
    return "steady"


@app.get("/api/summary")
def api_summary() -> dict:
    source_count = rows("select count(*) as count from sources where active = 1")[0]["count"]
    change_count = rows("select count(*) as count from changes where coalesce(hidden, 0) = 0 and coalesce(environment, 'production') = 'production'")[0]["count"]
    record_count = rows("select count(*) as count from official_records")[0]["count"]
    structured_record_count = rows(
        """
        select count(*) as count
        from official_records
        where coalesce(record_category, '') <> ''
          and coalesce(policy_scope, '') <> ''
          and coalesce(stage, '') <> ''
          and coalesce(metric_name, '') <> ''
          and coalesce(metric_value, '') <> ''
          and coalesce(metric_unit, '') <> ''
        """
    )[0]["count"]
    unstructured_record_count = max(0, record_count - structured_record_count)
    quality_score = round((structured_record_count / record_count) * 100) if record_count else 0
    needs_review_count = rows("select count(*) as count from changes where needs_review = 1 and coalesce(hidden, 0) = 0 and coalesce(environment, 'production') = 'production'")[0]["count"]
    latest_snapshot = rows("select max(fetched_at) as fetched_at from snapshots")[0]["fetched_at"]
    latest_change = rows(
        """
        select c.*, src.title, src.publisher, src.url
        from changes c
        join sources src on src.source_id = c.source_id
        where coalesce(c.hidden, 0) = 0 and coalesce(c.environment, 'production') = 'production'
        order by detected_at desc
        limit 1
        """
    )
    latest_record = rows(
        """
        select r.*, src.publisher
        from official_records r
        join sources src on src.source_id = r.source_id
        order by observed_at desc, event_date desc
        limit 1
        """
    )
    return {
        "source_count": source_count,
        "change_count": change_count,
        "record_count": record_count,
        "structured_record_count": structured_record_count,
        "unstructured_record_count": unstructured_record_count,
        "quality_score": quality_score,
        "needs_review_count": needs_review_count,
        "latest_snapshot": latest_snapshot,
        "latest_change": latest_change[0] if latest_change else None,
        "latest_record": latest_record[0] if latest_record else None,
    }


@app.post("/api/check-sources")
def api_check_sources(notify: bool = True, baseline: bool = False, environment: str = "production") -> dict:
    results = check_all_sources(baseline=baseline, environment=environment)
    notified = notify_results(results) if notify and not baseline else False
    return {
        "notified": notified,
        "baseline": baseline,
        "environment": environment,
        "results": results,
    }
