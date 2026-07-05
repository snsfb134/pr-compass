import hashlib
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

from app.config import SNAPSHOT_DIR
from app.core.analysis import summarize_change
from app.core.db import connect, row, write_text
from app.core.diff_engine import diff_excerpt
from app.core.extractor import extract_main_text
from app.core.records import extract_official_records
from app.core.sources import list_sources

TZ = ZoneInfo("America/Vancouver")


def now_iso() -> str:
    return datetime.now(TZ).isoformat(timespec="seconds")


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def fetch_source(source: dict, *, baseline: bool = False, environment: str = "production") -> dict:
    started = time.perf_counter()
    fetched_at = now_iso()
    response = requests.get(
        source["url"],
        headers={
            "User-Agent": "Mozilla/5.0 PRPathwayMonitor/0.1 local research tool",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-CA,en;q=0.9",
        },
        timeout=(8, 15),
    )
    response.raise_for_status()
    html = response.text
    text = extract_main_text(html)
    content_hash = sha256(text)
    snapshot_id = f"{fetched_at[:10].replace('-', '')}-{uuid.uuid4().hex[:10]}"
    snapshot_path = SNAPSHOT_DIR / source["source_id"] / f"{snapshot_id}.txt"
    write_text(snapshot_path, text)

    previous_hash = source.get("last_hash")
    previous_text = ""
    if previous_hash:
        previous = row(
            "select snapshot_path from snapshots where source_id = ? and content_hash = ? order by fetched_at desc limit 1",
            (source["source_id"], previous_hash),
        )
        if previous:
            previous_snapshot_path = Path(previous["snapshot_path"])
            if previous_snapshot_path.exists():
                previous_text = previous_snapshot_path.read_text(encoding="utf-8")

    with connect() as conn:
        conn.execute(
            """
            insert into snapshots (snapshot_id, source_id, fetched_at, content_hash, snapshot_path, text_length)
            values (?, ?, ?, ?, ?, ?)
            """,
            (snapshot_id, source["source_id"], fetched_at, content_hash, str(snapshot_path), len(text)),
        )
        conn.execute(
            "update sources set last_checked_at = ?, last_hash = ? where source_id = ?",
            (fetched_at, content_hash, source["source_id"]),
        )

    new_records = save_new_official_records(
        source,
        html,
        fetched_at,
        content_hash,
        previous_hash,
        create_changes=not baseline,
        environment=environment,
    )
    changed = bool(previous_hash and previous_hash != content_hash)
    first_snapshot = not previous_hash
    change = None
    if changed and not baseline:
        diff_text = diff_excerpt(previous_text, text)
        analysis = summarize_change(source, diff_text)
        change_id = f"{fetched_at[:10].replace('-', '')}-{uuid.uuid4().hex[:10]}"
        with connect() as conn:
            conn.execute(
                """
                insert into changes (
                  change_id, source_id, detected_at, old_hash, new_hash, change_type,
                  summary_ko, reasoning_ko, confidence, needs_review, diff_excerpt,
                  program_tags, impact_level, evidence_url, data_basis_at,
                  environment, hidden, created_by
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    change_id,
                    source["source_id"],
                    fetched_at,
                    previous_hash,
                    content_hash,
                    analysis.get("change_type", "unknown"),
                    analysis.get("summary_ko", ""),
                    analysis.get("reasoning_ko", ""),
                    analysis.get("confidence", "low"),
                    1 if analysis.get("needs_review", True) else 0,
                    diff_text,
                    json.dumps(source.get("program_tags", []), ensure_ascii=False),
                    infer_impact_level(analysis.get("change_type", "unknown"), source["source_id"]),
                    source["url"],
                    fetched_at,
                    environment,
                    0,
                    "monitor",
                ),
            )
            conn.execute(
                "update sources set last_changed_at = ? where source_id = ?",
                (fetched_at, source["source_id"]),
            )
        change = {"change_id": change_id, **analysis}

    result = {
        "source_id": source["source_id"],
        "title": source["title"],
        "url": source["url"],
        "fetched_at": fetched_at,
        "duration_ms": round((time.perf_counter() - started) * 1000),
        "hash": content_hash,
        "changed": changed,
        "first_snapshot": first_snapshot,
        "change": change,
        "new_records": new_records,
        "baseline": baseline,
        "environment": environment,
    }
    record_source_check(source["source_id"], result, status="ok")
    return result


def save_new_official_records(
    source: dict,
    html: str,
    fetched_at: str,
    content_hash: str,
    previous_hash: str | None,
    *,
    create_changes: bool = True,
    environment: str = "production",
) -> int:
    records = extract_official_records(source, html, fetched_at)
    inserted = 0
    for record_data in records:
        with connect() as conn:
            existing_record = conn.execute(
                "select record_id from official_records where record_id = ?",
                (record_data["record_id"],),
            ).fetchone()
            result = conn.execute(
                """
                insert into official_records (
                  record_id, source_id, record_type, record_category, policy_scope, stage,
                  metric_name, metric_value, metric_unit, event_date, title, program,
                  minimum_score, invitations, processing_time, raw_text, source_url,
                  observed_at, data_basis_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(record_id) do update set
                  record_category = excluded.record_category,
                  policy_scope = excluded.policy_scope,
                  stage = excluded.stage,
                  metric_name = excluded.metric_name,
                  metric_value = excluded.metric_value,
                  metric_unit = excluded.metric_unit,
                  title = excluded.title,
                  program = excluded.program,
                  minimum_score = excluded.minimum_score,
                  invitations = excluded.invitations,
                  processing_time = excluded.processing_time,
                  raw_text = excluded.raw_text,
                  source_url = excluded.source_url,
                  observed_at = excluded.observed_at,
                  data_basis_at = excluded.data_basis_at
                """,
                (
                    record_data["record_id"],
                    record_data["source_id"],
                    record_data["record_type"],
                    record_data.get("record_category", ""),
                    record_data.get("policy_scope", ""),
                    record_data.get("stage", ""),
                    record_data.get("metric_name", ""),
                    record_data.get("metric_value", ""),
                    record_data.get("metric_unit", ""),
                    record_data["event_date"],
                    record_data["title"],
                    record_data["program"],
                    record_data["minimum_score"],
                    record_data["invitations"],
                    record_data.get("processing_time", ""),
                    record_data["raw_text"],
                    record_data["source_url"],
                    record_data["observed_at"],
                    record_data["data_basis_at"],
                ),
            )
            was_inserted = existing_record is None and result.rowcount == 1
        if was_inserted:
            inserted += 1
            if previous_hash and create_changes:
                save_record_change(source, record_data, fetched_at, content_hash, previous_hash, environment=environment)
    return inserted


def save_record_change(
    source: dict,
    record_data: dict,
    fetched_at: str,
    content_hash: str,
    previous_hash: str,
    *,
    environment: str = "production",
) -> None:
    existing = row(
        "select change_id from changes where source_id = ? and change_type = ? and diff_excerpt = ? limit 1",
        (source["source_id"], record_data["record_type"], record_data["raw_text"]),
    )
    if existing:
        return

    change_id = f"{fetched_at[:10].replace('-', '')}-{uuid.uuid4().hex[:10]}"
    summary = (
        f"새 공식 기록이 감지됐습니다: {record_data['title']}. "
        f"프로그램: {record_data.get('program') or '미분류'}"
    )
    details = []
    if record_data.get("minimum_score"):
        details.append(f"최소 점수: {record_data['minimum_score']}")
    if record_data.get("invitations"):
        details.append(f"초청 수: {record_data['invitations']}")
    if record_data.get("processing_time"):
        details.append(f"처리기간: {record_data['processing_time']}")
    if details:
        summary += " (" + ", ".join(details) + ")"

    with connect() as conn:
        conn.execute(
            """
            insert into changes (
              change_id, source_id, detected_at, old_hash, new_hash, change_type,
              summary_ko, reasoning_ko, confidence, needs_review, diff_excerpt,
              program_tags, impact_level, evidence_url, data_basis_at,
              environment, hidden, created_by
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                change_id,
                source["source_id"],
                fetched_at,
                previous_hash,
                content_hash,
                "processing_time" if record_data.get("record_type") == "processing_time" else "draw",
                summary,
                "",
                "high",
                1,
                record_data["raw_text"],
                json.dumps(source.get("program_tags", []), ensure_ascii=False),
                "high",
                source["url"],
                fetched_at,
                environment,
                0,
                "record_extractor",
            ),
        )
        conn.execute(
            "update sources set last_changed_at = ? where source_id = ?",
            (fetched_at, source["source_id"]),
        )


def infer_impact_level(change_type: str, source_id: str | None = None) -> str:
    if source_id in {"ircc_express_entry_reforms_consultation", "ircc_program_delivery_updates"}:
        if change_type in {"wording", "unknown"}:
            return "medium"
    if change_type in {"draw", "eligibility", "program_status", "occupation_priority", "allocation", "processing_time"}:
        return "high"
    if change_type == "wording":
        return "low"
    return "medium"


def record_source_check(source_id: str, result: dict, *, status: str, error: str | None = None) -> None:
    checked_at = result.get("fetched_at") or now_iso()
    check_id = f"{checked_at[:10].replace('-', '')}-{uuid.uuid4().hex[:10]}"
    with connect() as conn:
        conn.execute(
            """
            insert into source_checks (
              check_id, source_id, checked_at, status, duration_ms, changed,
              new_records, error, environment, baseline
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                check_id,
                source_id,
                checked_at,
                status,
                int(result.get("duration_ms") or 0),
                1 if result.get("changed") else 0,
                int(result.get("new_records") or 0),
                error,
                result.get("environment", "production"),
                1 if result.get("baseline") else 0,
            ),
        )


def check_all_sources(*, baseline: bool = False, environment: str = "production") -> list[dict]:
    started_by_source = {}
    results = []
    sources = [source for source in list_sources() if source.get("active", 1)]
    with ThreadPoolExecutor(max_workers=min(4, len(sources) or 1)) as executor:
        futures = {}
        for source in sources:
            started_by_source[source["source_id"]] = time.perf_counter()
            futures[executor.submit(fetch_source, source, baseline=baseline, environment=environment)] = source
        for future in as_completed(futures):
            source = futures[future]
            try:
                results.append(future.result())
            except Exception as exc:
                result = {
                    "source_id": source["source_id"],
                    "title": source["title"],
                    "url": source["url"],
                    "fetched_at": now_iso(),
                    "duration_ms": round((time.perf_counter() - started_by_source[source["source_id"]]) * 1000),
                    "changed": False,
                    "first_snapshot": False,
                    "new_records": 0,
                    "baseline": baseline,
                    "environment": environment,
                    "error": str(exc),
                }
                record_source_check(source["source_id"], result, status="error", error=str(exc))
                results.append(result)
    results.sort(key=lambda item: item["source_id"])
    if not baseline and environment == "production" and any(item.get("changed") or item.get("new_records", 0) for item in results):
        try:
            from app.core.briefings import create_briefing_run

            briefing = create_briefing_run(trigger_type="source_check", provider="heuristic")
            for item in results:
                item["briefing_run_id"] = briefing["run_id"]
        except Exception as exc:
            for item in results:
                item["briefing_error"] = str(exc)
    return results
