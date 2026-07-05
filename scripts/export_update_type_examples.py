from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.core.briefings import build_agent_analysis, build_briefing_input, normalize_briefing, now_iso  # noqa: E402
from app.core.db import init_db, rows  # noqa: E402

REPORT_DIR = ROOT_DIR / "data" / "replay-reports"


def load_change_examples() -> list[dict[str, Any]]:
    return rows(
        """
        select c.*, src.publisher, src.title as source_title, src.url as source_url
        from changes c
        join sources src on src.source_id = c.source_id
        where coalesce(c.hidden, 0) = 0
          and coalesce(c.environment, 'production') = 'production'
          and c.change_type in ('program_status', 'processing_time', 'occupation_priority', 'eligibility', 'wording')
        order by detected_at desc
        limit 8
        """
    )


def change_to_update(change: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "change",
        "title": change.get("summary_ko") or change.get("source_title") or "공식 변경",
        "source": change.get("source_title") or change.get("publisher") or "공식 소스",
        "source_url": change.get("source_url") or change.get("evidence_url") or "",
        "detected_at": change.get("detected_at") or change.get("data_basis_at") or "",
        "raw": change,
    }


def build_example(change: dict[str, Any]) -> dict[str, Any]:
    payload = build_briefing_input()
    payload["newUpdate"] = change_to_update(change)
    analysis = build_agent_analysis(payload)
    analysis["_provider"] = "agent"
    analysis["_status"] = "analyzed"
    normalized = normalize_briefing(payload, analysis, now_iso())
    return {
        "changeType": change.get("change_type"),
        "source": normalized["latestUpdate"]["source"],
        "title": normalized["latestUpdate"]["title"],
        "typeLabel": normalized["latestUpdate"].get("typeLabel"),
        "detectedAt": normalized["updateMeta"]["displayDetectedAt"],
        "headline": normalized["headline"],
        "emailPreview": normalized["emailPreview"],
        "bcPnpImpact": normalized["bcPnpImpact"],
        "expressEntryImpact": normalized["expressEntryImpact"],
        "watchPoints": normalized["watchPoints"],
    }


def main() -> int:
    init_db()
    examples = [build_example(change) for change in load_change_examples()]
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / "update-type-examples.json"
    path.write_text(json.dumps(examples, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "count": len(examples),
                "path": str(path),
                "examples": examples[:3],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
