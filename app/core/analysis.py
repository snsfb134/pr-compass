import re


def summarize_change(source: dict, diff_text: str) -> dict:
    return _heuristic_change_summary(source, diff_text)


def summarize_trend_insights(payload: dict) -> dict:
    return _heuristic_trend_summary(payload)


def _heuristic_change_summary(source: dict, diff_text: str) -> dict:
    text = diff_text.lower()
    source_id = source.get("source_id", "")

    if source_id == "ircc_express_entry_reforms_consultation":
        return {
            "change_type": "program_status",
            "summary_ko": "Express Entry 개편 논의 문서에 변화가 있습니다.",
            "confidence": "medium",
            "needs_review": True,
            "reasoning_ko": "정책 방향 자체를 바꿀 수 있는 공식 상담 문서입니다.",
        }

    if source_id == "ircc_program_delivery_updates":
        if any(keyword in text for keyword in ["program delivery", "operational bulletin", "update", "policy", "instruction"]):
            return {
                "change_type": "program_status",
                "summary_ko": "IRCC 운영 지침 또는 정책 업데이트가 감지되었습니다.",
                "confidence": "high",
                "needs_review": True,
                "reasoning_ko": "운영 지침 또는 업데이트 관련 변화는 정책 적용 신호일 수 있습니다.",
            }

    if "estimated processing time" in text or "processing times" in text or any(unit in text for unit in [" months", " weeks", " days"]):
        return {
            "change_type": "processing_time",
            "summary_ko": "처리기간 관련 공식 문구나 수치가 바뀌었습니다.",
            "confidence": "medium",
            "needs_review": True,
            "reasoning_ko": "처리기간 표나 안내 문구의 변화로 보입니다.",
        }

    if "express_entry" in source_id or "invitations to apply" in text:
        if re.search(r"\b(crs|invitation|invite|draw|round|cutoff|cut-off)\b", text):
            return {
                "change_type": "draw",
                "summary_ko": "Express Entry 또는 초청 기록 변화가 감지되었습니다.",
                "confidence": "high",
                "needs_review": True,
                "reasoning_ko": "초청 수, CRS, draw 또는 round 관련 텍스트가 포함되어 있습니다.",
            }

    if source_id == "welcomebc_bc_pnp_online" and any(keyword in text for keyword in ["maintenance", "unavailable", "outage", "portal", "login", "service interruption"]):
        return {
            "change_type": "program_status",
            "summary_ko": "BC PNP 온라인 포털 상태나 안내가 바뀌었습니다.",
            "confidence": "high",
            "needs_review": True,
            "reasoning_ko": "포털 운영 상태는 신청 흐름에 직접 영향을 줄 수 있습니다.",
        }

    if "eligible" in text or "eligibility" in text or "requirement" in text:
        return {
            "change_type": "eligibility",
            "summary_ko": "자격요건 또는 요구사항 관련 변경이 감지되었습니다.",
            "confidence": "high",
            "needs_review": True,
            "reasoning_ko": "eligibility 또는 requirement 관련 문구가 보입니다.",
        }

    if "occupation" in text or "noc" in text or "teer" in text or "priority" in text or "priority occupations" in text:
        return {
            "change_type": "occupation_priority",
            "summary_ko": "직군 또는 우선순위 범위가 바뀌었을 수 있습니다.",
            "confidence": "medium",
            "needs_review": True,
            "reasoning_ko": "직군 또는 우선순위 관련 용어가 보입니다.",
        }

    if "quota" in text or "allocation" in text or "invitation allocation" in text:
        return {
            "change_type": "allocation",
            "summary_ko": "할당 또는 배정 관련 신호가 있습니다.",
            "confidence": "medium",
            "needs_review": True,
            "reasoning_ko": "배정 또는 할당 관련 문구가 보입니다.",
        }

    if len(diff_text.splitlines()) <= 20 and all(token not in text for token in ["draw", "round", "crs", "eligibility", "processing time", "update", "portal", "maintenance"]):
        return {
            "change_type": "wording",
            "summary_ko": "짧은 문구 변경이 감지되었습니다.",
            "confidence": "low",
            "needs_review": False,
            "reasoning_ko": "diff가 짧고 정책 신호는 보이지 않습니다.",
        }

    return {
        "change_type": "unknown",
        "summary_ko": "변경사항이 감지됐습니다.",
        "confidence": "low",
        "needs_review": True,
        "reasoning_ko": "명확한 패턴이 없어 검토가 필요합니다.",
    }


def _heuristic_trend_summary(payload: dict) -> dict:
    window = payload.get("window", {})
    draw_summary = payload.get("draw_summary", {})
    processing_time = payload.get("processing_time", {})
    momentum = payload.get("momentum", [])

    highlights = []
    risks = []
    opportunities = []
    watchlist = []

    if momentum:
        for item in momentum[:3]:
            label = item.get("label") or item.get("program") or "주요 항목"
            delta = item.get("count_delta")
            score_delta = item.get("score_delta")
            invitation_delta = item.get("invitation_delta")
            highlights.append(
                f"{label}: 최근 구간 변화량 {delta if delta is not None else 0}, 점수 변화 {score_delta if score_delta is not None else 0}, 초청 변화 {invitation_delta if invitation_delta is not None else 0}"
            )
            watchlist.append(label)

    for label, block in processing_time.items():
        if not isinstance(block, dict):
            continue
        delta_days = block.get("delta_days")
        if isinstance(delta_days, (int, float)) and delta_days > 0:
            risks.append(f"{block.get('label', label)} 처리기간이 최근 구간에서 {int(delta_days)}일 늘었습니다.")

    bc_pnp = draw_summary.get("bc_pnp", {})
    express_entry = draw_summary.get("express_entry", {})

    if bc_pnp.get("recent_count", 0) > bc_pnp.get("previous_count", 0):
        opportunities.append("BC PNP 관련 공식 기록이 최근 구간에서 더 자주 확인되고 있습니다.")
    if express_entry.get("recent_count", 0) < express_entry.get("previous_count", 0):
        risks.append("Express Entry 기록 빈도가 이전 구간보다 줄어 신호 해석에 보수적 접근이 필요합니다.")

    if not highlights:
        highlights.append("최근 공식 기록을 기준으로 경로별 흐름을 비교하고 있습니다.")
    if not risks:
        risks.append("표본 수가 적은 구간은 다음 공식 업데이트에서 재확인이 필요합니다.")
    if not opportunities:
        opportunities.append("점수, 초청 수, 처리기간을 함께 보면 다음 행동 우선순위를 더 명확히 잡을 수 있습니다.")
    if not watchlist:
        watchlist.append("다음 공식 업데이트")

    anchor_date = window.get("anchor_date")
    summary = "최근 공식 기록을 기준으로 BC PNP와 Express Entry 흐름을 비교하고 있습니다."
    if anchor_date:
        summary = f"{summary} 기준일은 {anchor_date}입니다."

    return {
        "summary_ko": summary,
        "outlook_ko": "점수, 초청 수, 처리기간의 방향성이 함께 움직이는지 다음 공식 업데이트에서 다시 확인해야 합니다.",
        "highlights": highlights[:3],
        "risks": risks[:3],
        "opportunities": opportunities[:3],
        "watchlist": watchlist[:3],
    }
