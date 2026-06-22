"use client";

import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";
import {
  AppFrame,
  InsightCard,
  MetricCard,
  MiniTag,
  Surface,
  headingClass,
  mutedTextClass,
  panelClass,
  primaryActionClass,
  secondaryActionClass,
} from "@/components/redesign-shell";
import { ProfileWorkflow } from "@/components/profile-workflow";
import { navItems } from "@/lib/redesign-data";
import type { CompassProfileResponse, CompassWorkspaceData, DashboardState } from "@/lib/compass-data";
import { buildPersonalImpactPanels, buildSignalBriefing, deriveDashboardState, latestSignalSummary, profileFillRatio } from "@/lib/compass-data";
import { formatVancouverCheckedLabel } from "@/lib/date-format";

const TOAST_AUTO_DISMISS_MS = 3600;

function sanitizeRouteLabel(label: string | undefined | null) {
  const value = String(label || "관찰");
  return value
    .replaceAll("가능성", "정합")
    .replaceAll("가능", "조건 정합")
    .replaceAll("합격", "보강 필요")
    .trim();
}

const unsetProfileValues = new Set(["", "other", "not sure", "unknown", "none", "미선택", "없음", "기타"]);

function isUnsetProfileValue(value: unknown) {
  return unsetProfileValues.has(String(value ?? "").trim().toLowerCase());
}

function getDiagnostics(profile: CompassProfileResponse) {
  return profile.diagnostics;
}

function buildDecisionGaps(profile: CompassProfileResponse) {
  const diagnostics = getDiagnostics(profile);
  const draft = profile.profile || {};
  const gaps: Array<{ title: string; body: string }> = [];
  if (!profile.profile_complete) {
    gaps.push({ title: "프로필 완료 필요", body: "개인화 경로 판단은 필수 입력 완료 후 열립니다." });
    return gaps;
  }
  if (diagnostics?.blocking_inputs?.length) {
    diagnostics.blocking_inputs.forEach((item) => gaps.push({ title: item.title, body: item.body }));
    return gaps;
  }
  if (!draft.birth_date || profile.age_basis === "legacy age fallback") {
    gaps.push({ title: "생년월일 확인 필요", body: "현재 구형 나이값으로 계산 중입니다. 생년월일을 넣으면 CRS 나이 점수를 고정할 수 있습니다." });
  }
  if (isUnsetProfileValue(draft.bc_occupation_focus)) {
    gaps.push({ title: "직업군 선택 필요", body: "직업군이 기타/미선택이면 BC PNP와 직무 관련 신호를 신뢰도 높게 판단하기 어렵습니다." });
  }
  if (isUnsetProfileValue(draft.ee_category_interest)) {
    gaps.push({ title: "EE 카테고리 선택 필요", body: "카테고리를 모르면 최근 컷오프와 내 CRS를 같은 기준으로 비교하기 어렵습니다." });
  }
  if (String(draft.language_score || "") === "Below CLB 7") {
    gaps.push({ title: "언어 보강 필요", body: "CLB 7 미만이면 Express Entry 경쟁력과 여러 전환성 점수가 크게 제한됩니다." });
  }
  return gaps;
}

function recommendedOccupationGroups() {
  return [
    ["기술/소프트웨어", "Tech, STEM, BC PNP Tech 신호와 비교"],
    ["헬스케어", "카테고리 초청과 BC 보건 직군 신호 확인"],
    ["건설/기능직", "Trade, TEER, 고용주 지원 여부 확인"],
    ["서비스/접객/운영", "서비스직은 TEER, 고용주, 지역 연결을 먼저 확인"],
    ["교육/보육", "Childcare/Education 계열 주정부 신호 확인"],
  ] as const;
}

function recommendedOccupationGroupsFromDiagnostics(profile: CompassProfileResponse) {
  const diagnostics = getDiagnostics(profile);
  const groups = diagnostics?.recommended_occupation_groups?.map((item) => String(item).trim()).filter(Boolean);
  if (groups?.length) {
    return groups;
  }
  return recommendedOccupationGroups().map(([label]) => label);
}

function recommendedOccupationGroupDetails(label: string) {
  const details: Record<string, string> = {
    "기술/소프트웨어": "Tech, STEM, BC PNP Tech 신호와 비교",
    "헬스케어": "카테고리 초청과 BC 보건 직군 신호 확인",
    "건설/기능직": "Trade, TEER, 고용주 지원 여부 확인",
    "서비스/접객/운영": "서비스직은 TEER, 고용주, 지역 연결을 먼저 확인합니다",
    "교육/보육": "Childcare/Education 계열 주정부 신호 확인",
    "직무별 NOC 재선택": "현재 직무와 가장 가까운 NOC 군을 다시 고릅니다",
    "현재 직무와 가까운 카테고리 확인": "카테고리별 공식 신호와 비교합니다",
  };
  return details[label] || "직업군 정합도와 공식 신호를 함께 봅니다";
}

type DashboardCommandCenterProps = {
  state: DashboardState;
  data: CompassWorkspaceData;
  authUser?: { username: string; email: string } | null;
};

export function DashboardCommandCenter({ state, data, authUser = null }: DashboardCommandCenterProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const profile = data.profile || {};
  const changes = Array.isArray(data.changes) ? data.changes : [];
  const records = Array.isArray(data.records) ? data.records : [];
  const resolvedState = state === "empty" ? "empty" : deriveDashboardState(state, profile);
  const isEmpty = resolvedState === "empty";
  const isStarted = resolvedState === "started";
  const latestChange = latestSignalSummary(data.summary, changes);
  const topSignal = latestChange || data.statusOverview?.bc?.latest_signal || data.statusOverview?.ircc?.latest_signal || changes[0] || null;
  const sourceHealth = data.statusOverview || {};
  const isGuest = !authUser;
  const profileReady = Boolean(profile.profile_complete);
  const isPersonalLocked = isGuest || !profileReady;
  const contractIssue = profile.profile_contract_ok === false ? profile.profile_contract_issue || "서버 계약 확인 필요" : null;
  const personalImpact = buildPersonalImpactPanels(profile);
  const briefing = buildSignalBriefing({ summary: data.summary, changes, records, insights: data.insights, profile });
  const profileProgress = profileFillRatio(profile);
  const status = isGuest ? "로그인 필요" : profileReady ? "프로필 완료" : "개인화 잠금";
  const profileTitle = isGuest ? "로그인 후 개인화" : profileReady ? profile.strongest_route || "프로필 완료" : "프로필 등록 전";
  const profileMode = isGuest ? "샘플 프리뷰" : profileReady ? "개인화 해제" : "개인화 잠금";
  const decisionGaps = buildDecisionGaps(profile);
  const diagnostics = getDiagnostics(profile);
  const occupationNeedsChoice = profileReady
    ? diagnostics?.occupation_status
      ? String(diagnostics.occupation_status).includes("재분류") || String(diagnostics.occupation_status).includes("미입력")
      : isUnsetProfileValue(profile.profile?.bc_occupation_focus)
    : false;
  const eeNeedsCategory = profileReady
    ? diagnostics?.ee_category_status
      ? String(diagnostics.ee_category_status).includes("미정") || String(diagnostics.ee_category_status).includes("미입력")
      : isUnsetProfileValue(profile.profile?.ee_category_interest)
    : false;
  const decisionStatus = isPersonalLocked ? "잠금" : decisionGaps.length ? "판단 보강 필요" : "진단 가능";

  const statusStrip = useMemo(() => {
    const checkedAt = sourceHealth?.bc?.source_summary?.[0]?.checked_at || sourceHealth?.ircc?.source_summary?.[0]?.checked_at || data.profile.updated_at;
    const trackedSources = (sourceHealth?.bc?.source_count || 0) + (sourceHealth?.ircc?.source_count || 0);
    return {
      label: `공식 소스 ${trackedSources}개 추적`,
      detail: checkedAt ? `마지막 확인 ${formatVancouverCheckedLabel(checkedAt)}` : "소스 확인 대기",
    };
  }, [data.profile.updated_at, sourceHealth]);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, TOAST_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function runSourceCheck() {
    try {
      const response = await fetch("/api/check-sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notify: false, environment: "production" }),
      });
      const payload = (await response.json()) as { checked_count?: number; message?: string; checked_at?: string };
      if (!response.ok) {
        throw new Error(payload?.message || `Source check failed: ${response.status}`);
      }
      setToast(`공식 소스 확인 완료 · ${payload.checked_count ?? 0}개 · ${formatVancouverCheckedLabel(payload.checked_at)}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "공식 소스 확인에 실패했습니다.");
    }
  }

  const briefingBody = isEmpty
    ? `${briefing.summary} 로그인하지 않아도 공식 전망은 볼 수 있고, 개인 CRS/BC PNP 영향은 프로필 완료 후 열립니다.`
    : briefing.summary;
  const actionBody = isPersonalLocked
    ? isGuest
      ? "회원가입 또는 로그인 후 프로필을 완료하면 자동 CRS 계산, BC PNP 적합도, 직업군 비교가 열립니다."
      : "필수 프로필 입력을 모두 완료해야 개인화 대시보드가 잠금 해제됩니다. 부분 저장은 하지 않습니다."
    : briefing.personalLine;
  const briefingRows = [
    {
      label: "무엇이 바뀜",
      value: briefing.hasLatestUpdate ? "새 공식 업데이트 감지" : "새 공식 변경 없음",
      body: briefingBody,
    },
    {
      label: "왜 중요함",
      value: briefing.impactLabel,
      body: briefing.outlook,
    },
    {
      label: "내 다음 확인",
      value: isPersonalLocked ? "개인화 잠금" : decisionStatus,
      body: isPersonalLocked ? actionBody : profile.computed_scores?.comparison?.next_action || profile.next_action || briefing.personalLine,
    },
  ];

  function openProfileOrAccount() {
    if (isGuest) {
      window.location.href = "/app/account";
      return;
    }
    setProfileOpen(true);
  }

  return (
    <AppFrame
      title="오늘의 브리핑"
      subtitle="오늘 무엇이 바뀌었고, 프로필 기준으로 무엇을 봐야 하는지 한 화면에서 먼저 정리합니다."
      status={status}
      navItems={navItems.map((item) => ({ ...item, active: item.href === "/app" }))}
      action={
        <button type="button" className={primaryActionClass} onClick={openProfileOrAccount}>
          {isGuest ? "로그인 / 회원가입" : profileReady ? "프로필 확인" : "프로필 완료"}
        </button>
      }
      secondaryAction={
        <button type="button" className={secondaryActionClass} onClick={runSourceCheck}>
          공식 신호 확인
        </button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
        <div className="grid gap-4">
          {contractIssue ? (
            <Surface eyebrow="서버 상태" title="서버 계약 확인 필요">
              <p className={`text-[13px] leading-[1.65] ${mutedTextClass}`}>
                개인화 프로필 계약이 기대값과 맞지 않습니다. 공식 브리핑은 계속 보이지만, 개인 영향 분석은 잠금 상태로 유지됩니다.
              </p>
              <p className="mt-2 text-[12px] text-[rgba(245,247,251,0.56)]">{contractIssue}</p>
            </Surface>
          ) : null}
          <Surface
            eyebrow="오늘의 브리핑"
            title={briefing.title}
            actions={
              <button type="button" className="hidden rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[rgba(245,247,251,0.72)] transition hover:border-[#b69a45]/45 hover:text-[#f5ecc7] sm:inline-flex" onClick={() => setDrawerOpen(true)}>
                근거 보기
              </button>
            }
          >
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.045] px-4 py-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">소스 상태</p>
                  <p className="mt-1 text-[13px] font-semibold text-[#f5f7fb]">{statusStrip.label}</p>
                </div>
                <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#b69a45]/35 bg-[#b69a45]/10 px-3 py-2 text-[12px] font-semibold text-[#f5ecc7] transition hover:bg-[#b69a45]/16" onClick={runSourceCheck}>
                  <ShieldCheck className="h-4 w-4" />
                  {statusStrip.detail}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["신호 상태", briefing.hasLatestUpdate ? "새 업데이트" : "변경 없음", briefing.outlook],
                  ["프로필", isGuest ? "비로그인" : profileReady ? "개인화 연결" : `${profileProgress}% 완료`, isPersonalLocked ? "개인화 잠금" : "개인 영향 연결"],
                  ["다음 확인", "신호 / 로드맵", "자세한 분석은 신호에서 보고, 실행 순서는 로드맵에서 봅니다."],
                ].map(([label, value, detail]) => (
                  <div key={label} className="rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-extrabold tracking-[0.18em] text-[#d5bd6a]">{label}</span>
                      <strong className="text-[16px] text-[#f5f7fb]">{value}</strong>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.45] text-[rgba(245,247,251,0.58)]">{detail}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[16px] border border-white/10 bg-white/[0.045] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">핵심 브리핑</p>
                    <h3 className={`mt-1 text-[24px] ${headingClass}`}>{briefing.hasLatestUpdate ? "새 공식 업데이트를 기준으로 다시 읽었습니다" : "현재 공식 전망은 유지 중입니다"}</h3>
                  </div>
                  <MiniTag tone={briefing.impactTone}>{briefing.hasLatestUpdate ? "새 업데이트" : briefing.impactLabel}</MiniTag>
                </div>
                <div className="mt-4 grid gap-2">
                  {briefingRows.map((row) => (
                    <div key={row.label} className="rounded-[14px] border border-white/10 bg-[#0d1016] px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold tracking-[0.18em] text-[#d5bd6a]">{row.label}</span>
                        <strong className="text-[13px] text-[#f5ecc7]">{row.value}</strong>
                      </div>
                      <p className="mt-2 text-[13px] leading-[1.65] text-[rgba(245,247,251,0.72)]">{row.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="/app/signals" className="rounded-full border border-[#b69a45]/35 bg-[#b69a45]/10 px-3 py-2 text-[12px] font-semibold text-[#f5ecc7] transition hover:bg-[#b69a45]/16">
                    자세한 분석은 신호에서 보기
                  </a>
                  <a href="/app/roadmap" className="rounded-full border border-white/12 bg-white/[0.055] px-3 py-2 text-[12px] font-semibold text-[rgba(245,247,251,0.78)] transition hover:bg-white/[0.08]">
                    변경된 로드맵 보기
                  </a>
                  <a href="/app/notifications" className="rounded-full border border-white/12 bg-white/[0.055] px-3 py-2 text-[12px] font-semibold text-[rgba(245,247,251,0.78)] transition hover:bg-white/[0.08]">
                    업데이트 알림 설정
                  </a>
                </div>
              </div>

              <ScoreGraphPanel profile={profile} programOverview={data.programOverview} locked={isPersonalLocked} />
            </div>
          </Surface>
        </div>

        <div className="grid content-start gap-4">
          <Surface eyebrow="판단 신뢰도" title={isPersonalLocked ? profileTitle : decisionStatus}>
            <div className="grid gap-3">
              <MiniTag tone={isPersonalLocked || decisionGaps.length ? "rose" : "teal"}>{isPersonalLocked ? profileMode : decisionStatus}</MiniTag>
              <p className={`text-[13px] leading-[1.65] ${mutedTextClass}`}>
                {isGuest
                  ? "로그인 전에는 공식 브리핑과 샘플 프리뷰만 보여줍니다."
                  : !profileReady
                    ? "프로필 완료 전에는 CRS/PNP/직업군/개인 영향 카드가 잠겨 있습니다."
                    : decisionGaps.length
                      ? diagnostics?.blocking_inputs?.length
                        ? "진단에 필요한 입력이 아직 남아 있어 임시 해석과 보강 안내를 먼저 보여줍니다."
                        : "프로필은 저장되어 있지만 핵심 분류가 애매해 정확 진단보다 보강 안내를 먼저 보여줍니다."
                      : profile.main_status || "프로필이 연결되었습니다."}
              </p>
              {decisionGaps.length ? (
                <div className="grid gap-2">
                  {decisionGaps.slice(0, 3).map((gap) => (
                    <div key={gap.title} className="rounded-[14px] border border-[#f2a36b]/18 bg-[#f2a36b]/8 px-3 py-2">
                      <p className="text-[12px] font-bold text-[#ffd3ac]">{gap.title}</p>
                      <p className="mt-1 text-[11.5px] leading-[1.45] text-[rgba(245,247,251,0.62)]">{gap.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <button type="button" className="rounded-[14px] border border-[#b69a45]/45 bg-[#b69a45]/14 px-3 py-2 text-left text-[13px] font-semibold text-[#f5ecc7] transition hover:bg-[#b69a45]/20" onClick={openProfileOrAccount}>
                {isGuest ? "로그인 화면으로 이동" : profileReady ? "부족한 입력 수정하기" : "프로필 완료하기"}
              </button>
            </div>
          </Surface>

          <Surface eyebrow="경로 흐름" title="지금은 초청 가능성이 아니라 보강 순서">
            <div className="grid gap-3">
              {[
                ["BC PNP", isPersonalLocked ? "잠금" : occupationNeedsChoice ? "직업군 먼저 선택" : "조건 확인 중", occupationNeedsChoice ? "직업군이 넓게 저장되어 BC PNP 경로를 아직 좁히지 않습니다." : "잡오퍼, 고용주 지원, BC 연결이 실제 진행 가능성을 좌우합니다."],
                ["Express Entry", isPersonalLocked ? "잠금" : eeNeedsCategory ? "카테고리 먼저 선택" : "컷오프와 거리 확인", eeNeedsCategory ? "EE 카테고리를 정해야 내 CRS를 어떤 컷오프와 비교할지 정할 수 있습니다." : "자동 CRS가 최근 기준에서 얼마나 떨어져 있는지 먼저 봅니다."],
              ].map(([name, statusLabel, detail]) => (
                <div key={String(name)} className="flex items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#f5f7fb]">{String(name)}</p>
                    <p className="mt-1 text-[12px] text-[rgba(245,247,251,0.58)]">{String(detail)}</p>
                  </div>
                  <MiniTag tone={String(statusLabel).includes("잠금") || String(statusLabel).includes("먼저") ? "rose" : "gold"}>{String(statusLabel)}</MiniTag>
                </div>
              ))}
              <p className="rounded-[14px] border border-white/10 bg-black/15 px-3 py-2 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.62)]">
                이 영역은 PR 초청 가능성을 말하지 않습니다. 지금 입력값으로 어느 경로를 먼저 보강해야 하는지, 새 공식 업데이트가 오면 무엇을 다시 비교해야 하는지 보여줍니다.
              </p>
              <button type="button" aria-label="근거 드로어 열기" className="rounded-[14px] border border-[#b69a45]/35 bg-[#b69a45]/10 px-3 py-2 text-left text-[12px] font-semibold text-[#f5ecc7] transition hover:bg-[#b69a45]/16" onClick={() => setDrawerOpen(true)}>
                공식 근거와 해석 분리해서 보기
              </button>
            </div>
          </Surface>

          {!isPersonalLocked ? (
          <Surface eyebrow="직업군 분석" title="직업군이 두 경로에 미치는 영향">
              {occupationNeedsChoice ? (
                <div className="grid gap-3">
                  <p className={`text-[13px] leading-[1.65] ${mutedTextClass}`}>현재 직업군이 넓게 저장되어 있어 BC PNP와 Express Entry 신호를 같은 기준으로 비교하기 어렵습니다. 아래 중 가장 가까운 군을 선택하면 두 경로 모두 다시 계산됩니다.</p>
                  <div className="grid gap-2">
                    {recommendedOccupationGroupsFromDiagnostics(profile).map((label) => (
                      <div key={label} className="rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
                        <p className="text-[13px] font-semibold text-[#f5f7fb]">{label}</p>
                        <p className="mt-1 text-[12px] leading-[1.45] text-[rgba(245,247,251,0.58)]">{recommendedOccupationGroupDetails(label)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] leading-[1.55] text-[rgba(245,247,251,0.58)]">
                    목록에 정확히 맞는 직군이 없으면 가장 가까운 직무군을 먼저 선택하세요. 이후 NOC/TEER 세분화 단계에서 실제 직무와 맞춰 다시 좁힙니다.
                  </p>
                  <button type="button" className="rounded-[14px] border border-[#b69a45]/45 bg-[#b69a45]/14 px-3 py-2 text-left text-[13px] font-semibold text-[#f5ecc7] transition hover:bg-[#b69a45]/20" onClick={openProfileOrAccount}>
                    직업군 선택하러 가기
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
                      <p className="text-[12px] font-bold text-[#f5ecc7]">BC PNP에서 보는 것</p>
                      <p className="mt-1 text-[12px] leading-[1.45] text-[rgba(245,247,251,0.6)]">직업군, TEER, 잡오퍼, 고용주 지원, BC 연결이 경로를 좁힙니다.</p>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
                      <p className="text-[12px] font-bold text-[#f5ecc7]">Express Entry에서 보는 것</p>
                      <p className="mt-1 text-[12px] leading-[1.45] text-[rgba(245,247,251,0.6)]">직업군은 카테고리 초청과 NOC/TEER 확인에 연결되고, 최종 거리는 CRS와 컷오프로 봅니다.</p>
                    </div>
                  </div>
                  {[
                    ["직업군", profile.profile?.bc_occupation_focus || "미선택", "BC PNP와 EE 카테고리 비교의 공통 기준"],
                    ["TEER", profile.profile?.noc_teer || "미선택", "직무 매칭 신뢰도를 보조"],
                    ["다음 행동", profile.computed_scores?.comparison?.next_action || profile.next_action || "대기", "공식 업데이트와 프로필을 함께 읽은 결과"],
                  ].map(([label, value, detail]) => (
                    <div key={String(label)} className="rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-extrabold tracking-[0.18em] text-[#d5bd6a]">{String(label)}</span>
                        <strong className="text-[13px] text-[#f5f7fb]">{String(value)}</strong>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-[1.45] text-[rgba(245,247,251,0.58)]">{String(detail)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          ) : null}
        </div>
      </div>

      {profileOpen && !isGuest ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/62 px-3 py-5 backdrop-blur-sm">
          <div className="mx-auto w-[min(1180px,100%)] overflow-hidden rounded-[22px] border border-white/12 bg-[#12151b] shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">프로필 등록</p>
                <h2 className={`mt-1 text-[24px] ${headingClass}`}>{isEmpty ? "프로필 등록" : "프로필 확인 및 수정"}</h2>
                <p className={`mt-2 max-w-2xl text-[13px] leading-[1.6] ${mutedTextClass}`}>등록 전에는 공공 브리핑만 열리고, 저장 후에는 개인 영향과 추천 경로가 대시보드에 연결됩니다.</p>
              </div>
              <button type="button" className="rounded-full border border-white/12 bg-white/[0.06] p-2 text-[rgba(245,247,251,0.72)] hover:text-white" onClick={() => setProfileOpen(false)} aria-label="프로필 모달 닫기">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(100dvh-168px)] overflow-y-auto p-4">
              <ProfileWorkflow
                key={profile.updated_at || "dashboard-profile"}
                profileBundle={profile}
                onSaved={() => {
                  setProfileOpen(false);
                  setToast("프로필이 저장되었습니다.");
                }}
                onClose={() => setProfileOpen(false)}
                showIntro={false}
              />
            </div>
          </div>
        </div>
      ) : null}

      {drawerOpen ? <EvidenceDrawer signal={topSignal} changes={changes} evidenceItems={briefing.evidenceItems} profile={profile} summary={data.summary} onClose={() => setDrawerOpen(false)} personalImpact={personalImpact} contractIssue={contractIssue} /> : null}

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(420px,calc(100vw-24px))] -translate-x-1/2 rounded-[16px] border border-[#70e4b0]/35 bg-[#10221d] px-4 py-3 text-[13px] text-[#c9f8e4] shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
          {toast}
        </div>
      ) : null}
    </AppFrame>
  );
}

function ScoreGraphPanel({ profile, programOverview, locked }: { profile: CompassProfileResponse; programOverview: any; locked: boolean }) {
  const draft = (profile.profile || {}) as Record<string, unknown>;
  const computed = profile.computed_scores || {};
  const crs = Number(computed.crs?.score || 0);
  const bcFit = Math.max(0, Math.min(100, Number(computed.bc_pnp?.fit_score || profile.route_profiles?.bc_pnp?.score || (draft.bc_occupation_focus ? 68 : 48))));
  const pnpRange = computed.bc_pnp?.estimated_registration_range;
  const crsConfidence = Math.max(0, Math.min(100, Number(computed.crs?.confidence || 0)));
  const crsBreakdown = computed.crs?.breakdown || {};
  const crsBasis = Array.isArray(computed.crs?.basis) ? computed.crs?.basis : [];
  const crsBreakdownRows = Object.entries(crsBreakdown)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => ({
      label: {
        age: "나이",
        education: "학력/ECA",
        first_language: "영어 CLB",
        second_language: "프랑스어",
        canadian_experience: "캐나다 경력",
        skill_transferability: "전환성",
        canadian_education: "캐나다 학력",
        sibling: "캐나다 형제/자매",
        provincial_nomination: "주정부 노미네이션",
      }[key] || key,
      value: Number(value),
    }));
  const firstLanguageDetails = computed.crs?.breakdown_details?.first_language;
  const languageAbilityRows = Object.entries(firstLanguageDetails?.abilities || {})
    .filter(([, value]) => Boolean(value) && typeof value === "object")
    .map(([key, value]) => ({
    label: {
      speaking: "Speaking",
      listening: "Listening",
      reading: "Reading",
      writing: "Writing",
    }[key] || key,
      clb: value.effective_clb || value.input_clb || "대기",
      score: Number(value.score || 0),
    }));
  const bcConfidence = Math.max(0, Math.min(100, Number(computed.bc_pnp?.confidence || 0)));
  const latestEeCutoff = Number(computed.express_entry?.latest_cutoff || programOverview?.express_entry?.latest_draw?.minimum_score || 0);
  const crsDistance = !locked && crs && latestEeCutoff ? crs - latestEeCutoff : null;
  const occupationSelected = !isUnsetProfileValue(draft.bc_occupation_focus);
  const comparisonRoute = computed.comparison?.closer_route || profile.strongest_route || "Express Entry";
  const teer = String(draft.noc_teer || "미선택");
  const bcMissingCount = Array.isArray(computed.bc_pnp?.missing) ? computed.bc_pnp?.missing.length : 0;
  const crsInterpretation = locked
    ? "사용자가 CRS를 직접 입력하지 않습니다. 프로필 완료 후 구조화 입력으로 자동 계산됩니다."
    : crsDistance === null
      ? "CRS는 계산됐지만 최근 컷오프 연결을 기다리고 있습니다. 직업군과 EE 카테고리를 정하면 비교 기준이 더 선명해집니다."
      : crsDistance >= 0
        ? `최근 컷오프보다 ${crsDistance}점 높습니다. 그래도 초청 유형과 카테고리 조건을 함께 확인해야 합니다.`
        : `최근 컷오프까지 ${Math.abs(crsDistance)}점이 부족합니다. 언어, 카테고리, 경력 입력을 먼저 보강해야 합니다.`;
  const rows = locked
    ? [
        { label: "자동 CRS", value: 34, display: "잠금", note: "프로필 완료 후 계산 점수 표시" },
        { label: "BC PNP 진행 준비", value: 38, display: "잠금", note: "프로필 완료 후 잡오퍼/고용주/BC 연결 확인" },
        { label: "직업군", value: 32, display: "잠금", note: "직업군/TEER 입력 후 관련성 표시" },
      ]
    : occupationSelected
      ? [
        { label: "CRS 계산 점수", value: crs ? Math.max(8, Math.min(100, (crs / 600) * 100)) : 12, display: crs ? `${crs}점` : "계산 대기", note: crsDistance === null ? "최근 컷오프 연결 대기" : crsDistance >= 0 ? `최근 컷오프 대비 +${crsDistance}점` : `최근 컷오프 대비 ${crsDistance}점` },
        { label: "BC PNP 진행 준비", value: bcFit, display: `${bcFit}/100`, note: pnpRange ? `추정 등록 점수대 ${pnpRange[0]}-${pnpRange[1]}점` : bcMissingCount ? `부족 요건 ${bcMissingCount}개` : "공식 초청 점수가 아니라 준비 상태" },
        { label: `${String(draft.bc_occupation_focus)} · TEER ${teer}`, value: bcConfidence, display: `${bcConfidence}/100`, note: "직업군이 공식 신호와 얼마나 잘 연결되는지" },
      ]
      : [
        { label: "기술/소프트웨어", value: 64, display: "추정", note: "Tech/STEM/BC PNP Tech 신호와 매칭될 수 있어 우선 확인" },
        { label: "헬스케어", value: 60, display: "추정", note: "카테고리 신호는 강하지만 현재 프로필 직업군이 미확정" },
        { label: "건설/기능직", value: 54, display: "추정", note: "Trade/TEER/고용주 지원 여부를 확인해야 함" },
        { label: "서비스/접객/운영", value: 46, display: "추정", note: "TEER와 고용주/지역 연결을 먼저 좁혀야 함" },
      ];

  return (
    <div className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">점수와 거리감</p>
          <h3 className={`mt-1 text-[18px] ${headingClass}`}>{locked ? "프로필 완료 후 열리는 자동 비교" : occupationSelected ? "내 점수와 두 경로의 현재 거리" : "직업군별 참고 범위"}</h3>
        </div>
        <MiniTag tone={locked ? "rose" : "teal"}>{locked ? "잠금" : `현재 기준: ${comparisonRoute}`}</MiniTag>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[14px] border border-white/10 bg-[#0d1016] p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-[rgba(245,247,251,0.72)]">자동 CRS</span>
            <strong className="text-[13px] text-[#f5ecc7]">{locked ? "잠금" : crs ? `${crs}점` : "계산 대기"}</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#b69a45,#f5ecc7)]" style={{ width: `${locked ? 34 : crs ? Math.max(8, (crs / 600) * 100) : 12}%` }} />
          </div>
          <div className="mt-3 rounded-[12px] border border-white/10 bg-white/[0.045] px-3 py-2">
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#d5bd6a]">점수 해석</p>
            <p className={`mt-1 text-[12px] leading-[1.55] ${mutedTextClass}`}>{crsInterpretation}</p>
            {!locked ? <p className={`mt-1 text-[11px] leading-[1.5] ${mutedTextClass}`}>이 그래프는 합격 확률표가 아닙니다. CRS는 컷오프와의 거리, BC PNP는 지금 준비된 조건을 보여줍니다.</p> : null}
          </div>
          <div className="mt-3 rounded-[12px] border border-white/10 bg-white/[0.045] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#d5bd6a]">CRS 계산 기준</p>
              <span className="text-[11px] font-semibold text-[rgba(245,247,251,0.56)]">신뢰도 {crsConfidence}%</span>
            </div>
            {crsBreakdownRows.length ? (
              <div className="mt-2 grid gap-1.5">
                {crsBreakdownRows.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-[rgba(245,247,251,0.66)]">{item.label}</span>
                    <strong className="text-[#f5ecc7]">{item.value}점</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`mt-2 text-[12px] leading-[1.55] ${mutedTextClass}`}>
                {crsBasis.length ? `${crsBasis.join(" · ")} 기준으로 계산합니다. 세부 항목 점수는 서버 기준 보강 후 표시됩니다.` : "프로필 입력을 저장하면 계산 기준이 표시됩니다."}
              </p>
            )}
            {languageAbilityRows.length ? (
              <div className="mt-3 rounded-[10px] border border-white/10 bg-black/15 px-2.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#d5bd6a]">언어 4개 능력</p>
                  <span className="text-[10.5px] text-[rgba(245,247,251,0.52)]">{firstLanguageDetails?.mode === "ability" ? "개별 입력 반영" : "전체 CLB 기준"}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {languageAbilityRows.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-2 rounded-[9px] bg-white/[0.045] px-2 py-1.5 text-[11px]">
                      <span className="text-[rgba(245,247,251,0.62)]">{item.label}</span>
                      <strong className="text-[#f5ecc7]">{item.clb} · {item.score}점</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {locked ? (
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-[#f2a36b]/25 bg-[#f2a36b]/10 px-3 py-2 text-[12px] font-semibold text-[#ffd3ac]">
              <LockKeyhole className="h-4 w-4" />
              개인화 분석 잠금
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.label} className="rounded-[14px] border border-white/10 bg-white/[0.045] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold text-[#f5f7fb]">{row.label}</span>
                <span className="text-[12px] font-bold text-[#f5ecc7]">{row.display}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#b69a45]" style={{ width: `${row.value}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-[rgba(245,247,251,0.54)]">{row.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EvidenceDrawer({
  signal,
  changes,
  evidenceItems,
  profile,
  summary,
  personalImpact,
  contractIssue,
  onClose,
}: {
  signal: any;
  changes: any[];
  evidenceItems: any[];
  profile: CompassProfileResponse;
  summary: any;
  personalImpact: { locked: boolean; panels: Array<{ title: string; meta: string; body: string; chip: string; tone: "teal" | "gold" | "rose" | "slate" }> };
  contractIssue: string | null;
  onClose: () => void;
}) {
  const evidenceFeed = (evidenceItems?.length ? evidenceItems : changes || []).slice(0, 4);
  const checkedLabel = formatVancouverCheckedLabel(summary?.latest_snapshot || signal?.detected_at || signal?.checked_at);
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="근거 드로어 닫기" className="absolute inset-0 bg-[rgba(8,9,13,0.66)] backdrop-blur-[8px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-stretch justify-stretch p-0 sm:inset-auto sm:right-3 sm:top-3 sm:h-[calc(100dvh-24px)] sm:w-[min(720px,calc(100vw-24px))] sm:justify-end sm:p-0">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-white/10 bg-[#12151b] shadow-[0_22px_60px_rgba(0,0,0,0.38)] sm:rounded-[28px]">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-5 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#d5bd6a]">근거 드로어</p>
              <h3 className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#f5f7fb]">근거 드로어</h3>
              <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[rgba(245,247,251,0.66)]">공식 출처와 PR Compass 해석을 분리해서 확인합니다.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-[12px] border border-white/10 bg-white/[0.05] text-[14px] font-black text-[rgba(245,247,251,0.72)]" aria-label="닫기">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid flex-1 gap-3 overflow-y-auto p-4 sm:p-5">
            {contractIssue ? (
              <div className="rounded-[18px] border border-[#f2a36b]/20 bg-[#f2a36b]/10 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">서버 상태</p>
                <p className="mt-1 text-[13px] leading-[1.65] text-[#ffd3ac]">프로필 계약을 확인하는 중입니다. 개인 영향은 잠금 상태로 유지됩니다.</p>
                <p className="mt-2 text-[12px] text-[rgba(245,247,251,0.64)]">{contractIssue}</p>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <MetricCard label="확인 시각" value={checkedLabel} detail="기준 시각과 확인 결과를 분리해서 봅니다." accent="gold" />
              <MetricCard
                label="프로필 영향"
                value={profile.profile_complete ? profile.fit_label || "연결됨" : "공개 해석만"}
                detail={
                  profile.profile_complete
                    ? profile.position_explanation ||
                      `자동 CRS ${profile.computed_scores?.crs?.score || "대기"}점, BC PNP 조건 정합도 ${profile.computed_scores?.bc_pnp?.fit_score || "대기"}, 직업군 ${String(profile.profile?.bc_occupation_focus || "미선택")}`
                    : "프로필이 저장되면 개인 영향이 열립니다."
                }
                accent={profile.profile_complete ? "teal" : "rose"}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {personalImpact.panels.map((panel) => (
                <article key={panel.title} className="rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">{panel.meta}</p>
                      <h4 className={`mt-1 text-[18px] ${headingClass}`}>{panel.title}</h4>
                    </div>
                    <MiniTag tone={panel.tone}>{panel.chip}</MiniTag>
                  </div>
                  <p className={`mt-3 text-[13px] leading-[1.65] ${mutedTextClass}`}>{panel.body}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-3">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">공식 원문</p>
                <h4 className="mt-1 text-[18px] font-semibold text-[#f5f7fb]">{signal?.source_title || signal?.title || "최근 공식 소스"}</h4>
                <p className="mt-2 text-[13px] leading-[1.65] text-[rgba(245,247,251,0.66)]">{signal?.source_url || signal?.url || "공식 URL 대기"}</p>
                <p className="mt-2 text-[12px] text-[rgba(245,247,251,0.55)]">수집 / 확인: {checkedLabel}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">변경 요약</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[rgba(245,247,251,0.72)]">{signal?.summary_ko || signal?.summary || "요약 대기"}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">PR Compass 해석</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[rgba(245,247,251,0.72)]">{signal?.reasoning_ko || "공식 근거와 분리된 해석이 아직 없습니다."}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">프로필 영향</p>
                  {profile.profile_complete ? (
                    <div className="mt-2 grid gap-2 text-[13px] leading-[1.65] text-[rgba(245,247,251,0.72)]">
                      <p>{profile.position_explanation || "개인 영향이 계산되었습니다."}</p>
                      <div className="grid gap-2 rounded-[14px] border border-white/10 bg-[#0d1016] p-3 text-[12px] text-[rgba(245,247,251,0.7)]">
                        <p>자동 CRS: {profile.computed_scores?.crs?.score ?? "대기"}점</p>
                        <p>BC PNP 조건 정합도: {profile.computed_scores?.bc_pnp?.fit_score ?? "대기"}</p>
                        <p>직업군: {String(profile.profile?.bc_occupation_focus || "미선택")}</p>
                        <p>TEER: {String(profile.profile?.noc_teer || "미선택")}</p>
                        <p>EE 카테고리: {String(profile.profile?.ee_category_interest || "미선택")}</p>
                      </div>
                      <p>{profile.next_action || "다음 행동 계산됨"}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] leading-[1.7] text-[rgba(245,247,251,0.72)]">프로필을 저장하면 개인 영향이 표시됩니다.</p>
                  )}
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">영향도</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[rgba(245,247,251,0.72)]">{signal?.impact_level === "high" ? "높음" : signal?.impact_level === "medium" ? "중간" : signal?.impact_level ? "낮음" : "알 수 없음"}</p>
                </div>
              </div>

              <div className="rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">근거 흐름</p>
                <div className="mt-3 grid gap-2">
                  {evidenceFeed.length ? (
                    evidenceFeed.map((item) => (
                      <div key={item.change_id || item.detected_at || item.event_date || item.title} className="rounded-[14px] border border-white/10 bg-[#0d1016] px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-[#f5f7fb]">{item.title}</p>
                          <MiniTag tone={item.evidence_kind === "record" ? "slate" : "gold"}>{item.evidence_kind === "record" ? "공식 기록" : "업데이트"}</MiniTag>
                        </div>
                        <p className="mt-1 text-[12px] leading-[1.6] text-[rgba(245,247,251,0.62)]">{item.summary_ko || item.reasoning_ko || "근거 요약 대기"}</p>
                        <p className="mt-1 text-[11px] leading-[1.5] text-[rgba(245,247,251,0.45)]">{item.source_title || item.publisher || formatVancouverCheckedLabel(item.detected_at) || "공식 소스"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-[rgba(245,247,251,0.62)]">근거가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
