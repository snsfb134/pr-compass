import Link from "next/link";
import { ExternalLink, LockKeyhole } from "lucide-react";
import { AppFrame, InsightCard, MiniTag, Surface, headingClass, mutedTextClass, panelClass, primaryActionClass, secondaryActionClass } from "@/components/redesign-shell";
import { buildPersonalImpactPanels, buildSignalBriefing, loadSignalsWorkspace } from "@/lib/compass-data";
import { formatVancouverCheckedLabel } from "@/lib/date-format";
import { getSessionUser } from "@/lib/local-account-store";
import { navItems } from "@/lib/redesign-data";
import { cookies } from "next/headers";

function impactTone(impactLevel: string | undefined) {
  if (impactLevel === "high") return "rose" as const;
  if (impactLevel === "medium") return "gold" as const;
  return "slate" as const;
}

export default async function SignalsPage() {
  const sessionToken = (await cookies()).get("pc_session")?.value;
  const user = await getSessionUser(sessionToken);
  const data = await loadSignalsWorkspace(user?.id);
  const profile = data.profile;
  const signals = data.changes || [];
  const personalImpact = buildPersonalImpactPanels(profile);
  const briefing = buildSignalBriefing({ summary: data.summary, changes: signals, records: data.records || [], insights: data.insights, profile });
  const contractIssue = profile.profile_contract_ok === false ? profile.profile_contract_issue || "서버 계약 확인 필요" : null;
  const recentEvidenceItems = briefing.evidenceItems.slice(0, 5);
  const blockingInputs = profile.diagnostics?.blocking_inputs || [];
  const blockingLabels = blockingInputs.map((item) => item.title).filter(Boolean);
  const latestBasis = briefing.highlights[0] || recentEvidenceItems[0]?.summary_ko || "최근 공식 기록과 마지막 확인 시각을 기준으로 판단했습니다.";
  const outlookBody = `근거: ${latestBasis} 해석: ${briefing.outlook}`;
  const personalImpactBody = profile.profile_complete
    ? blockingLabels.length
      ? `프로필 입력은 저장되었습니다. 다만 ${blockingLabels.join(", ")} 기준은 공식 업데이트가 들어올 때 다시 비교해야 하는 축입니다. 현재 신호는 ${briefing.personalLine}`
      : `근거: ${latestBasis} 해석: ${briefing.personalLine} 영향: 새 공식 업데이트가 오면 내 CRS 거리, BC PNP 준비 상태, 직업군/TEER 연결을 다시 비교합니다.`
    : `프로필이 없어 개인 점수나 직업군 영향은 잠금 상태입니다. 공개 전망으로는 ${briefing.personalLine}`;

  return (
    <AppFrame
      title="PR 신호"
      subtitle="무슨 일이 바뀌었는지, 왜 중요한지, 그리고 다음에 뭘 해야 하는지까지 함께 보여줍니다."
      status="브리핑"
      navItems={navItems.map((item) => ({ ...item, active: item.href === "/app/signals" }))}
      action={
        <div className="flex flex-wrap gap-2">
          <Link href="/app/notifications" className={secondaryActionClass}>
            알림 기준 설정
          </Link>
          <Link href="/app/roadmap" className={primaryActionClass}>
            로드맵에 연결
          </Link>
        </div>
      }
    >
      <div className="grid gap-4">
        {contractIssue ? (
          <Surface eyebrow="서버 상태" title="서버 계약 확인 필요">
            <p className={`text-[13px] leading-[1.65] ${mutedTextClass}`}>
              공식 신호는 계속 보이지만, 개인 영향과 추천 행동은 서버 계약이 맞는 동안 잠금 상태로 유지됩니다.
            </p>
            <p className="mt-2 text-[12px] text-[rgba(245,247,251,0.56)]">{contractIssue}</p>
          </Surface>
        ) : null}

        <Surface
          eyebrow="통합 신호"
          title={briefing.title}
          actions={
            <div className="flex flex-wrap gap-2">
              {briefing.evidenceItems.length ? (
                <a href="#signal-0" className={secondaryActionClass}>
                  최신 근거 보기
                </a>
              ) : null}
              <a href="#evidence-list" className={secondaryActionClass}>
                근거 목록
              </a>
              <Link href="/app/roadmap" className={primaryActionClass}>
                로드맵 보기
              </Link>
            </div>
          }
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[#b69a45]/22 bg-[linear-gradient(180deg,rgba(182,154,69,0.14),rgba(255,255,255,0.045))] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.06)]">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">{briefing.hasLatestUpdate ? "최신 업데이트 기준" : "변경 없음"}</p>
                <h3 className={`mt-2 text-[22px] ${headingClass}`}>이번 신호의 결론</h3>
                <p className="mt-2 max-w-4xl text-[15px] leading-[1.75] text-[rgba(245,247,251,0.82)]">{briefing.summary}</p>
              </div>
              <MiniTag tone={briefing.impactTone}>{briefing.impactLabel}</MiniTag>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <InsightCard title="전망" meta="근거 → 해석" chip="전망" tone="gold" body={outlookBody} />
              <InsightCard title="프로필 영향" meta={profile.profile_complete ? (blockingLabels.length ? "업데이트 때 재비교" : "개인화") : "공개 전망"} chip={profile.profile_complete ? (blockingLabels.length ? "관찰 기준" : "연결됨") : "잠금"} tone={profile.profile_complete ? (blockingLabels.length ? "gold" : "teal") : "rose"} body={personalImpactBody} />
              <InsightCard title="다음 이동" meta="흐름" chip="신호 → 알림 → 로드맵" tone="default" body="새 공식 업데이트가 들어오면 알림 기준에 따라 다시 알려주고, 실제 실행 순서 변화는 로드맵에서 이어서 봅니다." />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <SignalList title="강해진 신호" caption="최근 공식 기록에서 더 선명해진 방향입니다." items={briefing.highlights} />
              <SignalList title="주의할 점" caption="단정하면 안 되는 조건과 누락된 확인 지점입니다." items={briefing.risks} />
              <SignalList title="다음 관찰" caption="다음 업데이트에서 다시 봐야 할 기준입니다." items={briefing.watchlist} />
            </div>
          </div>
        </Surface>

        <Surface eyebrow="개인 영향" title={personalImpact.locked ? "프로필 완료 전 개인 영향은 잠금" : "프로필 기준 개인 영향과 다음 행동"}>
          <div className="grid gap-3 md:grid-cols-2">
            {personalImpact.panels.map((panel) =>
              personalImpact.locked ? (
                <LockedSignalCard key={panel.title} title={panel.title} body={panel.body} />
              ) : (
                <InsightCard key={panel.title} title={panel.title} meta={panel.meta} chip={panel.chip} tone={panel.tone === "rose" ? "rose" : panel.tone === "gold" ? "gold" : panel.tone === "teal" ? "teal" : "default"} body={panel.body} />
              ),
            )}
          </div>
        </Surface>

        <Surface eyebrow="근거 목록" title="최근 공식 근거 5개와 해석" actions={<a href="#top" className="sr-only">상단</a>}>
          <div id="evidence-list" className="grid gap-3">
            <div className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
              <p className={`text-[13px] leading-[1.65] ${mutedTextClass}`}>
                공식 근거는 계속 쌓이기 때문에 화면에는 최근 5개만 보여줍니다. 과거 근거는 오늘의 브리핑처럼 이전 기록과 비교해 “무엇이 달라졌는지” 해석에 반영됩니다.
              </p>
            </div>
            {recentEvidenceItems.length ? (
              recentEvidenceItems.map((signal, index) => (
                <article id={`signal-${index}`} key={signal.change_id || signal.title || index} className={panelClass}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">
                        {signal.evidence_kind === "record" ? "공식 기록" : signal.publisher || signal.source_title || signal.change_type || "공식 소스"}
                      </p>
                      <h3 className={`mt-1 text-[22px] ${headingClass}`}>{signal.title}</h3>
                    </div>
                    <MiniTag tone={impactTone(signal.impact_level)}>{signal.impact_level === "high" ? "높음" : signal.impact_level === "medium" ? "중간" : signal.impact_level ? "낮음" : "미확인"}</MiniTag>
                  </div>
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    <InsightCard title={signal.evidence_kind === "record" ? "공식 기록" : "이번 업데이트"} meta={signal.evidence_kind === "record" ? "records" : "변경 요약"} chip="근거" tone="default" body={signal.summary_ko || "요약 없음"} />
                    <InsightCard title="해석" meta="전망 연결" chip={signal.evidence_kind === "record" ? "기록 해석" : "해석"} tone={impactTone(signal.impact_level) === "rose" ? "rose" : impactTone(signal.impact_level) === "gold" ? "gold" : "teal"} body={signal.reasoning_ko || "해석 없음"} />
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-[rgba(245,247,251,0.48)]">{formatVancouverCheckedLabel(signal.detected_at || signal.event_date || signal.checked_at)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {signal.source_url ? (
                      <a href={signal.source_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-3 text-[12px] font-semibold text-[rgba(245,247,251,0.78)]">
                        공식 원문 열기
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className={panelClass}>
                <p className="text-[13px] text-[rgba(245,247,251,0.72)]">아직 새 공식 신호가 없습니다. 현재 전망은 기존 공식 기록과 마지막 확인 시각 기준으로 유지됩니다.</p>
              </div>
            )}
            {briefing.evidenceItems.length > recentEvidenceItems.length ? (
              <div className="rounded-[16px] border border-white/10 bg-white/[0.035] p-4">
                <p className="text-[12px] leading-[1.6] text-[rgba(245,247,251,0.58)]">
                  오래된 근거 {briefing.evidenceItems.length - recentEvidenceItems.length}개는 목록을 늘리지 않고 비교 해석에만 사용합니다. 전체 히스토리 테이블은 다음 단계에서 분리합니다.
                </p>
              </div>
            ) : null}
          </div>
        </Surface>
      </div>
    </AppFrame>
  );
}

function SignalList({ title, caption, items }: { title: string; caption: string; items: string[] }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#d5bd6a]">핵심 포인트</p>
      <h3 className={`mt-1 text-[20px] ${headingClass}`}>{title}</h3>
      <p className={`mt-2 text-[12px] leading-[1.55] ${mutedTextClass}`}>{caption}</p>
      <div className="mt-4 grid gap-2">
        {items.map((item, index) => (
          <div key={item} className="flex gap-3 rounded-[14px] border border-white/10 bg-black/15 p-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#b69a45]/30 bg-[#b69a45]/12 text-[11px] font-extrabold text-[#f5ecc7]">{index + 1}</span>
            <p className="text-[13px] leading-[1.6] text-[rgba(245,247,251,0.8)]">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LockedSignalCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="min-w-0 rounded-[16px] border border-[#f2a36b]/22 bg-[linear-gradient(180deg,rgba(242,163,107,0.12),rgba(255,255,255,0.045))] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">프로필 필요</p>
          <h3 className={`mt-1 text-[20px] ${headingClass}`}>{title}</h3>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#f2a36b]/30 bg-[#f2a36b]/10 text-[#ffd3ac]">
          <LockKeyhole className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-4 text-[13px] leading-[1.65] ${mutedTextClass}`}>{body}</p>
      <Link href="/app/assessment" className="mt-4 inline-flex h-9 items-center rounded-full border border-[#b69a45]/40 bg-[#b69a45]/12 px-3 text-[12px] font-semibold text-[#f5ecc7]">
        프로필 완료하기
      </Link>
    </article>
  );
}
