type DateInput = string | number | Date | null | undefined;

const VICTORIA_TIME_ZONE = "America/Vancouver";

function parseDateInput(value: DateInput) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildParts(value: DateInput) {
  const date = parseDateInput(value);
  if (!date) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: VICTORIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

export function formatVancouverDate(value: DateInput) {
  const parts = buildParts(value);
  if (!parts) {
    return "대기";
  }
  return `${parts.year}.${parts.month}.${parts.day}`;
}

export function formatVancouverDateTime(value: DateInput) {
  const parts = buildParts(value);
  if (!parts) {
    return "대기";
  }
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatVancouverShortDateTime(value: DateInput) {
  const parts = buildParts(value);
  if (!parts) {
    return "대기";
  }
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatVancouverCheckedLabel(value: DateInput) {
  const short = formatVancouverShortDateTime(value);
  return short === "대기" ? short : `확인 ${short}`;
}
