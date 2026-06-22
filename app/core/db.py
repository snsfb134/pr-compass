import sqlite3
from pathlib import Path
from typing import Any

from app.config import DATA_DIR, DB_PATH, REPORT_DIR, SNAPSHOT_DIR


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            create table if not exists sources (
              source_id text primary key,
              title text not null,
              url text not null,
              publisher text not null,
              source_type text not null,
              program_tags text not null,
              check_frequency text not null,
              active integer not null default 1,
              last_checked_at text,
              last_changed_at text,
              last_hash text
            );

            create table if not exists snapshots (
              snapshot_id text primary key,
              source_id text not null,
              fetched_at text not null,
              content_hash text not null,
              snapshot_path text not null,
              text_length integer not null,
              foreign key(source_id) references sources(source_id)
            );

            create table if not exists changes (
              change_id text primary key,
              source_id text not null,
              detected_at text not null,
              old_hash text,
              new_hash text not null,
              change_type text not null,
              summary_ko text not null,
              reasoning_ko text,
              confidence text not null,
              needs_review integer not null,
              diff_excerpt text not null,
              report_path text,
              foreign key(source_id) references sources(source_id)
            );

            create table if not exists official_records (
              record_id text primary key,
              source_id text not null,
              record_type text not null,
              record_category text,
              policy_scope text,
              stage text,
              metric_name text,
              metric_value text,
              metric_unit text,
              event_date text,
              title text not null,
              program text,
              minimum_score text,
              invitations text,
              processing_time text,
              raw_text text not null,
              source_url text not null,
              observed_at text not null,
              data_basis_at text not null,
              foreign key(source_id) references sources(source_id)
            );

            create table if not exists source_checks (
              check_id text primary key,
              source_id text not null,
              checked_at text not null,
              status text not null,
              duration_ms integer not null,
              changed integer not null default 0,
              new_records integer not null default 0,
              error text,
              environment text not null default 'production',
              baseline integer not null default 0,
              foreign key(source_id) references sources(source_id)
            );

            create table if not exists profiles (
              profile_id text primary key,
              data_json text not null,
              updated_at text not null
            );

            create table if not exists insights_cache (
              cache_key text primary key,
              generated_at text not null,
              window_days integer not null,
              compare_days integer not null,
              payload_json text not null,
              insights_json text not null
            );
            """
        )
        _ensure_column(conn, "changes", "program_tags", "text")
        _ensure_column(conn, "changes", "impact_level", "text")
        _ensure_column(conn, "changes", "evidence_url", "text")
        _ensure_column(conn, "changes", "data_basis_at", "text")
        _ensure_column(conn, "changes", "environment", "text")
        _ensure_column(conn, "changes", "hidden", "integer")
        _ensure_column(conn, "changes", "created_by", "text")
        _ensure_column(conn, "changes", "reasoning_ko", "text")
        _ensure_column(conn, "official_records", "processing_time", "text")
        _ensure_column(conn, "official_records", "record_category", "text")
        _ensure_column(conn, "official_records", "policy_scope", "text")
        _ensure_column(conn, "official_records", "stage", "text")
        _ensure_column(conn, "official_records", "metric_name", "text")
        _ensure_column(conn, "official_records", "metric_value", "text")
        _ensure_column(conn, "official_records", "metric_unit", "text")
        _ensure_column(conn, "insights_cache", "window_days", "integer")
        _ensure_column(conn, "insights_cache", "compare_days", "integer")
        _ensure_column(conn, "insights_cache", "insights_json", "text")
        conn.execute("update changes set environment = 'production' where environment is null")
        conn.execute("update changes set hidden = 0 where hidden is null")
        conn.execute("update changes set created_by = 'monitor' where created_by is null")


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, column_type: str) -> None:
    existing = {row["name"] for row in conn.execute(f"pragma table_info({table})").fetchall()}
    if column not in existing:
        conn.execute(f"alter table {table} add column {column} {column_type}")


def rows(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with connect() as conn:
        return [dict(row) for row in conn.execute(query, params).fetchall()]


def row(query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with connect() as conn:
        result = conn.execute(query, params).fetchone()
        return dict(result) if result else None


def execute(query: str, params: tuple[Any, ...] = ()) -> None:
    with connect() as conn:
        conn.execute(query, params)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
