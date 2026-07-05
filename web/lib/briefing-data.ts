import { findSubscriptionByToken } from "@/lib/subscription-store";
import { API_BASE_URL } from "@/lib/api";

export type BriefingEvidence = {
  title: string;
  publisher: string;
  date: string;
  url: string;
  note: string;
};

export type BriefingCategorySummary = {
  label: string;
  count: number;
  latest_score?: string | null;
  latest_invitations?: string | null;
  latest_event_date?: string | null;
};

export type BriefingProgramVisuals = {
  recordCount: number;
  latestDraw?: {
    title?: string | null;
    event_date?: string | null;
    stage?: string | null;
    minimum_score?: string | null;
    invitations?: string | null;
  } | null;
  categories: BriefingCategorySummary[];
};

export type BriefingSourceHealth = {
  sourceCount: number;
  okCount: number;
  errorCount: number;
  latestCheckedAt?: string | null;
};

export type BriefingData = {
  mode: "sample" | "subscriber";
  subscriber?: {
    name: string;
    email: string;
    affiliation: string;
  };
  generatedAt: string;
  headline: string;
  updateLabel: string;
  analysisProvider?: "heuristic" | "mini" | "gemini" | string;
  analysisStatus?: "fallback" | "analyzed" | "failed" | string;
  trendDirection?: "strengthening" | "weakening" | "mixed" | "hold";
  confidence?: number;
  latestUpdate: {
    title: string;
    source: string;
    summary: string;
    typeLabel?: string;
    detectedAt?: string;
    sourceUrl?: string;
  };
  updateMeta?: {
    typeLabel: string;
    source: string;
    sourceUrl: string;
    detectedAt: string;
    displayDetectedAt: string;
    basis: string;
  };
  aiSummary: string;
  bcPnpImpact: {
    title: string;
    body: string;
    signal: string;
  };
  expressEntryImpact: {
    title: string;
    body: string;
    signal: string;
  };
  historicalComparison: {
    title: string;
    body: string;
    points: string[];
  };
  watchPoints: string[];
  evidence: BriefingEvidence[];
  dataQualityWarnings?: string[];
  sourceQualityWarnings?: string[];
  analysisWarnings?: string[];
  visuals?: {
    bcPnp: BriefingProgramVisuals;
    expressEntry: BriefingProgramVisuals;
    sourceHealth?: BriefingSourceHealth;
  };
  emailPreview: {
    subject: string;
    intro?: string;
    meta?: string[];
    bullets: string[];
    sourceUrl?: string;
    updateTypeLabel?: string;
  };
};

type ProgramOverviewResponse = {
  bc_pnp?: {
    record_count?: number;
    latest_draw?: BriefingProgramVisuals["latestDraw"];
    category_summary?: BriefingCategorySummary[];
  };
  express_entry?: {
    record_count?: number;
    latest_draw?: BriefingProgramVisuals["latestDraw"];
    category_summary?: BriefingCategorySummary[];
  };
};

type SourceHealthResponse = {
  source_count?: number;
  ok_count?: number;
  error_count?: number;
  latest_checked_at?: string | null;
};

type BackendBriefingResponse = {
  run_id?: string;
  generated_at?: string;
  status?: string;
  provider?: string;
  briefing?: Omit<BriefingData, "mode" | "subscriber">;
};

export function createSampleBriefing(mode: "sample" | "subscriber" = "sample", subscriber?: BriefingData["subscriber"]): BriefingData {
  return {
    mode,
    subscriber,
    generatedAt: "",
    headline: "공식 데이터 연결 후 최신 브리핑이 표시됩니다.",
    updateLabel: mode === "sample" ? "데이터 연결 대기" : "브리핑 대기",
    latestUpdate: {
      title: "아직 표시할 공식 브리핑이 없습니다",
      source: "공식 데이터 연결 대기",
      summary: "배포 환경에서 백엔드 공식 데이터 API가 연결되면 최신 업데이트, 과거 대비 변화, 근거 목록이 이 화면에 표시됩니다.",
    },
    aiSummary: "현재 표시할 AI 해석 데이터가 없습니다. 공식 기록 수집과 브리핑 생성이 완료되면 표시됩니다.",
    bcPnpImpact: {
      title: "BC PNP 데이터 연결 대기",
      body: "BC PNP 공식 기록이 연결되면 카테고리, 초청 수, 최소 점수 흐름을 표시합니다.",
      signal: "데이터 대기",
    },
    expressEntryImpact: {
      title: "Express Entry 데이터 연결 대기",
      body: "Express Entry 공식 라운드 데이터가 연결되면 카테고리, 컷오프, 초청 수 흐름을 표시합니다.",
      signal: "데이터 대기",
    },
    historicalComparison: {
      title: "과거 대비 분석 대기",
      body: "비교 가능한 공식 기록이 로드되면 과거 구간 대비 변화가 표시됩니다.",
      points: [],
    },
    watchPoints: [],
    evidence: [],
    emailPreview: {
      subject: "[PR Compass] 공식 업데이트 브리핑",
      bullets: [
        "새 공식 업데이트가 감지되면 요약 메일이 발송됩니다.",
        "상세 페이지에서는 공식 근거와 AI 해석을 분리해 보여줍니다.",
      ],
    },
  };
}

export async function getBriefingByToken(token: string) {
  const subscription = await findSubscriptionByToken(token);
  if (!subscription) return null;
  return loadOperationalBriefing("subscriber", {
    name: subscription.name,
    email: subscription.email,
    affiliation: subscription.affiliation,
  });
}

export async function loadOperationalBriefing(mode: "sample" | "subscriber" = "sample", subscriber?: BriefingData["subscriber"]): Promise<BriefingData> {
  try {
    const [response, programResponse, sourceHealthResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/briefing/latest`, { cache: "no-store" }),
      fetch(`${API_BASE_URL}/api/program-overview`, { cache: "no-store" }),
      fetch(`${API_BASE_URL}/api/source-health`, { cache: "no-store" }),
    ]);
    if (!response.ok) throw new Error(`briefing latest failed: ${response.status}`);
    const payload = (await response.json()) as BackendBriefingResponse;
    const programPayload = programResponse.ok ? ((await programResponse.json()) as ProgramOverviewResponse) : null;
    const sourceHealthPayload = sourceHealthResponse.ok ? ((await sourceHealthResponse.json()) as SourceHealthResponse) : null;
    if (!payload.briefing) throw new Error("briefing payload missing");
    return {
      ...payload.briefing,
      mode,
      subscriber,
      visuals: buildVisuals(programPayload, sourceHealthPayload) ?? payload.briefing.visuals,
      updateLabel:
        mode === "sample"
          ? `예시 화면 · ${payload.briefing.updateLabel ?? providerDisplayLabel(payload.provider, payload.status)}`
          : payload.briefing.updateLabel ?? providerDisplayLabel(payload.provider, payload.status),
    };
  } catch {
    return createSampleBriefing(mode, subscriber);
  }
}

function buildVisuals(program?: ProgramOverviewResponse | null, sourceHealth?: SourceHealthResponse | null): BriefingData["visuals"] | undefined {
  if (!program) return undefined;
  return {
    bcPnp: {
      recordCount: program.bc_pnp?.record_count ?? 0,
      latestDraw: program.bc_pnp?.latest_draw ?? null,
      categories: program.bc_pnp?.category_summary ?? [],
    },
    expressEntry: {
      recordCount: program.express_entry?.record_count ?? 0,
      latestDraw: program.express_entry?.latest_draw ?? null,
      categories: program.express_entry?.category_summary ?? [],
    },
    sourceHealth: sourceHealth
      ? {
          sourceCount: sourceHealth.source_count ?? 0,
          okCount: sourceHealth.ok_count ?? 0,
          errorCount: sourceHealth.error_count ?? 0,
          latestCheckedAt: sourceHealth.latest_checked_at,
        }
      : undefined,
  };
}

function providerDisplayLabel(provider?: string, status?: string) {
  if (status === "analyzed") {
    if (provider === "agent") return "테스트 에이전트 분석 브리핑";
    if (provider === "mini") return "미니 모델 분석 브리핑";
    if (provider === "gemini") return "Gemini 분석 브리핑";
    return "AI 분석 브리핑";
  }
  return "공식 데이터 기준 브리핑";
}
