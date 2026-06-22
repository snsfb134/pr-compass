from app.core.notifier import notify_macos


def notify_results(results: list[dict]) -> bool:
    eligible = [item for item in results if not item.get("baseline") and item.get("environment", "production") == "production"]
    changed = [item for item in eligible if item.get("changed")]
    record_updates = [item for item in eligible if item.get("new_records", 0) > 0]

    if record_updates:
        total = sum(item.get("new_records", 0) for item in record_updates)
        first = record_updates[0]
        return notify_macos(
            "PR Monitor: 중요 공식 기록",
            f"{first['title']}에서 새 기록 {total}건이 감지됐습니다.",
            "Draw / ITA / 공식 기록",
        )

    if changed:
        first = changed[0]
        more = "" if len(changed) == 1 else f" 외 {len(changed) - 1}건"
        change = first.get("change", {})
        summary = change.get("summary_ko") or first["title"]
        priority = _priority_label(change)
        return notify_macos(
            f"PR Monitor: {priority} 변경 감지",
            f"{summary[:120]}{more}",
            first["title"],
        )

    return False


def _priority_label(change: dict) -> str:
    change_type = change.get("change_type", "unknown")
    if change.get("needs_review") or change_type in {"draw", "eligibility", "program_status", "occupation_priority", "allocation", "processing_time"}:
        return "중요"
    if change_type == "wording":
        return "참고"
    return "확인 필요"
