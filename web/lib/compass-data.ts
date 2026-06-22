import { fetchJson } from "@/lib/api";
import { formatVancouverCheckedLabel, formatVancouverDate } from "@/lib/date-format";

export type DashboardState = "empty" | "started" | "returning";
export const EXPECTED_PROFILE_SCHEMA_VERSION = 4;

export type ProfileDiagnosticItem = {
  title: string;
  body: string;
};

export type CompassProfileDiagnostics = {
  occupation_status?: string;
  ee_category_status?: string;
  crs_confidence?: number | null;
  pnp_confidence?: number | null;
  blocking_inputs?: ProfileDiagnosticItem[];
  recommended_occupation_groups?: string[];
};

export type CompassProfileResponse = {
  profile?: Record<string, unknown>;
  profile_complete?: boolean;
  profile_schema_version?: number;
  diagnostics?: CompassProfileDiagnostics;
  age?: number | null;
  age_basis?: string | null;
  profile_contract_ok?: boolean;
  profile_contract_issue?: string | null;
  profile_contract_expected_version?: number;
  profile_contract_actual_version?: number | null;
  strongest_route?: string;
  fit_score?: number;
  fit_label?: string;
  fit_tone?: string;
  current_status?: string;
  main_blocker?: string;
  next_milestone?: string;
  next_action?: string;
  score?: string;
  score_potential?: string;
  score_drivers?: string[];
  uncertainties?: string[];
  missing_requirements?: Array<{ title: string; body: string }>;
  profile_gate?: "locked" | "unlocked";
  computed_scores?: {
    locked?: boolean;
    crs?: {
      score?: number | null;
      status?: string;
      confidence?: number;
      basis?: string[];
      breakdown?: Record<string, number>;
      breakdown_details?: {
        total?: number;
        core_human_capital?: { score?: number; max_points?: number };
        first_language?: {
          score?: number;
          max_points?: number;
          basis?: string;
          confidence?: number;
          mode?: string;
          legacy_bucket?: string;
          thresholds?: {
            clb5_all?: boolean;
            clb7_all?: boolean;
            clb9_all?: boolean;
            min_clb?: number | null;
          };
          abilities?: Record<
            string,
            {
              input_clb?: string;
              effective_clb?: string;
              effective_clb_level?: number | null;
              source?: string;
              score?: number;
              max_points?: number;
            }
          >;
        };
        spouse_factors?: { score?: number; max_points?: number };
        skill_transferability?: {
          score?: number;
          max_points?: number;
          factors?: Record<string, { score?: number; basis?: string }>;
        };
        additional_points?: {
          score?: number;
          max_points?: number;
          factors?: Record<string, number>;
        };
        components?: Record<string, { score?: number; max_points?: number; basis?: string; confidence?: number }>;
      };
      missing?: Array<{ title: string; body: string }>;
    };
    bc_pnp?: {
      fit_score?: number | null;
      status?: string;
      estimated_registration_range?: [number, number] | null;
      confidence?: number;
      basis?: string[];
      missing?: Array<{ title: string; body: string }>;
    };
    express_entry?: {
      crs_score?: number | null;
      latest_cutoff?: number | null;
      cutoff_gap?: number | null;
      readiness_label?: string | null;
      status?: string;
      missing?: Array<{ title: string; body: string }>;
    };
    comparison?: {
      closer_route?: string | null;
      express_entry_fit?: number | null;
      bc_pnp_fit?: number | null;
      next_action?: string;
    };
  };
  route_profiles?: Record<string, any>;
  position_explanation?: string;
  main_status?: string;
  updated_at?: string | null;
};

export type CompassWorkspaceData = {
  summary: any;
  changes: any[];
  records: any[];
  insights: any;
  statusOverview: any;
  programOverview: any;
  policyOverview: any;
  profile: CompassProfileResponse;
};

function profileFetchInit(userId?: string | null) {
  return userId ? { headers: { "x-user-id": userId } } : undefined;
}

function createProfileContractFallback(actualVersion: number | null, issue: string): CompassProfileResponse {
  return {
    profile: {},
    updated_at: null,
    profile_complete: false,
    profile_gate: "locked",
    profile_schema_version: actualVersion ?? undefined,
    age: null,
    age_basis: "서버 계약 확인 필요",
    profile_contract_ok: false,
    profile_contract_issue: issue,
    profile_contract_expected_version: EXPECTED_PROFILE_SCHEMA_VERSION,
    profile_contract_actual_version: actualVersion,
    strongest_route: "Express Entry",
    fit_score: 0,
    fit_label: "서버 계약 확인 필요",
    fit_tone: "warn",
    current_status: "서버 계약 확인 필요",
    main_blocker: "서버 계약 확인 필요",
    next_milestone: "서버 계약 확인 필요",
    next_action: "서버 계약 확인 필요",
    score: "N/A",
    score_potential: "서버 계약 확인 필요",
    score_drivers: ["서버 계약 확인 필요"],
    uncertainties: ["서버 계약 확인 필요"],
    missing_requirements: [
      {
        title: "서버 계약 확인 필요",
        body: "profile_schema_version이 기대값보다 낮거나 비어 있습니다.",
      },
    ],
    computed_scores: {
      locked: true,
      crs: {
        score: null,
        status: "잠금",
        confidence: 20,
        basis: ["서버 계약 확인 필요"],
        missing: [
          {
            title: "서버 계약 확인 필요",
            body: "profile_schema_version을 확인해야 개인화 계산을 열 수 있습니다.",
          },
        ],
      },
      bc_pnp: {
        fit_score: null,
        status: "잠금",
        estimated_registration_range: null,
        confidence: 20,
        basis: ["서버 계약 확인 필요"],
        missing: [
          {
            title: "서버 계약 확인 필요",
            body: "profile_schema_version을 확인해야 BC PNP 비교를 열 수 있습니다.",
          },
        ],
      },
      comparison: {
        closer_route: null,
        express_entry_fit: null,
        bc_pnp_fit: null,
        next_action: "서버 계약 확인 필요",
      },
    },
    route_profiles: {
      bc_pnp: {
        route: "BC PNP",
        score: 0,
        fit_label: "잠금",
        fit_tone: "warn",
        ready: false,
        summary: "서버 계약 확인이 필요합니다.",
        focus: "BC PNP",
        drivers: ["서버 계약 확인 필요"],
        signals: ["서버 계약 확인 필요"],
        missing_requirements: [
          {
            title: "서버 계약 확인 필요",
            body: "profile_schema_version을 확인해야 개인화 분석을 열 수 있습니다.",
          },
        ],
      },
      express_entry: {
        route: "Express Entry",
        score: 0,
        fit_label: "잠금",
        fit_tone: "warn",
        ready: false,
        summary: "서버 계약 확인이 필요합니다.",
        focus: "Express Entry",
        drivers: ["서버 계약 확인 필요"],
        signals: ["서버 계약 확인 필요"],
        missing_requirements: [
          {
            title: "서버 계약 확인 필요",
            body: "profile_schema_version을 확인해야 개인화 분석을 열 수 있습니다.",
          },
        ],
      },
    },
    position_explanation: "서버 계약 확인이 필요합니다.",
    main_status: "서버 계약 확인 필요",
  };
}

function normalizeProfileContract(profile: unknown, context: string): CompassProfileResponse {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    console.error(`[${context}] profile response is not an object`, { profile });
    return createProfileContractFallback(null, "profile response is not an object");
  }

  const typedProfile = profile as CompassProfileResponse;
  const actualVersion = typeof typedProfile.profile_schema_version === "number" ? typedProfile.profile_schema_version : null;
  if (actualVersion === null || actualVersion < EXPECTED_PROFILE_SCHEMA_VERSION) {
    console.error(`[${context}] profile contract mismatch`, {
      expected: EXPECTED_PROFILE_SCHEMA_VERSION,
      actual: actualVersion,
    });
    return createProfileContractFallback(actualVersion, `profile_schema_version mismatch: expected ${EXPECTED_PROFILE_SCHEMA_VERSION}, actual ${actualVersion ?? "missing"}`);
  }
  return {
    ...typedProfile,
    profile_contract_ok: true,
    profile_contract_issue: null,
    profile_contract_expected_version: EXPECTED_PROFILE_SCHEMA_VERSION,
    profile_contract_actual_version: actualVersion,
  };
}

export async function loadCompassWorkspace(userId?: string | null) {
  const [summary, changes, records, insights, statusOverview, programOverview, policyOverview, profile] = await Promise.all([
    fetchJson<any>("/api/summary"),
    fetchJson<any[]>("/api/changes"),
    fetchJson<any[]>("/api/records"),
    fetchJson<any>("/api/insights"),
    fetchJson<any>("/api/status-overview"),
    fetchJson<any>("/api/program-overview"),
    fetchJson<any>("/api/policy-overview"),
    fetchJson<CompassProfileResponse>("/api/profile", profileFetchInit(userId)),
  ]);

  return {
    summary,
    changes: Array.isArray(changes) ? changes : [],
    records: Array.isArray(records) ? records : [],
    insights,
    statusOverview,
    programOverview,
    policyOverview,
    profile: normalizeProfileContract(profile, "loadCompassWorkspace"),
  } satisfies CompassWorkspaceData;
}

export async function loadProfileWorkspace(userId?: string | null) {
  const profile = await fetchJson<CompassProfileResponse>("/api/profile", profileFetchInit(userId));
  return normalizeProfileContract(profile, "loadProfileWorkspace");
}

export async function loadSignalsWorkspace(userId?: string | null) {
  const [summary, changes, records, insights, profile, statusOverview, programOverview, policyOverview] = await Promise.all([
    fetchJson<any>("/api/summary"),
    fetchJson<any[]>("/api/changes"),
    fetchJson<any[]>("/api/records"),
    fetchJson<any>("/api/insights"),
    fetchJson<CompassProfileResponse>("/api/profile", profileFetchInit(userId)),
    fetchJson<any>("/api/status-overview"),
    fetchJson<any>("/api/program-overview"),
    fetchJson<any>("/api/policy-overview"),
  ]);

  return {
    summary,
    changes: Array.isArray(changes) ? changes : [],
    records: Array.isArray(records) ? records : [],
    insights,
    profile: normalizeProfileContract(profile, "loadSignalsWorkspace"),
    statusOverview,
    programOverview,
    policyOverview,
  };
}

export async function loadRouteWorkspace(userId?: string | null) {
  const [summary, profile, programOverview, policyOverview] = await Promise.all([
    fetchJson<any>("/api/summary"),
    fetchJson<CompassProfileResponse>("/api/profile", profileFetchInit(userId)),
    fetchJson<any>("/api/program-overview"),
    fetchJson<any>("/api/policy-overview"),
  ]);

  return { summary, profile: normalizeProfileContract(profile, "loadRouteWorkspace"), programOverview, policyOverview };
}

export function deriveDashboardState(requestedState: DashboardState | undefined, profile: CompassProfileResponse): DashboardState {
  if (requestedState === "empty" || requestedState === "started" || requestedState === "returning") {
    return requestedState;
  }
  const profileSaved = Boolean(profile.updated_at);
  if (!profileSaved) return "empty";
  if (profile.profile_complete) return "returning";
  return "started";
}

export function profileFillRatio(profile: CompassProfileResponse) {
  const values = profile.profile || {};
  const fields = [
    "birth_date",
    "marital_status",
    "current_status",
    "target_route",
    "education_level",
    "eca_status",
    "canadian_education",
    "sibling_in_canada",
    "work_experience_years",
    "canadian_experience_years",
    "foreign_experience_years",
    "noc_teer",
    "language_score",
    "language_test",
    "french_score",
    "ee_category_interest",
    "ee_profile_status",
    "arranged_employment",
    "employer_support",
    "bc_pnp_stream_interest",
    "bc_pnp_category_interest",
    "bc_connection_type",
    "bc_connection",
    "bc_job_offer",
    "bc_occupation_focus",
    "province_nomination_interest",
  ];
  const filled = fields.filter((field) => {
    const value = values[field];
    if (field === "birth_date" && !String(value ?? "").trim() && String(values.age ?? "").trim()) return true;
    if (typeof value === "boolean") return true;
    return Boolean(String(value ?? "").trim());
  }).length;
  return Math.round((filled / fields.length) * 100);
}

export function latestSignalSummary(summary: any, changes: any[]) {
  const latestChange = summary?.latest_change || changes?.[0] || null;
  return latestChange;
}

export type SignalBriefing = {
  hasLatestUpdate: boolean;
  title: string;
  summary: string;
  outlook: string;
  impactLabel: string;
  impactTone: "teal" | "gold" | "rose" | "slate";
  personalLine: string;
  highlights: string[];
  risks: string[];
  watchlist: string[];
  latestChange: any | null;
  evidenceItems: any[];
};

function signalImpactTone(impactLevel: string | undefined): SignalBriefing["impactTone"] {
  if (impactLevel === "high") return "rose";
  if (impactLevel === "medium") return "gold";
  if (impactLevel === "low") return "slate";
  return "teal";
}

function signalImpactLabel(impactLevel: string | undefined) {
  if (impactLevel === "high") return "높음";
  if (impactLevel === "medium") return "중간";
  if (impactLevel === "low") return "낮음";
  return "전망";
}

function uniqueTextList(items: unknown[], fallback: string[]) {
  const result = items.map((item) => String(item || "").trim()).filter(Boolean);
  return result.length ? Array.from(new Set(result)).slice(0, 4) : fallback;
}

const uncertainProfileValues = new Set(["", "other", "not sure", "unknown", "none", "미선택", "없음", "기타"]);

function isUncertainProfileValue(value: unknown) {
  return uncertainProfileValues.has(String(value ?? "").trim().toLowerCase());
}

function toTimestamp(value: unknown) {
  if (!value) return 0;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickPrimaryChange(changes: any[]) {
  const prioritized = (changes || [])
    .filter((change) => change?.needs_review || change?.impact_level === "high" || change?.impact_level === "medium" || change?.change_type === "draw")
    .sort((left, right) => toTimestamp(right?.detected_at) - toTimestamp(left?.detected_at));
  return prioritized[0] || null;
}

function formatRecordMetric(record: any) {
  if (record?.record_category === "draw") {
    const parts = [
      record?.minimum_score ? `최소 점수 ${record.minimum_score}점` : "",
      record?.invitations ? `초청 ${record.invitations}건` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (record?.record_category === "processing_time") {
    return record?.processing_time ? `처리기간 ${record.processing_time}` : "";
  }
  return record?.metric_value ? `${record.metric_name || "지표"} ${record.metric_value}` : "";
}

function normalizeRecordEvidence(record: any) {
  const metric = formatRecordMetric(record);
  const eventLabel = record?.event_date ? formatVancouverDate(record.event_date) : formatVancouverCheckedLabel(record?.observed_at || record?.checked_at || "");
  const eventText = eventLabel === "대기" ? "기준일 미확인" : eventLabel;
  const title = record?.stage || record?.title || `${record?.publisher || "공식"} 기록`;
  const summary = metric ? `${eventText} 기준 ${metric}` : `${eventText} 기준 공식 기록`;
  const reasoning =
    record?.record_category === "processing_time"
      ? "개별 기사 해석보다 공식 처리기간 기록 자체를 우선 근거로 사용합니다."
      : "개별 변경 카드보다 구조화된 공식 기록 흐름과 함께 해석합니다.";

  return {
    evidence_kind: "record",
    change_id: record?.record_id,
    title,
    summary_ko: summary,
    reasoning_ko: reasoning,
    source_title: record?.publisher ? `${record.publisher} 공식 기록` : "공식 기록",
    source_url: record?.source_url || "",
    publisher: record?.publisher || "공식",
    impact_level: record?.record_category === "draw" ? "medium" : "low",
    detected_at: record?.observed_at || record?.event_date || "",
    event_date: record?.event_date || "",
    metric: metric || "",
  };
}

function buildEvidenceFeed(changes: any[], records: any[]) {
  const normalizedChanges = (changes || []).map((change) => ({
    ...change,
    evidence_kind: "change",
    source_title: change?.source_title || change?.title || "공식 소스",
    source_url: change?.source_url || change?.url || "",
    detected_at: change?.detected_at || change?.data_basis_at || "",
  }));
  const normalizedRecords = (records || []).slice(0, 6).map(normalizeRecordEvidence);

  return [...normalizedChanges, ...normalizedRecords]
    .sort((left, right) => toTimestamp(right?.detected_at) - toTimestamp(left?.detected_at))
    .slice(0, 8);
}

export function buildSignalBriefing({
  summary,
  changes,
  records,
  insights,
  profile,
}: {
  summary: any;
  changes: any[];
  records: any[];
  insights?: any;
  profile: CompassProfileResponse;
}): SignalBriefing {
  const latestChange = pickPrimaryChange(changes) || latestSignalSummary(summary, changes);
  const latestRecord = (records || [])[0] || null;
  const trendInsights = insights?.insights || {};
  const payloadWindow = insights?.payload?.window || {};
  const anchorDateLabel = payloadWindow.anchor_date ? formatVancouverDate(payloadWindow.anchor_date) : null;
  const anchorDate = anchorDateLabel && anchorDateLabel !== "대기" ? anchorDateLabel : null;
  const lastCheckedAt = summary?.latest_snapshot || latestChange?.detected_at || latestRecord?.observed_at || null;
  const lastCheckedLabelRaw = formatVancouverCheckedLabel(lastCheckedAt);
  const lastCheckedLabel = lastCheckedLabelRaw === "대기" ? null : lastCheckedLabelRaw;
  const hasLatestUpdate = Boolean(pickPrimaryChange(changes));
  const latestTitle = latestChange?.title || "공식 업데이트";
  const latestSummary = latestChange?.summary_ko || latestChange?.summary || "";
  const latestRecordMetric = latestRecord ? formatRecordMetric(latestRecord) : "";
  const latestRecordLine = latestRecord
    ? `${latestRecord.event_date ? formatVancouverDate(latestRecord.event_date) : formatVancouverCheckedLabel(latestRecord.observed_at || latestRecord.checked_at || "")} ${latestRecord.stage || latestRecord.title || "공식 기록"}${latestRecordMetric ? ` · ${latestRecordMetric}` : ""}`
    : "";
  const trendSummary = trendInsights.summary_ko || "최근 공식 기록을 기준으로 경로별 흐름을 비교하고 있습니다.";
  const outlook = trendInsights.outlook_ko || "다음 공식 업데이트에서 점수, 초청 수, 처리기간의 방향성을 다시 확인해야 합니다.";
  const title = hasLatestUpdate ? `${latestTitle} 기준 통합 신호` : "새 공식 변경 없음, 현재 전망 유지";
  const summaryText = hasLatestUpdate
    ? `${latestSummary || "최신 공식 변경이 감지되었습니다."}${latestRecordLine ? ` 최근 공식 기록은 ${latestRecordLine}입니다.` : ""} 이 변화는 개별 기사 카드가 아니라 insights + changes + records를 함께 읽어 해석합니다.`
    : `${trendSummary}${lastCheckedLabel ? ` 마지막 확인 시각은 ${lastCheckedLabel}입니다.` : ""} 최신 변경이 없을 때는 과거 대비 흐름을 기준으로 전망을 유지합니다.`;
  const highlights = uniqueTextList(
    [
      ...(trendInsights.highlights || []),
      hasLatestUpdate && latestRecordLine ? `관련 공식 기록: ${latestRecordLine}` : "",
    ],
    [hasLatestUpdate ? "최신 업데이트를 기존 공식 기록 흐름과 함께 확인했습니다." : "최근 구간에서는 큰 구조적 변화가 충분히 쌓이지 않았습니다."],
  );
  const risks = uniqueTextList(trendInsights.risks || [], ["단정하기 어려운 항목은 다음 공식 업데이트에서 재확인이 필요합니다."]);
  const watchlist = uniqueTextList(
    [
      ...(trendInsights.watchlist || []),
      !hasLatestUpdate && lastCheckedLabel ? `새 변경이 없으면 ${lastCheckedLabel} 이후 업데이트만 다시 보면 됩니다.` : "",
    ],
    ["다음 업데이트에서 점수, 초청 수, 처리기간의 방향성을 다시 확인하세요."],
  );
  const personalLine = profile.profile_complete
    ? profile.position_explanation || profile.next_action || "프로필 기준 개인 영향이 연결되었습니다."
    : "프로필이 없으면 공개 전망만 보여주고, 개인 CRS/BC PNP 영향은 잠금 상태로 유지됩니다.";

  return {
    hasLatestUpdate,
    title,
    summary: summaryText,
    outlook: anchorDate ? `${outlook} 기준일: ${anchorDate}` : outlook,
    impactLabel: signalImpactLabel(latestChange?.impact_level),
    impactTone: signalImpactTone(latestChange?.impact_level),
    personalLine,
    highlights,
    risks,
    watchlist,
    latestChange,
    evidenceItems: buildEvidenceFeed(changes, records),
  };
}

export type PersonalImpactPanel = {
  title: string;
  meta: string;
  body: string;
  chip: string;
  tone: "teal" | "gold" | "rose" | "slate";
};

function normalizeDiagnostics(profile: CompassProfileResponse): CompassProfileDiagnostics | null {
  const diagnostics = profile.diagnostics;
  if (!diagnostics || typeof diagnostics !== "object") {
    return null;
  }
  return diagnostics;
}

function normalizeRecommendedOccupationGroups(groups: unknown[], fallback: string[]) {
  const normalized = groups
    .map((group) => String(group || "").trim())
    .filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)).slice(0, 4) : fallback;
}

function diagnosisStateLabel(hasBlockingInputs: boolean) {
  return hasBlockingInputs ? "임시 해석" : "정확 진단";
}

export function buildPersonalImpactPanels(profile: CompassProfileResponse): { locked: boolean; panels: PersonalImpactPanel[] } {
  const diagnostics = normalizeDiagnostics(profile);
  const hasBlockingInputs = Boolean(diagnostics?.blocking_inputs?.length);
  const diagnosisState = diagnosisStateLabel(hasBlockingInputs);

  if (!profile.profile_contract_ok || !profile.profile_complete) {
    return {
      locked: true,
      panels: [
        {
          title: `내 CRS 영향 잠금`,
          meta: "개인 영향",
          body: "프로필을 완료하면 자동 CRS가 공식 업데이트와 어떻게 맞물리는지 보여줍니다.",
          chip: "잠금",
          tone: "rose",
        },
        {
          title: "내 BC PNP 영향 잠금",
          meta: "개인 영향",
          body: "BC PNP 적합도, 추정 범위, 잡오퍼, 고용주 지원 신호를 개인 기준으로 정리합니다.",
          chip: "잠금",
          tone: "rose",
        },
        {
          title: "직업군/TEER 잠금",
          meta: "개인 영향",
          body: "직업군과 TEER 관련성은 프로필 완료 후에만 개인화됩니다.",
          chip: "잠금",
          tone: "rose",
        },
        {
          title: "다음 확인 행동 잠금",
          meta: "개인 영향",
          body: "다음 확인 행동은 공식 업데이트와 개인 프로필이 함께 있어야 계산됩니다.",
          chip: "잠금",
          tone: "rose",
        },
      ],
    };
  }

  const crsScore = profile.computed_scores?.crs?.score ?? profile.fit_score ?? 0;
  const bcFit = profile.computed_scores?.bc_pnp?.fit_score ?? profile.route_profiles?.bc_pnp?.score ?? 0;
  const bcRange = profile.computed_scores?.bc_pnp?.estimated_registration_range;
  const occupation = String(profile.profile?.bc_occupation_focus || "미선택");
  const teer = String(profile.profile?.noc_teer || "미선택");
  const eeCategory = String(profile.profile?.ee_category_interest || "미선택");
  const stream = String(profile.profile?.bc_pnp_stream_interest || "미선택");
  const category = String(profile.profile?.bc_pnp_category_interest || "미선택");
  const jobOffer = String(profile.profile?.bc_job_offer || "미선택");
  const employerSupport = profile.profile?.employer_support === true ? "있음" : profile.profile?.employer_support === false ? "없음" : "미선택";
  const needsOccupationChoice = diagnostics
    ? String(diagnostics.occupation_status || "").includes("직업군") && String(diagnostics.occupation_status || "").includes("필요")
    : isUncertainProfileValue(profile.profile?.bc_occupation_focus);
  const needsEeCategory = diagnostics
    ? String(diagnostics.ee_category_status || "").includes("미정") || String(diagnostics.ee_category_status || "").includes("미입력")
    : isUncertainProfileValue(profile.profile?.ee_category_interest);
  const recommendedOccupationGroups = normalizeRecommendedOccupationGroups(diagnostics?.recommended_occupation_groups || [], [
    "직무별 NOC 재선택",
    "현재 직무와 가까운 카테고리 확인",
  ]);

  return {
    locked: false,
    panels: [
      {
        title: "내 CRS 영향",
        meta: `${diagnosisState} · 자동 CRS`,
        body: hasBlockingInputs
          ? `자동 CRS ${crsScore}점은 계산됐습니다. ${diagnostics?.blocking_inputs?.slice(0, 2).map((item) => item.title).join(" · ") || "일부 기준"}은 새 공식 업데이트가 들어올 때 다시 비교할 관찰 축입니다. ${profile.next_action || "알림 기준을 켜두면 변화가 생겼을 때 다시 확인합니다."}`
          : `자동 CRS ${crsScore}점 기준으로, 나이·학력·언어·경력이 공식 업데이트 해석에 영향을 줍니다. ${profile.next_action || "새 공식 업데이트가 오면 알림 기준에 따라 다시 비교합니다."}`,
        chip: `${crsScore}점`,
        tone: "teal",
      },
      {
        title: "내 BC PNP 영향",
        meta: `${diagnosisState} · BC PNP 준비 상태`,
        body: needsOccupationChoice
          ? `직업군이 ${occupation} 상태라 BC PNP 준비 상태를 좁히기 어렵습니다. ${recommendedOccupationGroups.join(" · ")} 중 가장 가까운 직업군을 선택하면 EE와 PNP가 함께 다시 계산됩니다.`
          : `BC PNP 준비 상태 ${bcFit}/100${bcRange ? `, 추정 등록 점수대 ${bcRange[0]}-${bcRange[1]}점` : ""}. 스트림 ${stream} / 카테고리 ${category} / 잡오퍼 ${jobOffer} / 고용주 지원 ${employerSupport}를 함께 봅니다.`,
        chip: needsOccupationChoice ? "직업군 선택 필요" : hasBlockingInputs ? "관찰 기준" : `${bcFit}/100`,
        tone: needsOccupationChoice || hasBlockingInputs ? "rose" : "gold",
      },
      {
        title: "내 직업군/TEER 관련성",
        meta: `${diagnosisState} · 직무 연결성`,
        body: needsOccupationChoice || needsEeCategory
          ? `직업군 ${occupation}, EE 카테고리 ${eeCategory} 기준을 더 좁히면 공식 업데이트가 BC PNP와 EE 중 어디에 더 크게 닿는지 분리됩니다.`
          : `직업군 ${occupation}, TEER ${teer}, EE 카테고리 ${eeCategory} 기준으로 BC PNP와 Express Entry 영향을 함께 비교합니다.`,
        chip: needsOccupationChoice || needsEeCategory ? "선택 필요" : `${occupation} · ${teer}`,
        tone: needsOccupationChoice || needsEeCategory ? "rose" : "slate",
      },
      {
        title: "다음 확인 행동",
        meta: `${diagnosisState} · 추천 행동`,
        body: hasBlockingInputs
          ? `${diagnostics?.blocking_inputs?.slice(0, 3).map((item) => item.title).join(" · ") || "관찰 기준"}은 새 기사 업데이트 때 다시 비교할 기준입니다. 알림을 켜두면 변화가 생겼을 때 오늘의 브리핑과 신호에서 다시 보여줍니다.`
          : profile.next_action || "새 공식 업데이트가 오면 알림 기준에 따라 다시 비교합니다.",
        chip: "다음 단계",
        tone: "teal",
      },
    ],
  };
}
