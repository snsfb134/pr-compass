import Link from "next/link";
import { AppFrame, MiniTag, Surface, TimelineItem, headingClass, itemClass, mutedTextClass, panelClass, primaryActionClass } from "@/components/redesign-shell";
import { ProfileLockedView } from "@/components/profile-locked-view";
import { loadRouteWorkspace } from "@/lib/compass-data";
import { formatVancouverCheckedLabel } from "@/lib/date-format";
import { getSessionUser } from "@/lib/local-account-store";
import { navItems } from "@/lib/redesign-data";
import { cookies } from "next/headers";

export default async function RoadmapPage() {
  const sessionToken = (await cookies()).get("pc_session")?.value;
  const user = await getSessionUser(sessionToken);
  const data = await loadRouteWorkspace(user?.id);
  const profile = data.profile;
  const latestCheckLabel = formatVancouverCheckedLabel(data.summary?.latest_snapshot || profile.updated_at);
  if (!user || !profile.profile_complete) {
    return (
      <ProfileLockedView
        activeHref="/app/roadmap"
        title="로드맵"
        subtitle="개인 실행 로드맵은 프로필 완료 후 공식 신호와 개인 기준을 연결해 만듭니다."
        mode={!user ? "guest" : "profile"}
      />
    );
  }
  const changes = data.summary?.latest_change ? [data.summary.latest_change, ...(data.policyOverview?.bc_pnp?.latest_changes || []), ...(data.policyOverview?.ircc?.latest_changes || [])] : [];
  const roadmap = [
    {
      title: "이번 주",
      detail: profile.profile_complete ? profile.next_milestone || "공식 신호와 프로필을 다시 대조합니다." : "프로필을 먼저 저장하고 현재 공백을 줄입니다.",
      owner: "사용자",
      status: profile.profile_complete ? "doing" : "todo",
    },
    {
      title: "2주 내",
      detail: "프랑스어 CLB7과 CEC 시나리오를 시뮬레이터에 추가합니다.",
      owner: "전략",
      status: "todo",
    },
    {
      title: "다음 달",
      detail: "경로별 공식 근거와 개인 행동 체크포인트를 정리합니다.",
      owner: "근거",
      status: "todo",
    },
    {
      title: "상시",
      detail: "새 PR 신호를 보고, draw 패턴이 움직일 때 계획을 업데이트합니다.",
      owner: "신호",
      status: "todo",
    },
  ];

  return (
    <AppFrame
      title="로드맵"
      subtitle={`신호를 실제 신청 행동으로 바꿔 주는 우선순위 기반 계획입니다. 기준 시각 ${latestCheckLabel}`}
      status="행동 계획"
      navItems={navItems.map((item) => ({ ...item, active: item.href === "/app/roadmap" }))}
      action={
        <Link href="/app/signals" className={primaryActionClass}>
          공식 신호 다시 보기
        </Link>
      }
    >
      <div className="grid gap-4">
        <Surface eyebrow="로드맵" title="우선순위가 있는 진행">
          <div className="grid gap-3">
            {roadmap.map((item, index) => (
              <div key={item.title} className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className={`text-[22px] ${headingClass}`}>{item.title}</h3>
                  <MiniTag tone={item.status === "doing" ? "gold" : "slate"}>{item.owner}</MiniTag>
                </div>
                <p className={`mt-2 text-[13px] leading-[1.65] ${mutedTextClass}`}>{item.detail}</p>
                <p className="mt-2 text-[12px] font-semibold text-[rgba(245,247,251,0.58)]">기준 시각 {latestCheckLabel}</p>
                {index < roadmap.length - 1 ? <div className="mt-4 h-px bg-white/10" /> : null}
              </div>
            ))}
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-2">
          <Surface eyebrow="타임라인" title="먼저 할 일">
            <div className="space-y-3">
              <TimelineItem index={1} title="언어 확인" body="전략과 리스크를 가장 빠르게 바꾸는 레버입니다." />
              <TimelineItem index={2} title="직무 확인" body="TEER 정합성이 경로 신뢰도를 끌어올립니다." />
              <TimelineItem index={3} title="근거 확인" body="경로가 구체적일수록 공식 신호와 개인 행동을 함께 확인합니다." />
            </div>
          </Surface>
          <Surface eyebrow="업데이트 방식" title="신호가 도착하는 순서">
            <div className="space-y-3">
              {[
                "1. 무엇이 바뀌었는지 먼저 보여줍니다.",
                "2. 왜 중요한지 다음으로 설명합니다.",
                "3. 어떤 행동을 해야 하는지 마지막에 제안합니다.",
                "4. 그 행동을 실제 작업으로 로드맵에 붙입니다.",
              ].map((line) => (
                <div key={line} className={`${itemClass} text-[13px] leading-[1.65] ${mutedTextClass}`}>
                  {line}
                </div>
              ))}
            </div>
          </Surface>
        </div>

        <Surface eyebrow="최근 신호" title="로드맵을 움직인 공식 업데이트">
          <div className="grid gap-3">
            {changes.slice(0, 3).map((change: any) => (
                <div key={change.change_id || change.title} className={panelClass}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className={`text-[20px] ${headingClass}`}>{change.title}</h3>
                    <MiniTag tone={change.impact_level === "high" ? "rose" : change.impact_level === "medium" ? "gold" : "slate"}>{change.impact_level === "high" ? "높음" : change.impact_level === "medium" ? "중간" : change.impact_level ? "낮음" : "미확인"}</MiniTag>
                  </div>
                  <p className={`mt-2 text-[13px] leading-[1.65] ${mutedTextClass}`}>{change.summary_ko || change.reasoning_ko}</p>
                <p className={`mt-2 text-[12px] leading-[1.55] ${mutedTextClass}`}>{change.source_title || change.publisher || "공식 소스"}</p>
                <p className="mt-1 text-[11px] font-semibold text-[rgba(245,247,251,0.48)]">확인 {latestCheckLabel}</p>
                </div>
            ))}
          </div>
        </Surface>
      </div>
    </AppFrame>
  );
}
