import { fetchJson } from "@/lib/api";

export async function loadRouteData() {
  const [summary, changes, trends, insights, expressEntry, programOverview, policyOverview, statusOverview, profile] = await Promise.all([
    fetchJson<any>("/api/summary"),
    fetchJson<any[]>("/api/changes"),
    fetchJson<any>("/api/trends"),
    fetchJson<any>("/api/insights"),
    fetchJson<any>("/api/express-entry"),
    fetchJson<any>("/api/program-overview"),
    fetchJson<any>("/api/policy-overview"),
    fetchJson<any>("/api/status-overview"),
    fetchJson<any>("/api/profile"),
  ]);

  return { summary, changes, trends, insights, expressEntry, programOverview, policyOverview, statusOverview, profile };
}

export function buildPreviewProfile(profile: any, mode?: string) {
  if (mode !== "filled") return profile;
  const computedScores = profile.computed_scores || {
    locked: false,
    crs: {
      score: 482,
      status: "계산 점수",
      confidence: 86,
      basis: ["나이", "학력/ECA-WES", "영어 CLB", "캐나다 경력"],
    },
    bc_pnp: {
      fit_score: 82,
      status: "적합도 + 추정 범위",
      estimated_registration_range: [92, 118],
      confidence: 84,
      basis: ["직업군/TEER", "BC 잡오퍼", "고용주 지원", "BC 연결 유형", "학력/경력/언어"],
      missing: [],
    },
    comparison: {
      closer_route: "BC PNP",
      express_entry_fit: 74,
      bc_pnp_fit: 82,
      next_action: "BC PNP와 Express Entry를 나란히 보고, 최신 공식 신호를 함께 확인하세요.",
    },
  };
  return {
    ...profile,
    profile_complete: true,
    fit_label: profile.fit_label || "Strong fit",
    fit_tone: profile.fit_tone || "good",
    current_status: profile.current_status || "프로필 연결됨",
    strongest_route: profile.strongest_route || "BC PNP",
    main_blocker: profile.main_blocker || "없음",
    next_milestone: profile.next_milestone || "다음 카테고리 창 점검",
    next_action: profile.next_action || "다음 신청 단계를 준비하세요.",
    main_status: profile.main_status || "프로필이 연결되어 경로 분석이 열렸습니다.",
    position_explanation: profile.position_explanation || "이 화면은 QA와 디자인 검토를 위한 채워진 미리보기 상태입니다.",
    score: profile.score || "78",
    score_potential: profile.score_potential || "84",
    score_drivers: profile.score_drivers?.length ? profile.score_drivers : ["언어", "경력", "BC 연결"],
    uncertainties: profile.uncertainties?.length ? profile.uncertainties : ["소스 시각", "카테고리 변동"],
    missing_requirements: profile.missing_requirements?.length
      ? profile.missing_requirements
      : [
          { title: "영어 CLB", body: "카드 줄바꿈과 계층을 확인합니다." },
          { title: "경력 증빙", body: "채워진 상태의 레이아웃을 확인합니다." },
        ],
    route_profiles: profile.route_profiles || {
      bc_pnp: {
        route: "BC PNP",
        score: 82,
        fit_label: "적합",
        fit_tone: "good",
        ready: true,
        summary: "BC PNP용 연결된 미리보기 상태입니다.",
        focus: "BC 연결 / 스트림 / 카테고리",
        drivers: ["BC 연결", "직업군 적합", "고용주 지원"],
        signals: ["상승 흐름", "적은 막힘"],
        missing_requirements: [],
      },
      express_entry: {
        route: "Express Entry",
        score: 74,
        fit_label: "주의 관찰",
        fit_tone: "warn",
        ready: true,
        summary: "Express Entry용 연결된 미리보기 상태입니다.",
        focus: "CRS / 언어 / 경력",
        drivers: ["언어", "캐나다 경력", "프랑스어"],
        signals: ["카테고리 관찰", "프로필 유효"],
        missing_requirements: [],
      },
    },
    profile: {
      ...(profile.profile || {}),
      current_status: profile.profile?.current_status || "신청자",
      target_route: profile.profile?.target_route || "BC PNP",
      education_level: profile.profile?.education_level || "학사",
      eca_status: profile.profile?.eca_status ?? true,
      language_score: profile.profile?.language_score || "CLB 9",
      language_test: profile.profile?.language_test || "IELTS",
      work_experience_years: profile.profile?.work_experience_years || "5",
      canadian_experience_years: profile.profile?.canadian_experience_years || "2",
      foreign_experience_years: profile.profile?.foreign_experience_years || "3",
      noc_teer: profile.profile?.noc_teer || "21231",
      french_score: profile.profile?.french_score || "0",
      ee_category_interest: profile.profile?.ee_category_interest || "STEM",
      ee_profile_notes: profile.profile?.ee_profile_notes || "미리보기 상태",
      arranged_employment: profile.profile?.arranged_employment ?? true,
      employer_support: profile.profile?.employer_support ?? true,
      bc_pnp_stream_interest: profile.profile?.bc_pnp_stream_interest || "Tech",
      bc_pnp_category_interest: profile.profile?.bc_pnp_category_interest || "고경제적 영향",
      bc_connection_type: profile.profile?.bc_connection_type || "잡오퍼",
      bc_connection: profile.profile?.bc_connection || "고용주 지원",
      bc_job_offer: profile.profile?.bc_job_offer || "Yes",
      bc_occupation_focus: profile.profile?.bc_occupation_focus || "기술/소프트웨어",
      province_nomination_interest: profile.profile?.province_nomination_interest ?? true,
      profile_notes: profile.profile?.profile_notes || "QA용 채워진 미리보기 상태입니다.",
    },
    computed_scores: computedScores,
  };
}
