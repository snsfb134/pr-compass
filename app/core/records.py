import json
import hashlib
import re
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup
import requests

DATE_RE = re.compile(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+20\d{2}\b", re.I)
NUMBER_RE = re.compile(r"\b\d{2,5}\b")


def extract_official_records(source: dict[str, Any], html: str, observed_at: str) -> list[dict[str, str]]:
    if source["source_id"] == "welcomebc_bc_pnp_invitations":
        return _extract_table_records(source, html, observed_at, "bc_pnp_ita")
    if source["source_id"] == "ircc_express_entry_ministerial_instructions":
        return _extract_express_entry_rounds(source, html, observed_at)
    if source["source_id"] == "ircc_express_entry_rounds":
        return []
    if source["source_id"] in {
        "welcomebc_skills_immigration",
        "welcomebc_entrepreneur_immigration",
        "welcomebc_regional_immigration",
    }:
        return _extract_processing_time_records(source, html, observed_at)
    return []


def _record_fields(
    *,
    record_category: str,
    policy_scope: str,
    stage: str,
    metric_name: str,
    metric_value: str,
    metric_unit: str,
) -> dict[str, str]:
    return {
        "record_category": record_category,
        "policy_scope": policy_scope,
        "stage": stage,
        "metric_name": metric_name,
        "metric_value": metric_value,
        "metric_unit": metric_unit,
    }


def _extract_express_entry_rounds(source: dict[str, Any], html: str, observed_at: str) -> list[dict[str, str]]:
    data = _load_express_entry_rounds_data(html)
    if data:
        return _extract_express_entry_rounds_from_json(source, data, observed_at)

    soup = BeautifulSoup(html, "html.parser")
    records = []

    for row in soup.select("table tr"):
        cells = [_clean(cell.get_text(" ", strip=True)) for cell in row.select("th, td")]
        cells = [cell for cell in cells if cell]
        if len(cells) < 5:
            continue
        if not cells[0].isdigit():
            continue

        round_number, event_date, round_type, invitations, minimum_score = cells[:5]
        if not DATE_RE.search(event_date):
            continue
        raw_text = " | ".join(cells[:5])
        title = f"Express Entry #{round_number} - {round_type}"
        records.append(
            {
                "record_id": _record_id(source["source_id"], "express_entry_round", event_date, raw_text),
                "source_id": source["source_id"],
                "record_type": "express_entry_round",
                "event_date": event_date,
                "title": title,
                "program": f"Express Entry - {round_type}",
                "minimum_score": minimum_score.replace(",", ""),
                "invitations": invitations.replace(",", ""),
                "raw_text": raw_text,
                "source_url": source["url"],
                "observed_at": observed_at,
                "data_basis_at": observed_at,
            }
        )

    return records


def _extract_express_entry_rounds_from_json(source: dict[str, Any], data: dict[str, Any], observed_at: str) -> list[dict[str, str]]:
    records = []
    for round_data in data.get("rounds", []):
        draw_number = str(round_data.get("drawNumber") or "").strip()
        draw_date = _format_express_entry_date(round_data.get("drawDate") or round_data.get("drawDateFull") or "")
        draw_name = _clean(str(round_data.get("drawName") or ""))
        draw_size = _clean(str(round_data.get("drawSize") or ""))
        draw_crs = _clean(str(round_data.get("drawCRS") or ""))
        draw_time = _clean(str(round_data.get("drawDateTime") or ""))
        draw_cutoff = _clean(str(round_data.get("drawCutOff") or ""))
        draw_distribution = _clean(str(round_data.get("drawDistributionAsOn") or ""))
        if not draw_number or not draw_date:
            continue

        raw_text = " | ".join(
            part
            for part in [
                draw_number,
                draw_date,
                draw_name,
                draw_size,
                draw_crs,
                draw_time,
                draw_cutoff,
                draw_distribution,
                _clean(str(round_data.get("drawText2") or "")),
            ]
            if part
        )
        title = f"Express Entry #{draw_number} - {draw_name or 'Round'}"
        records.append(
            {
                "record_id": _record_id(source["source_id"], "express_entry_round", draw_date, raw_text),
                "source_id": source["source_id"],
                "record_type": "express_entry_round",
                **_record_fields(
                    record_category="draw",
                    policy_scope="federal",
                    stage=draw_name or "Express Entry round",
                    metric_name="minimum_score",
                    metric_value=draw_crs,
                    metric_unit="points",
                ),
                "event_date": draw_date,
                "title": title,
                "program": "Express Entry",
                "minimum_score": draw_crs,
                "invitations": draw_size,
                "processing_time": "",
                "raw_text": raw_text,
                "source_url": source["url"],
                "observed_at": observed_at,
                "data_basis_at": observed_at,
            }
        )
    return records


def _extract_table_records(source: dict[str, Any], html: str, observed_at: str, record_type: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    records = []
    current_date = ""

    for row in soup.select("table tr"):
        cells = [_clean(cell.get_text(" ", strip=True)) for cell in row.select("th, td")]
        cells = [cell for cell in cells if cell]
        if len(cells) < 2:
            continue

        raw_text = " | ".join(cells)
        if _looks_like_header(raw_text):
            continue

        date_match = DATE_RE.search(raw_text)
        if date_match:
            current_date = date_match.group(0)

        event_date = current_date
        if not event_date:
            continue

        if not _looks_like_immigration_record(raw_text):
            continue

        title = _build_title(source, event_date, cells)
        record = {
            "record_id": _record_id(source["source_id"], record_type, event_date, raw_text),
            "source_id": source["source_id"],
            "record_type": record_type,
            **_record_fields(
                record_category="draw",
                policy_scope="bc_pnp",
                stage=title,
                metric_name="minimum_score",
                metric_value=_extract_score(raw_text),
                metric_unit="points",
            ),
            "event_date": event_date,
            "title": title,
            "program": _infer_program(source, raw_text),
            "minimum_score": _extract_score(raw_text),
            "invitations": _extract_invitations(raw_text),
            "processing_time": "",
            "raw_text": raw_text,
            "source_url": source["url"],
            "observed_at": observed_at,
            "data_basis_at": observed_at,
        }
        records.append(record)

    return records


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _looks_like_header(text: str) -> bool:
    lowered = text.lower()
    header_pairs = [
        ("date", "invitations"),
        ("date", "round"),
        ("minimum", "score"),
        ("score range", "number of registrations"),
        ("points", "number of registrations"),
    ]
    return any(left in lowered and right in lowered for left, right in header_pairs)


def _looks_like_immigration_record(text: str) -> bool:
    lowered = text.lower()
    signals = [
        "invitation",
        "invitations",
        "minimum score",
        "crs",
        "round",
        "draw",
        "points",
        "score",
        "candidate",
        "candidates",
    ]
    if any(signal in lowered for signal in signals):
        return True
    numbers = NUMBER_RE.findall(text)
    return len(numbers) >= 2


def _build_title(source: dict[str, Any], event_date: str, cells: list[str]) -> str:
    useful = [cell for cell in cells if not DATE_RE.fullmatch(cell)]
    detail = useful[0] if useful else source["title"]
    return f"{event_date} - {detail[:90]}"


def _infer_program(source: dict[str, Any], text: str) -> str:
    lowered = text.lower()
    if "express entry" in lowered or "cec" in lowered or "canadian experience" in lowered:
        return "Express Entry"
    if "entrepreneur" in lowered:
        return "BC PNP Entrepreneur"
    if "health" in lowered:
        return "BC PNP Health"
    if "childcare" in lowered or "early childhood" in lowered:
        return "BC PNP Childcare"
    if "construction" in lowered:
        return "BC PNP Construction"
    if "tech" in lowered:
        return "BC PNP Tech"
    if "bc_pnp" in source.get("program_tags", []):
        return "BC PNP"
    return source["title"]


def _extract_processing_time_records(source: dict[str, Any], html: str, observed_at: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    lines = [line.strip() for line in soup.get_text("\n", strip=True).splitlines()]
    lines = [line for line in lines if line]
    page_date = _extract_page_date(soup, lines) or _observed_date(observed_at)
    records: list[dict[str, str]] = []

    for section_index, section_start in enumerate(_find_all_indices(lines, "Processing times")):
        section_end = _next_processing_times_index(lines, section_start + 1)
        block = lines[section_start:section_end]
        section_heading = lines[section_end] if section_end < len(lines) else ""
        parsed = _parse_processing_time_block(source, block, section_heading, page_date, observed_at, section_index)
        records.extend(parsed)

    return records


def _parse_processing_time_block(
    source: dict[str, Any],
    block: list[str],
    section_heading: str,
    page_date: str,
    observed_at: str,
    section_index: int,
) -> list[dict[str, str]]:
    try:
        header_pos = block.index("Estimated processing time*")
    except ValueError:
        return []

    stream_label = _processing_stream_label(source, block, header_pos, section_heading)
    metric_lines = block[header_pos + 1 :]
    metric_lines = [line for line in metric_lines if not line.startswith("*")]
    if not metric_lines:
        return []

    records: list[dict[str, str]] = []
    for idx in range(0, len(metric_lines) - 1, 2):
        stage = metric_lines[idx].strip()
        processing_time = metric_lines[idx + 1].strip()
        if not stage or not processing_time:
            continue
        if stage in {"Stage", "Estimated processing time*"}:
            continue
        if _looks_like_section_heading(stage):
            break

        stage_label = f"{stream_label} · {stage}" if stream_label else stage
        base_program = _processing_program_label(source)
        raw_text = " | ".join(
            part
            for part in [
                source["title"],
                stream_label,
                stage,
                processing_time,
                page_date,
            ]
            if part
        )
        records.append(
            {
                "record_id": _record_id(
                source["source_id"],
                "processing_time",
                    f"{page_date}|{section_index}|{stage_label}",
                    raw_text,
                ),
                "source_id": source["source_id"],
                "record_type": "processing_time",
                **_record_fields(
                    record_category="processing_time",
                    policy_scope="bc_pnp",
                    stage=stage_label,
                    metric_name="processing_time",
                    metric_value=processing_time,
                    metric_unit="time",
                ),
                "event_date": page_date,
                "title": f"{stream_label} - {stage}",
                "program": base_program,
                "minimum_score": "",
                "invitations": "",
                "processing_time": processing_time,
                "raw_text": raw_text,
                "source_url": source["url"],
                "observed_at": observed_at,
                "data_basis_at": observed_at,
            }
        )

    return records


def _processing_program_label(source: dict[str, Any]) -> str:
    if source["source_id"] == "welcomebc_skills_immigration":
        return "BC PNP Skills Immigration"
    if source["source_id"] == "welcomebc_entrepreneur_immigration":
        return "BC PNP Entrepreneur Immigration"
    if source["source_id"] == "welcomebc_regional_immigration":
        return "BC PNP Regional Immigration"
    return source["title"]


def _processing_stream_label(source: dict[str, Any], block: list[str], header_pos: int, section_heading: str) -> str:
    if section_heading and section_heading.startswith("Process for "):
        match = re.search(r":\s*(.+)$", section_heading)
        if match:
            return _clean(match.group(1))
        return _clean(section_heading)
    if source["source_id"] == "welcomebc_skills_immigration":
        return "Skills Immigration"
    return "BC PNP"


def _looks_like_section_heading(value: str) -> bool:
    return value.startswith("Process for ") or value in {
        "Be fraud aware",
        "Processing times",
        "On this page",
        "Appeal review",
    }


def _find_all_indices(values: list[str], needle: str) -> list[int]:
    return [index for index, value in enumerate(values) if value == needle]


def _next_processing_times_index(values: list[str], start: int) -> int:
    for index in range(start, len(values)):
        if values[index] == "Processing times":
            return index
        if _looks_like_section_heading(values[index]) and index > start:
            return index
    return len(values)


def _extract_page_date(soup: BeautifulSoup, lines: list[str]) -> str:
    meta = soup.find("meta", attrs={"name": "dcterms.modified"})
    if meta and meta.get("content"):
        return _format_express_entry_date(str(meta.get("content")))
    for index, line in enumerate(lines):
        if line == "Last updated:" and index + 1 < len(lines):
            candidate = lines[index + 1]
            if index + 2 < len(lines) and lines[index + 2].isdigit():
                candidate = f"{candidate}, {lines[index + 2]}"
            return _clean(candidate)
    return ""


def _observed_date(observed_at: str) -> str:
    return observed_at[:10]


def _format_express_entry_date(value: str) -> str:
    value = _clean(value)
    if not value:
        return ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        year, month, day = value.split("-")
        month_name = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ][int(month) - 1]
        return f"{month_name} {int(day)}, {year}"
    return value


def _load_express_entry_rounds_data(html: str) -> dict[str, Any] | None:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", attrs={"data-wb-json": True})
    if table is None:
        return None
    payload = table.get("data-wb-json") or ""
    match = re.search(r'"url"\s*:\s*"([^"]+)"', payload)
    if not match:
        return None
    json_url = urljoin("https://www.canada.ca", match.group(1))
    response = requests.get(
        json_url,
        headers={
            "User-Agent": "Mozilla/5.0 PRPathwayMonitor/0.1 local research tool",
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-CA,en;q=0.9",
        },
        timeout=(8, 15),
    )
    response.raise_for_status()
    return response.json()


def _extract_score(text: str) -> str:
    lowered = text.lower()
    if "n/a" in lowered:
        return "N/A"
    numbers = _metric_numbers(text)
    return numbers[-2] if len(numbers) >= 2 else (numbers[-1] if numbers else "")


def _extract_invitations(text: str) -> str:
    lowered = text.lower()
    less_than_match = re.search(r"<\s*\d+", text)
    if less_than_match:
        return less_than_match.group(0).replace(" ", "")
    numbers = _metric_numbers(text)
    return numbers[-1] if numbers else ""


def _metric_numbers(text: str) -> list[str]:
    text_without_dates = DATE_RE.sub("", text)
    return [number for number in NUMBER_RE.findall(text_without_dates) if not number.startswith("20")]


def _record_id(source_id: str, record_type: str, event_date: str, raw_text: str) -> str:
    digest = hashlib.sha256(f"{source_id}|{record_type}|{event_date}|{raw_text}".encode("utf-8")).hexdigest()
    return digest[:24]
