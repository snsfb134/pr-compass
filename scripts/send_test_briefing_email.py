from __future__ import annotations

import argparse
import smtplib
import json
import os
import sys
from email.message import EmailMessage
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.core.briefings import now_iso  # noqa: E402
from app.core.db import connect, init_db, rows  # noqa: E402
from scripts.deliver_mock_email_queue import deliver_mock, render_email  # noqa: E402
from scripts.replay_historical_update_flow import run_replay  # noqa: E402


def ready_emails(recipient_email: str, limit: int) -> list[dict[str, Any]]:
    init_db()
    return rows(
        """
        select *
        from email_queue
        where status = 'mock_ready'
          and recipient_email = ?
        order by created_at desc
        limit ?
        """,
        (recipient_email, limit),
    )


def send_with_resend(recipient_email: str, limit: int) -> dict[str, Any]:
    try:
        import requests
    except ModuleNotFoundError as exc:
        raise RuntimeError("requests is required for Resend delivery. Run with .venv/bin/python or install requirements.txt.") from exc

    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    from_email = os.environ.get("RESEND_FROM_EMAIL", "PR Compass <onboarding@resend.dev>").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not set")

    emails = ready_emails(recipient_email, limit)
    delivered = []
    failures = []
    delivered_at = now_iso()
    for email in emails:
        rendered = render_email(email)
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": from_email,
                "to": [rendered["to"]],
                "subject": rendered["subject"],
                "html": rendered["html"],
                "text": rendered["text"],
            },
            timeout=20,
        )
        if response.status_code >= 400:
            failures.append(
                {
                    "emailId": email["email_id"],
                    "statusCode": response.status_code,
                    "body": response.text[:500],
                }
            )
            continue
        payload = response.json()
        with connect() as conn:
            conn.execute(
                """
                update email_queue
                set status = ?, sent_at = ?
                where email_id = ?
                """,
                ("sent", delivered_at, email["email_id"]),
            )
        delivered.append(
            {
                "emailId": email["email_id"],
                "runId": email["run_id"],
                "recipientEmail": recipient_email,
                "subject": email["subject"],
                "provider": "resend",
                "providerId": payload.get("id"),
            }
        )

    return {
        "ok": bool(delivered) and not failures,
        "mode": "resend",
        "deliveredAt": delivered_at,
        "deliveredCount": len(delivered),
        "delivered": delivered,
        "failures": failures,
    }


def smtp_is_configured() -> bool:
    return bool(
        os.environ.get("SMTP_HOST", "").strip()
        and os.environ.get("SMTP_USERNAME", "").strip()
        and os.environ.get("SMTP_PASSWORD", "").strip()
        and os.environ.get("SMTP_FROM_EMAIL", "").strip()
    )


def send_with_smtp(recipient_email: str, limit: int) -> dict[str, Any]:
    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "587"))
    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    from_email = os.environ.get("SMTP_FROM_EMAIL", "").strip()
    use_ssl = os.environ.get("SMTP_USE_SSL", "").strip().lower() in {"1", "true", "yes"}
    if not smtp_is_configured():
        raise RuntimeError("SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL are required for SMTP delivery")

    emails = ready_emails(recipient_email, limit)
    delivered = []
    failures = []
    delivered_at = now_iso()
    smtp_class = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    with smtp_class(host, port, timeout=30) as smtp:
        if not use_ssl:
            smtp.starttls()
        smtp.login(username, password)
        for email in emails:
            rendered = render_email(email)
            message = EmailMessage()
            message["From"] = from_email
            message["To"] = rendered["to"]
            message["Subject"] = rendered["subject"]
            message.set_content(rendered["text"])
            message.add_alternative(rendered["html"], subtype="html")
            try:
                smtp.send_message(message)
            except Exception as exc:  # pragma: no cover - depends on external SMTP provider.
                failures.append({"emailId": email["email_id"], "error": str(exc)})
                continue
            with connect() as conn:
                conn.execute(
                    """
                    update email_queue
                    set status = ?, sent_at = ?
                    where email_id = ?
                    """,
                    ("sent", delivered_at, email["email_id"]),
                )
            delivered.append(
                {
                    "emailId": email["email_id"],
                    "runId": email["run_id"],
                    "recipientEmail": recipient_email,
                    "subject": email["subject"],
                    "provider": "smtp",
                }
            )

    return {
        "ok": bool(delivered) and not failures,
        "mode": "smtp",
        "deliveredAt": delivered_at,
        "deliveredCount": len(delivered),
        "delivered": delivered,
        "failures": failures,
    }


def run_test(recipient_email: str, scenarios: int, force_mock: bool) -> dict[str, Any]:
    replay = run_replay(scenarios=scenarios, recipient_email=recipient_email, write=True)
    if not replay["ok"]:
        return {
            "ok": False,
            "stage": "replay",
            "replay": replay,
        }

    has_resend = bool(os.environ.get("RESEND_API_KEY", "").strip())
    has_smtp = smtp_is_configured()
    if has_resend and not force_mock:
        delivery = send_with_resend(recipient_email, scenarios)
    elif has_smtp and not force_mock:
        delivery = send_with_smtp(recipient_email, scenarios)
    else:
        delivery = deliver_mock(recipient_email, scenarios)
        delivery["reason"] = "no Resend/SMTP credentials configured" if not has_resend and not has_smtp else "forced mock delivery"

    return {
        "ok": bool(replay["ok"] and delivery["ok"]),
        "recipientEmail": recipient_email,
        "scenarios": scenarios,
        "replay": {
            "ok": replay["ok"],
            "scenarioCount": replay["scenarioCount"],
            "writtenRunIds": [item["writtenRunId"] for item in replay["results"]],
            "emailPreviews": [item["emailPreview"] for item in replay["results"]],
        },
        "delivery": delivery,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run pre-Gemini replay QA and deliver the resulting briefing email via Resend, SMTP, or mock outbox."
    )
    parser.add_argument("--recipient-email", required=True)
    parser.add_argument("--scenarios", type=int, default=3)
    parser.add_argument("--force-mock", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    try:
        result = run_test(args.recipient_email, args.scenarios, args.force_mock)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
