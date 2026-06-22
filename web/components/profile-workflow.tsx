"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Save } from "lucide-react";
import { MiniTag, TimelineItem, mutedTextClass, panelClass, primaryActionClass, secondaryActionClass } from "@/components/redesign-shell";
import type { CompassProfileResponse } from "@/lib/compass-data";

type ProfileTab = "common" | "bc" | "ee";

type ProfileDraft = {
  birth_date: string;
  marital_status: string;
  current_status: string;
  target_route: string;
  education_level: string;
  eca_status: boolean | null;
  canadian_education: string;
  sibling_in_canada: boolean | null;
  language_score: string;
  language_test: string;
  language_speaking_clb: string;
  language_listening_clb: string;
  language_reading_clb: string;
  language_writing_clb: string;
  work_experience_years: string;
  canadian_experience_years: string;
  foreign_experience_years: string;
  noc_teer: string;
  french_score: string;
  ee_category_interest: string;
  ee_profile_status: string;
  ee_profile_notes: string;
  arranged_employment: boolean | null;
  employer_support: boolean | null;
  bc_pnp_stream_interest: string;
  bc_pnp_category_interest: string;
  bc_connection_type: string;
  bc_connection: string;
  bc_job_offer: string;
  bc_occupation_focus: string;
  province_nomination_interest: boolean | null;
  profile_notes: string;
};

type FieldOption = { label: string; value: string | boolean };
type FieldDefinition =
  | {
      key: keyof ProfileDraft;
      label: string;
      hint: string;
      kind: "select" | "segmented";
      options: FieldOption[];
      tab: ProfileTab;
    }
  | {
      key: keyof ProfileDraft;
      label: string;
      hint: string;
      kind: "number" | "date";
      min: number;
      max: number;
      suffix?: string;
      tab: ProfileTab;
    }
  | {
      key: keyof ProfileDraft;
      label: string;
      hint: string;
      kind: "binary";
      options: [FieldOption, FieldOption];
      tab: ProfileTab;
    };

type ProfileWorkflowProps = {
  profileBundle: CompassProfileResponse;
  onSaved?: () => void;
  onClose?: () => void;
  showIntro?: boolean;
};

const tabs: Array<{ id: ProfileTab; label: string; subtitle: string }> = [
  { id: "common", label: "공통", subtitle: "CRS/PNP가 함께 쓰는 기준값" },
  { id: "bc", label: "BC PNP", subtitle: "BC 연결, 잡오퍼, 고용주" },
  { id: "ee", label: "Express Entry", subtitle: "EE 전용 추가 조건" },
];

const fields: FieldDefinition[] = [
  {
    tab: "common",
    key: "birth_date",
    label: "생년월일",
    hint: "Vancouver 기준 만 나이를 자동 계산합니다.",
    kind: "date",
    min: 1900,
    max: 2100,
  },
  {
    tab: "common",
    key: "marital_status",
    label: "혼인 상태",
    hint: "CRS 배우자 기준을 나누기 위해 필요합니다.",
    kind: "segmented",
    options: [
      { label: "미혼", value: "single" },
      { label: "기혼/사실혼", value: "married" },
      { label: "기타", value: "other" },
    ],
  },
  {
    tab: "common",
    key: "current_status",
    label: "현재 상태",
    hint: "거주/체류 상태는 경로 우선순위를 바꿉니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "BC 워크퍼밋", value: "BC · work permit" },
      { label: "캐나다 학생비자", value: "Canada · study permit" },
      { label: "캐나다 방문 상태", value: "Canada · visitor" },
      { label: "캐나다 밖 거주", value: "Outside Canada" },
    ],
  },
  {
    tab: "common",
    key: "education_level",
    label: "학력",
    hint: "연방 점수와 주정부 준비도에 들어갑니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "고등학교", value: "High school" },
      { label: "전문학사/디플로마", value: "Diploma" },
      { label: "학사", value: "Bachelor" },
      { label: "석사", value: "Master" },
      { label: "박사", value: "PhD" },
    ],
  },
  {
    tab: "common",
    key: "eca_status",
    label: "ECA/WES 평가",
    hint: "ECA는 공식 학력평가의 상위 개념이고, WES는 대표 평가기관입니다.",
    kind: "binary",
    options: [
      { label: "완료", value: true },
      { label: "대기", value: false },
    ],
  },
  {
    tab: "common",
    key: "work_experience_years",
    label: "해외 경력",
    hint: "0-30년 범위의 숫자로만 받아 계산에 씁니다.",
    kind: "number",
    min: 0,
    max: 30,
    suffix: "년",
  },
  {
    tab: "common",
    key: "canadian_experience_years",
    label: "캐나다 경력",
    hint: "연 단위로 받아 CEC 전환점을 추적합니다.",
    kind: "number",
    min: 0,
    max: 15,
    suffix: "년",
  },
  {
    tab: "common",
    key: "language_score",
    label: "영어 CLB",
    hint: "CRS와 BC PNP가 함께 쓰는 공통 언어 기준입니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "CLB 7 미만", value: "Below CLB 7" },
      { label: "CLB 7", value: "CLB 7" },
      { label: "CLB 8", value: "CLB 8" },
      { label: "CLB 9", value: "CLB 9" },
      { label: "CLB 10+", value: "CLB 10+" },
    ],
  },
  {
    tab: "common",
    key: "language_test",
    label: "언어 시험",
    hint: "공식 시험 종류를 고정해 계산 신뢰도를 높입니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "IELTS", value: "IELTS" },
      { label: "CELPIP", value: "CELPIP" },
      { label: "TEF", value: "TEF" },
      { label: "TCF", value: "TCF" },
      { label: "PTE Core", value: "PTE Core" },
    ],
  },
  {
    tab: "common",
    key: "language_speaking_clb",
    label: "Speaking CLB",
    hint: "공식 CRS 계산에 가까워지도록 말하기 점수를 따로 받습니다.",
    kind: "select",
    options: [
      { label: "전체 CLB와 동일", value: "" },
      { label: "CLB 7 미만", value: "Below CLB 7" },
      { label: "CLB 7", value: "CLB 7" },
      { label: "CLB 8", value: "CLB 8" },
      { label: "CLB 9", value: "CLB 9" },
      { label: "CLB 10+", value: "CLB 10+" },
    ],
  },
  {
    tab: "common",
    key: "language_listening_clb",
    label: "Listening CLB",
    hint: "듣기 점수가 다르면 CRS 언어 점수와 전환성 점수가 달라집니다.",
    kind: "select",
    options: [
      { label: "전체 CLB와 동일", value: "" },
      { label: "CLB 7 미만", value: "Below CLB 7" },
      { label: "CLB 7", value: "CLB 7" },
      { label: "CLB 8", value: "CLB 8" },
      { label: "CLB 9", value: "CLB 9" },
      { label: "CLB 10+", value: "CLB 10+" },
    ],
  },
  {
    tab: "common",
    key: "language_reading_clb",
    label: "Reading CLB",
    hint: "읽기 점수를 별도로 저장해 공식 calculator와의 차이를 줄입니다.",
    kind: "select",
    options: [
      { label: "전체 CLB와 동일", value: "" },
      { label: "CLB 7 미만", value: "Below CLB 7" },
      { label: "CLB 7", value: "CLB 7" },
      { label: "CLB 8", value: "CLB 8" },
      { label: "CLB 9", value: "CLB 9" },
      { label: "CLB 10+", value: "CLB 10+" },
    ],
  },
  {
    tab: "common",
    key: "language_writing_clb",
    label: "Writing CLB",
    hint: "쓰기 점수를 별도로 저장해 공식 calculator와의 차이를 줄입니다.",
    kind: "select",
    options: [
      { label: "전체 CLB와 동일", value: "" },
      { label: "CLB 7 미만", value: "Below CLB 7" },
      { label: "CLB 7", value: "CLB 7" },
      { label: "CLB 8", value: "CLB 8" },
      { label: "CLB 9", value: "CLB 9" },
      { label: "CLB 10+", value: "CLB 10+" },
    ],
  },
  {
    tab: "common",
    key: "french_score",
    label: "프랑스어 NCLC",
    hint: "프랑스어는 EE 카테고리와 CRS 추가점에 함께 쓰입니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "없음", value: "None" },
      { label: "NCLC 5-6", value: "NCLC 5-6" },
      { label: "NCLC 7", value: "NCLC 7" },
      { label: "NCLC 8+", value: "NCLC 8+" },
      { label: "NCLC 9+", value: "NCLC 9+" },
    ],
  },
  {
    tab: "common",
    key: "bc_occupation_focus",
    label: "직업군",
    hint: "먼저 공통 직업군을 고르면 EE 카테고리와 PNP 판단을 이어서 좁힙니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "기술/소프트웨어", value: "Tech / Software" },
      { label: "디자인/프로덕트", value: "Design / Product" },
      { label: "헬스케어", value: "Healthcare" },
      { label: "건설/기능직", value: "Construction" },
      { label: "교육/보육", value: "Education" },
      { label: "서비스/접객/운영", value: "Service / Hospitality / Operations" },
      { label: "행정/사무/고객지원", value: "Admin / Office / Customer Support" },
      { label: "운송/물류", value: "Transport / Logistics" },
      { label: "제조/농식품", value: "Manufacturing / Agri-food" },
      { label: "가장 가까운 직군 찾기 필요", value: "Other" },
    ],
  },
  {
    tab: "common",
    key: "noc_teer",
    label: "TEER",
    hint: "EE와 PNP 모두 직무 수준을 볼 때 쓰는 공통 기준입니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "TEER 0", value: "TEER 0" },
      { label: "TEER 1", value: "TEER 1" },
      { label: "TEER 2", value: "TEER 2" },
      { label: "TEER 3", value: "TEER 3" },
      { label: "TEER 4", value: "TEER 4" },
      { label: "TEER 5", value: "TEER 5" },
      { label: "모름", value: "Unknown" },
    ],
  },
  {
    tab: "common",
    key: "target_route",
    label: "관심 경로",
    hint: "현재 우선순위를 구조화해서 저장합니다.",
    kind: "segmented",
    options: [
      { label: "BC PNP", value: "BC PNP" },
      { label: "Express Entry", value: "Express Entry" },
      { label: "둘 다 비교", value: "Both" },
    ],
  },
  {
    tab: "ee",
    key: "canadian_education",
    label: "캐나다 학력",
    hint: "캐나다 학력 추가점을 구조화해서 계산합니다.",
    kind: "select",
    options: [
      { label: "없음", value: "None" },
      { label: "1-2년 과정", value: "1-2 years" },
      { label: "3년 이상", value: "3+ years" },
    ],
  },
  {
    tab: "ee",
    key: "sibling_in_canada",
    label: "캐나다 형제/자매",
    hint: "캐나다 시민권자/영주권자 형제자매 여부입니다.",
    kind: "binary",
    options: [
      { label: "있음", value: true },
      { label: "없음", value: false },
    ],
  },
  {
    tab: "bc",
    key: "bc_connection_type",
    label: "BC 연결 유형",
    hint: "BC와의 관계를 하나의 버킷으로 고정합니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "BC 잡오퍼", value: "BC job offer" },
      { label: "BC 근무 이력", value: "BC work history" },
      { label: "BC 학업", value: "BC study" },
      { label: "가족/커뮤니티", value: "Family / community" },
      { label: "명확한 연결 없음", value: "No clear connection" },
    ],
  },
  {
    tab: "bc",
    key: "bc_connection",
    label: "BC 연결 상세",
    hint: "고용주, 학업, 생활 연결을 한 단계 더 구체화합니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "고용주 지원", value: "Employer support" },
      { label: "잡오퍼", value: "Job offer" },
      { label: "BC 학업", value: "BC study" },
      { label: "BC 근무 이력", value: "BC work history" },
      { label: "가족/커뮤니티", value: "Family / community" },
      { label: "기타", value: "Other" },
    ],
  },
  {
    tab: "bc",
    key: "bc_pnp_stream_interest",
    label: "BC PNP 스트림",
    hint: "카테고리 이전에 스트림 가족을 먼저 고정합니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "Skills Immigration", value: "Skills Immigration" },
      { label: "Tech", value: "Tech" },
      { label: "헬스케어", value: "Healthcare" },
      { label: "보육", value: "Childcare" },
      { label: "건설", value: "Construction" },
      { label: "창업", value: "Entrepreneur" },
      { label: "지역", value: "Regional" },
    ],
  },
  {
    tab: "bc",
    key: "bc_pnp_category_interest",
    label: "BC PNP 카테고리",
    hint: "현재 해석을 특정 우선 카테고리에 묶습니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "Tech", value: "Tech" },
      { label: "헬스케어", value: "Healthcare" },
      { label: "보육", value: "Childcare" },
      { label: "건설", value: "Construction" },
      { label: "기능직", value: "Trade" },
      { label: "지역", value: "Regional" },
      { label: "창업", value: "Entrepreneur" },
      { label: "일반", value: "General" },
    ],
  },
  {
    tab: "bc",
    key: "bc_job_offer",
    label: "BC 잡오퍼",
    hint: "잡오퍼는 BC 경로의 즉시성 판단에 쓰입니다.",
    kind: "segmented",
    options: [
      { label: "있음", value: "Yes" },
      { label: "진행 중", value: "Pending" },
      { label: "없음", value: "No" },
    ],
  },
  {
    tab: "bc",
    key: "employer_support",
    label: "고용주 지원",
    hint: "BC 경로의 핵심 보조 신호입니다.",
    kind: "binary",
    options: [
      { label: "있음", value: true },
      { label: "없음", value: false },
    ],
  },
  {
    tab: "ee",
    key: "ee_category_interest",
    label: "EE 카테고리",
    hint: "카테고리 기반 초청 해석을 구조화합니다.",
    kind: "select",
    options: [
      { label: "선택 안 함", value: "" },
      { label: "CEC", value: "CEC" },
      { label: "FSW", value: "FSW" },
      { label: "FST", value: "FST" },
      { label: "프랑스어", value: "French" },
      { label: "STEM", value: "STEM" },
      { label: "헬스케어", value: "Healthcare" },
      { label: "기능직", value: "Trades" },
      { label: "PNP", value: "PNP" },
      { label: "잘 모름", value: "Not sure" },
    ],
  },
  {
    tab: "ee",
    key: "ee_profile_status",
    label: "EE 프로필 상태",
    hint: "프로필이 제출/준비/비활성 중 어디인지 표시합니다.",
    kind: "segmented",
    options: [
      { label: "제출됨", value: "제출됨" },
      { label: "준비 중", value: "준비 중" },
      { label: "없음", value: "없음" },
    ],
  },
  {
    tab: "ee",
    key: "arranged_employment",
    label: "고용 확정",
    hint: "연방 점수와 안정성 판단에 쓰는 이진값입니다.",
    kind: "binary",
    options: [
      { label: "있음", value: true },
      { label: "없음", value: false },
    ],
  },
  {
    tab: "ee",
    key: "province_nomination_interest",
    label: "PNP 관심",
    hint: "프로빈셜 노미네이션을 함께 볼지 지정합니다.",
    kind: "binary",
    options: [
      { label: "있음", value: true },
      { label: "없음", value: false },
    ],
  },
];

const defaultDraft: ProfileDraft = {
  birth_date: "",
  marital_status: "",
  current_status: "",
  target_route: "Both",
  education_level: "",
  eca_status: null,
  canadian_education: "None",
  sibling_in_canada: null,
  language_score: "",
  language_test: "",
  language_speaking_clb: "",
  language_listening_clb: "",
  language_reading_clb: "",
  language_writing_clb: "",
  work_experience_years: "",
  canadian_experience_years: "",
  foreign_experience_years: "",
  noc_teer: "",
  french_score: "",
  ee_category_interest: "",
  ee_profile_status: "",
  ee_profile_notes: "",
  arranged_employment: null,
  employer_support: null,
  bc_pnp_stream_interest: "",
  bc_pnp_category_interest: "",
  bc_connection_type: "",
  bc_connection: "",
  bc_job_offer: "",
  bc_occupation_focus: "",
  province_nomination_interest: null,
  profile_notes: "",
};

function buildDraft(profileBundle: CompassProfileResponse): ProfileDraft {
  const profile = (profileBundle.profile || {}) as Partial<ProfileDraft>;
  return {
    ...defaultDraft,
    ...profile,
    eca_status: typeof profile.eca_status === "boolean" ? profile.eca_status : null,
    sibling_in_canada: typeof profile.sibling_in_canada === "boolean" ? profile.sibling_in_canada : null,
    arranged_employment: typeof profile.arranged_employment === "boolean" ? profile.arranged_employment : null,
    employer_support: typeof profile.employer_support === "boolean" ? profile.employer_support : null,
    province_nomination_interest: typeof profile.province_nomination_interest === "boolean" ? profile.province_nomination_interest : null,
  };
}

function savePayload(draft: ProfileDraft) {
  return {
    birth_date: draft.birth_date,
    marital_status: draft.marital_status,
    current_status: draft.current_status,
    target_route: draft.target_route,
    education_level: draft.education_level,
    eca_status: draft.eca_status,
    canadian_education: draft.canadian_education,
    sibling_in_canada: draft.sibling_in_canada,
    language_score: draft.language_score,
    language_test: draft.language_test,
    language_speaking_clb: draft.language_speaking_clb,
    language_listening_clb: draft.language_listening_clb,
    language_reading_clb: draft.language_reading_clb,
    language_writing_clb: draft.language_writing_clb,
    work_experience_years: draft.work_experience_years,
    canadian_experience_years: draft.canadian_experience_years,
    foreign_experience_years: draft.foreign_experience_years,
    noc_teer: draft.noc_teer,
    french_score: draft.french_score,
    ee_category_interest: draft.ee_category_interest,
    ee_profile_status: draft.ee_profile_status,
    ee_profile_notes: draft.ee_profile_notes,
    arranged_employment: draft.arranged_employment,
    employer_support: draft.employer_support,
    bc_pnp_stream_interest: draft.bc_pnp_stream_interest,
    bc_pnp_category_interest: draft.bc_pnp_category_interest,
    bc_connection_type: draft.bc_connection_type,
    bc_connection: draft.bc_connection,
    bc_job_offer: draft.bc_job_offer,
    bc_occupation_focus: draft.bc_occupation_focus,
    province_nomination_interest: draft.province_nomination_interest,
    profile_notes: draft.profile_notes,
  };
}

const requiredDraftFields: Array<{ key: keyof ProfileDraft; label: string }> = [
  { key: "birth_date", label: "생년월일" },
  { key: "marital_status", label: "혼인 상태" },
  { key: "current_status", label: "현재 체류/거주 상태" },
  { key: "education_level", label: "학력" },
  { key: "eca_status", label: "ECA/WES 평가" },
  { key: "work_experience_years", label: "해외 경력" },
  { key: "canadian_experience_years", label: "캐나다 경력" },
  { key: "language_score", label: "영어 CLB" },
  { key: "language_test", label: "언어 시험" },
  { key: "french_score", label: "프랑스어 NCLC" },
  { key: "ee_category_interest", label: "EE 카테고리" },
  { key: "bc_occupation_focus", label: "직업군" },
  { key: "noc_teer", label: "TEER" },
  { key: "bc_connection_type", label: "BC 연결 유형" },
  { key: "bc_job_offer", label: "BC 잡오퍼" },
  { key: "employer_support", label: "고용주 지원" },
  { key: "bc_pnp_stream_interest", label: "BC PNP 스트림" },
  { key: "bc_pnp_category_interest", label: "BC PNP 카테고리" },
];

function missingRequiredFields(draft: ProfileDraft) {
  return requiredDraftFields.filter((field) => !String(draft[field.key] ?? "").trim());
}

function calculationState(draft: ProfileDraft) {
  const missing = missingRequiredFields(draft);
  const completed = requiredDraftFields.length - missing.length;
  const confidence = Math.round((completed / requiredDraftFields.length) * 100);
  if (missing.length) {
    return {
      label: "개인화 잠금",
      tone: "rose" as const,
      detail: `필수 항목 ${missing.length}개가 남아 있습니다. 저장 없이 공식 브리핑만 볼 수 있습니다.`,
      confidence,
    };
  }
  const exactCount = [draft.birth_date, draft.language_score, draft.education_level, draft.eca_status !== null ? "yes" : "", draft.work_experience_years].filter(Boolean).length;
  const estimateCount = [draft.bc_occupation_focus, draft.bc_connection_type, draft.bc_job_offer, draft.canadian_experience_years, draft.french_score].filter(Boolean).length;
  if (exactCount + estimateCount >= 8) {
    return {
      label: "자동 비교 가능",
      tone: "teal" as const,
      detail: "CRS는 자동 계산하고, BC PNP는 적합도와 추정 점수대를 분리해서 비교합니다.",
      confidence: Math.max(84, confidence),
    };
  }
  if (exactCount + estimateCount >= 4) {
    return {
      label: "추정 점수대",
      tone: "gold" as const,
      detail: "일부 항목이 부족해 범위와 신뢰도로 먼저 보여줍니다.",
      confidence: 62,
    };
  }
  return {
    label: "입력 부족",
    tone: "rose" as const,
    detail: "최소 입력을 채우면 CRS/PNP 비교와 직업군별 추천이 열립니다.",
    confidence: 32,
  };
}

function occupationGuidance(draft: ProfileDraft) {
  const occupation = String(draft.bc_occupation_focus || "").toLowerCase();
  const base = {
    title: "직업군을 먼저 고르면 EE와 PNP 선택이 쉬워집니다",
    body: "공통 탭에서 가장 가까운 직업군을 선택하면, BC PNP 카테고리와 EE 카테고리를 같은 기준으로 이어서 좁힐 수 있습니다.",
    ee: "EE 카테고리는 직업군 선택 후 CEC/FSW/카테고리 기반 초청 중 가까운 축을 고릅니다.",
    pnp: "BC PNP는 직업군, TEER, 잡오퍼, 고용주 지원을 함께 봅니다.",
  };
  if (!occupation || occupation === "other") {
    return {
      ...base,
      title: occupation === "other" ? "가장 가까운 직업군을 다시 골라야 합니다" : base.title,
      body: occupation === "other" ? "기타 상태에서는 점수보다 재분류가 먼저입니다. 서비스/접객/운영, 행정/고객지원, 운송/물류, 제조/농식품 중 가까운 축이 있는지 먼저 확인하세요." : base.body,
    };
  }
  if (occupation.includes("tech") || occupation.includes("software") || occupation.includes("design")) {
    return {
      title: "기술/디지털 직군 기준",
      body: "Tech/STEM 신호와 매칭될 수 있지만, TEER와 실제 NOC가 맞아야 개인 영향이 선명해집니다.",
      ee: "EE에서는 STEM 또는 CEC/FSW 중 실제 경력과 점수에 맞는 카테고리를 확인하세요.",
      pnp: "BC PNP에서는 Tech 또는 Skills Immigration 계열과 잡오퍼/고용주 지원을 함께 확인하세요.",
    };
  }
  if (occupation.includes("health")) {
    return {
      title: "헬스케어 직군 기준",
      body: "헬스케어 신호는 강할 수 있지만, 면허/직무명/TEER 확인 전에는 개인 영향이 추정으로 남습니다.",
      ee: "EE에서는 Healthcare 카테고리와 CEC/FSW 가능성을 함께 확인하세요.",
      pnp: "BC PNP에서는 Healthcare 카테고리, 고용주 지원, BC 잡오퍼가 핵심입니다.",
    };
  }
  if (occupation.includes("service") || occupation.includes("hospitality") || occupation.includes("operations")) {
    return {
      title: "서비스/접객/운영 직군 기준",
      body: "서비스직은 한 묶음으로 단정하기 어렵습니다. TEER, 고용주, 지역 연결, 실제 직무명을 먼저 좁혀야 합니다.",
      ee: "EE에서는 CEC/FSW 가능성과 CLB 보강 여지를 먼저 봅니다. 직업 카테고리 초청은 실제 NOC 확인 후 판단합니다.",
      pnp: "BC PNP에서는 Skills Immigration, 지역/고용주 연결, 잡오퍼 상태가 핵심입니다.",
    };
  }
  if (occupation.includes("construction") || occupation.includes("transport") || occupation.includes("manufacturing")) {
    return {
      title: "기능/현장 직군 기준",
      body: "Trade/TEER/고용주 지원 여부에 따라 경로가 크게 달라집니다.",
      ee: "EE에서는 Trades 또는 CEC/FSW 조건을 실제 경력 기준으로 확인하세요.",
      pnp: "BC PNP에서는 Construction/Trade/Regional 신호와 잡오퍼를 우선 확인하세요.",
    };
  }
  return base;
}

export function ProfileWorkflow({ profileBundle, onSaved, onClose, showIntro = true }: ProfileWorkflowProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>("common");
  const [draft, setDraft] = useState<ProfileDraft>(() => buildDraft(profileBundle));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const missingRequired = useMemo(() => missingRequiredFields(draft), [draft]);
  const progress = `${Math.round(((requiredDraftFields.length - missingRequired.length) / requiredDraftFields.length) * 100)}%`;
  const routeProfiles = profileBundle.route_profiles || {};
  const strongestRoute = profileBundle.strongest_route || "Express Entry";
  const routeProfile = strongestRoute === "BC PNP" ? routeProfiles.bc_pnp : routeProfiles.express_entry;
  const activeFields = fields.filter((field) => field.tab === activeTab);
  const calcState = useMemo(() => calculationState(draft), [draft]);
  const occupationHelp = useMemo(() => occupationGuidance(draft), [draft]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleSave() {
    if (missingRequired.length) {
      setNotice(`저장하지 않았습니다. 필수 항목 ${missingRequired.map((item) => item.label).slice(0, 4).join(", ")}${missingRequired.length > 4 ? ` 외 ${missingRequired.length - 4}개` : ""}를 완료해 주세요.`);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(savePayload(draft)),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.message || payload?.detail?.message || `프로필 저장 실패: ${response.status}`;
        throw Object.assign(new Error(message), { fieldErrors: payload?.fieldErrors || {} });
      }
      setNotice("프로필이 저장되었습니다. CRS/PNP 비교와 개인 영향이 잠금 해제되었습니다.");
      router.refresh();
      onSaved?.();
    } catch (error) {
      const fieldErrors = error && typeof error === "object" && "fieldErrors" in error ? (error as { fieldErrors?: Record<string, string> }).fieldErrors : {};
      if (fieldErrors?.birth_date) {
        setNotice(fieldErrors.birth_date);
      } else {
        setNotice(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <section className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">프로필 상태</p>
          <h3 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">구조화 입력</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <MiniTag tone={profileBundle.profile_complete ? "teal" : profileBundle.updated_at ? "gold" : "rose"}>{profileBundle.profile_complete ? "연결됨" : profileBundle.updated_at ? "진행 중" : "미등록"}</MiniTag>
              <span className="text-[11px] font-semibold text-[rgba(245,247,251,0.56)]">진행도 {progress}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#b69a45]" style={{ width: progress }} />
            </div>
            <p className={`text-[12px] leading-[1.6] ${mutedTextClass}`}>
              {missingRequired.length ? "필수 입력을 모두 끝내야 개인화 대시보드가 열립니다. 부분 저장은 하지 않습니다." : profileBundle.position_explanation || "프로필은 구조화된 값만 저장하고, 공식 계산과 해석 결과는 분리해서 처리합니다."}
            </p>
            <div className="rounded-[13px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))] p-3.5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#d5bd6a]">계산 나이</p>
              <p className="text-[13px] font-semibold text-[#f5f7fb]">{profileBundle.age !== undefined && profileBundle.age !== null ? `${profileBundle.age}세` : "대기"}</p>
              <p className={`mt-1 text-[11.5px] leading-[1.5] ${mutedTextClass}`}>{profileBundle.age_basis || "생년월일 기준으로 계산합니다."}</p>
            </div>
            {missingRequired.length ? (
              <div className="rounded-[13px] border border-[#f2a36b]/25 bg-[#f2a36b]/10 p-3">
                <p className="text-[11px] font-bold text-[#ffd3ac]">남은 필수 항목</p>
                <p className="mt-1 text-[11px] leading-[1.55] text-[rgba(245,247,251,0.68)]">
                  {missingRequired.map((item) => item.label).slice(0, 5).join(", ")}
                  {missingRequired.length > 5 ? ` 외 ${missingRequired.length - 5}개` : ""}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[14px] border px-3 py-3 text-left transition ${
                activeTab === tab.id ? "border-[#b69a45]/55 bg-[#b69a45]/14" : "border-white/10 bg-white/[0.045] hover:border-white/16"
              }`}
            >
              <p className="text-[13px] font-semibold text-[#f5f7fb]">{tab.label}</p>
              <p className={`mt-1 text-[11px] leading-[1.45] ${mutedTextClass}`}>{tab.subtitle}</p>
            </button>
          ))}
        </div>

        <section className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">요약</p>
          <h3 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">저장 후 연결</h3>
          <div className="grid gap-3">
            <div className="rounded-[13px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))] p-3.5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#d5bd6a]">최강 경로</p>
              <p className="text-[13px] font-semibold text-[#f5f7fb]">{strongestRoute}</p>
              <p className={`mt-1 text-[11.5px] leading-[1.5] ${mutedTextClass}`}>{routeProfile?.summary || "저장 후 경로 요약이 표시됩니다."}</p>
            </div>
            <div className="rounded-[13px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))] p-3.5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#d5bd6a]">다음 행동</p>
              <p className="text-[13px] font-semibold text-[#f5f7fb]">{profileBundle.next_action || "프로필을 저장하면 다음 행동이 계산됩니다."}</p>
            </div>
          </div>
        </section>
      </aside>

      <section className="space-y-4">
        {showIntro ? (
          <section className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">프로필 입력</p>
            <h3 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">프로필은 구조화 컨트롤로만 수집합니다</h3>
            <p className={`text-[13px] leading-[1.7] ${mutedTextClass}`}>
              자유 텍스트는 해석 메모로만 남기고, 경로 판단은 선택형/날짜형/숫자형 값으로만 계산합니다. 저장 후에는 오늘의 브리핑과 경로 비교가 즉시 다시 계산됩니다.
            </p>
          </section>
        ) : null}

        <section className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">계산 상태</p>
              <h3 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">{calcState.label}</h3>
            </div>
            <MiniTag tone={calcState.tone}>신뢰도 {calcState.confidence}%</MiniTag>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#b69a45]" style={{ width: `${calcState.confidence}%` }} />
          </div>
          <p className={`mt-3 text-[13px] leading-[1.65] ${mutedTextClass}`}>{calcState.detail}</p>
        </section>

        <section className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">직업군 연결</p>
          <h3 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">{occupationHelp.title}</h3>
          <p className={`mt-2 text-[13px] leading-[1.65] ${mutedTextClass}`}>{occupationHelp.body}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-[14px] border border-white/10 bg-white/[0.055] p-3">
              <p className="text-[12px] font-bold text-[#f5ecc7]">Express Entry에서 볼 것</p>
              <p className={`mt-1 text-[12px] leading-[1.55] ${mutedTextClass}`}>{occupationHelp.ee}</p>
            </div>
            <div className="rounded-[14px] border border-white/10 bg-white/[0.055] p-3">
              <p className="text-[12px] font-bold text-[#f5ecc7]">BC PNP에서 볼 것</p>
              <p className={`mt-1 text-[12px] leading-[1.55] ${mutedTextClass}`}>{occupationHelp.pnp}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">현재 탭</p>
          <h3 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">{tabs.find((tab) => tab.id === activeTab)?.label || "프로필"}</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeFields.map((field) => (
              <FieldControl key={String(field.key)} field={field} value={draft[field.key]} onChange={(value) => setDraft({ ...draft, [field.key]: value } as ProfileDraft)} />
            ))}
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[13px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))] p-3.5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#d5bd6a]">현재 상태</p>
            <p className="text-[13px] font-semibold text-[#f5f7fb]">{profileBundle.current_status || "프로필 미등록"}</p>
          </div>
          <div className="rounded-[13px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))] p-3.5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#d5bd6a]">적합도 상태</p>
            <p className="text-[13px] font-semibold text-[#f5f7fb]">{profileBundle.fit_label || "프로필 필요"}</p>
          </div>
          <div className="rounded-[13px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))] p-3.5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#d5bd6a]">가장 큰 공백</p>
            <p className="text-[13px] font-semibold text-[#f5f7fb]">{profileBundle.main_blocker || "없음"}</p>
          </div>
        </div>

        {profileBundle.missing_requirements?.length ? (
          <section className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">막힘</p>
            <h3 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">아직 필요한 항목</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {profileBundle.missing_requirements.slice(0, 4).map((item) => (
                <div key={item.title} className="rounded-[14px] border border-white/10 bg-white/[0.055] p-3">
                  <p className="text-[13px] font-semibold text-[#f5f7fb]">{item.title}</p>
                  <p className={`mt-1 text-[11.5px] leading-[1.5] ${mutedTextClass}`}>{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {showIntro ? (
          <section className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">흐름</p>
            <h3 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">저장 후 바로 이어지는 것</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <TimelineItem index={1} title="프로필 저장" body="선택형, 날짜형, 숫자형 값만 서버에 저장합니다." />
              <TimelineItem index={2} title="개인화 재계산" body="BC PNP와 Express Entry가 다시 비교됩니다." />
              <TimelineItem index={3} title="브리핑 갱신" body="오늘의 브리핑, 근거, 신호, 로드맵이 다시 연결됩니다." />
            </div>
          </section>
        ) : null}

        {notice ? (
          <div className="rounded-[16px] border border-[#70e4b0]/35 bg-[#10221d] px-4 py-3 text-[13px] text-[#c9f8e4] shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
            {notice}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {onClose ? (
            <button type="button" className={secondaryActionClass} onClick={onClose}>
              닫기
            </button>
          ) : null}
          <button type="button" className={`${primaryActionClass} ${missingRequired.length ? "opacity-60" : ""}`} disabled={saving} onClick={handleSave}>
            {saving ? (
              <>
                <Clock3 className="mr-2 h-4 w-4" />
                저장 중
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                저장하고 이어보기
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: string | boolean | null) => void;
}) {
  return (
    <div className={panelClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-[#d5bd6a]">{field.label}</p>
          <p className={`mt-1 text-[11px] leading-[1.45] ${mutedTextClass}`}>{field.hint}</p>
        </div>
        <MiniTag tone={field.kind === "number" ? "gold" : field.kind === "binary" ? "teal" : "slate"}>
          {field.kind === "binary" ? "토글" : field.kind === "number" ? "숫자" : field.kind === "segmented" ? "선택" : "목록"}
        </MiniTag>
      </div>

      {field.kind === "select" ? (
        <select
          className="mt-3 h-10 w-full rounded-[12px] border border-white/10 bg-[#0d1016] px-3 text-[13px] font-semibold text-[#f5f7fb] outline-none transition focus:border-[#b69a45]/60"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {field.kind === "segmented" ? (
        <div className="mt-3 grid gap-2">
          {field.options.map((option) => {
            const checked = String(option.value) === String(value ?? "");
            return (
              <label
                key={String(option.value)}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-[12px] border px-3 text-[12px] font-semibold transition ${
                  checked ? "border-[#b69a45]/55 bg-[#b69a45]/14 text-[#f5ecc7]" : "border-white/10 bg-[#0d1016] text-[rgba(245,247,251,0.72)]"
                }`}
              >
                <input className="sr-only" type="radio" name={field.label} checked={checked} onChange={() => onChange(String(option.value))} />
                <span className="h-2 w-2 rounded-full border border-current" />
                {option.label}
              </label>
            );
          })}
        </div>
      ) : null}

      {field.kind === "binary" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {field.options.map((option) => {
            const checked = option.value === value;
            return (
              <label
                key={String(option.value)}
                className={`flex h-10 cursor-pointer items-center justify-center rounded-[12px] border px-3 text-[12px] font-semibold transition ${
                  checked ? "border-[#70e4b0]/45 bg-[#70e4b0]/12 text-[#c9f8e4]" : "border-white/10 bg-[#0d1016] text-[rgba(245,247,251,0.72)]"
                }`}
              >
                <input className="sr-only" type="radio" name={field.label} checked={checked} onChange={() => onChange(option.value)} />
                {option.label}
              </label>
            );
          })}
        </div>
      ) : null}

      {field.kind === "date" ? (
        <input
          className="mt-3 h-10 w-full rounded-[12px] border border-white/10 bg-[#0d1016] px-3 text-[13px] font-semibold text-[#f5f7fb] outline-none transition focus:border-[#b69a45]/60"
          type="date"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {field.kind === "number" ? (
        <div className="mt-3 flex items-center overflow-hidden rounded-[12px] border border-white/10 bg-[#0d1016] focus-within:border-[#b69a45]/60">
          <input
            className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[13px] font-semibold text-[#f5f7fb] outline-none"
            type="number"
            min={field.min}
            max={field.max}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
          />
          {field.suffix ? <span className="border-l border-white/10 px-3 text-[12px] font-semibold text-[rgba(245,247,251,0.58)]">{field.suffix}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
