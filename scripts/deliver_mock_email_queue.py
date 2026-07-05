from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.core.briefings import now_iso  # noqa: E402
from app.core.db import connect, init_db, rows  # noqa: E402

OUTBOX_DIR = ROOT_DIR / "data" / "email-outbox"


def render_email(email: dict[str, Any]) -> dict[str, Any]:
    preview = json.loads(email["preview_json"])
    intro = str(preview.get("intro") or "").strip()
    meta = [str(item) for item in preview.get("meta") or []]
    bullets = [str(item) for item in preview.get("bullets") or []]
    source_url = str(preview.get("sourceUrl") or "").strip()
    text_parts = [email["subject"], ""]
    if intro:
        text_parts.extend([intro, ""])
    if meta:
        text_parts.extend([*[f"- {item}" for item in meta], ""])
    text_parts.extend([*[f"- {bullet}" for bullet in bullets]])
    if source_url:
        text_parts.extend(["", f"공식 원문: {source_url}"])
    return {
        "to": email["recipient_email"],
        "subject": email["subject"],
        "text": "\n".join(text_parts),
        "html": "\n".join(
            [
                f"<h1>{escape_html(email['subject'])}</h1>",
                f"<p>{escape_html(intro)}</p>" if intro else "",
                "<h2>업데이트 기준</h2>" if meta else "",
                "<ul>" if meta else "",
                *[f"  <li>{escape_html(item)}</li>" for item in meta],
                "</ul>" if meta else "",
                "<h2>요약</h2>",
                "<ul>",
                *[f"  <li>{escape_html(bullet)}</li>" for bullet in bullets],
                "</ul>",
                f"<p><a href=\"{escape_html(source_url)}\">공식 원문 보기</a></p>" if source_url else "",
            ]
        ),
        "preview": preview,
        "runId": email["run_id"],
        "emailId": email["email_id"],
    }


def escape_html(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#x27;")
    )


def deliver_mock(recipient_email: str | None, limit: int) -> dict[str, Any]:
    init_db()
    params: list[Any] = []
    where = "where status = 'mock_ready' and recipient_email is not null"
    if recipient_email:
        where += " and recipient_email = ?"
        params.append(recipient_email)
    params.append(limit)
    emails = rows(
        f"""
        select *
        from email_queue
        {where}
        order by created_at desc
        limit ?
        """,
        tuple(params),
    )
    OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    delivered = []
    delivered_at = now_iso()
    with connect() as conn:
        for email in emails:
            rendered = render_email(email)
            outbox_path = OUTBOX_DIR / f"{email['email_id']}.json"
            outbox_path.write_text(json.dumps(rendered, ensure_ascii=False, indent=2), encoding="utf-8")
            conn.execute(
                """
                update email_queue
                set status = ?, sent_at = ?
                where email_id = ?
                """,
                ("mock_delivered", delivered_at, email["email_id"]),
            )
            delivered.append(
                {
                    "emailId": email["email_id"],
                    "runId": email["run_id"],
                    "recipientEmail": email["recipient_email"],
                    "subject": email["subject"],
                    "outboxPath": str(outbox_path),
                }
            )
    return {
        "ok": bool(delivered),
        "mode": "mock_delivery",
        "deliveredAt": delivered_at,
        "deliveredCount": len(delivered),
        "delivered": delivered,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Render mock email queue rows to local outbox files.")
    parser.add_argument("--recipient-email", default="", help="Only deliver mock emails for this recipient.")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    try:
        result = deliver_mock(args.recipient_email or None, args.limit)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
