import Link from "next/link";
import { AppFrame, MetricCard, Surface, TimelineItem, headingClass, mutedTextClass, panelClass, primaryActionClass, secondaryActionClass } from "@/components/redesign-shell";
import { ProfileWorkflow } from "@/components/profile-workflow";
import { loadProfileWorkspace } from "@/lib/compass-data";
import { getSessionUser } from "@/lib/local-account-store";
import { navItems } from "@/lib/redesign-data";
import { cookies } from "next/headers";

export default async function AssessmentPage() {
  const sessionToken = (await cookies()).get("pc_session")?.value;
  const user = await getSessionUser(sessionToken);
  const profile = await loadProfileWorkspace(user?.id);

  return (
    <AppFrame
      title="프로필 평가"
      subtitle="이민 전략에 실제로 영향을 주는 변수만 짧고 가볍게 수집하는 단계형 흐름입니다."
      status={profile.profile_complete ? "연결됨" : profile.updated_at ? "진행 중" : "단계식"}
      navItems={navItems.map((item) => ({ ...item, active: item.href === "/app/account" }))}
      action={
        <Link href="/app/pathways" className={primaryActionClass}>
          경로 미리보기
        </Link>
      }
      secondaryAction={
        <Link href="/app" className={secondaryActionClass}>
          대시보드로
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Surface eyebrow="단계" title="평가 흐름">
          <div className="space-y-2">
            {[
              { title: "기본 정보", note: "생년월일, 거주 상태, 학력, ECA/WES, 경력" },
              { title: "BC PNP", note: "직업군, 연결성, 고용주, TEER" },
              { title: "Express Entry", note: "자동 CRS, 언어, 카테고리, 제출 상태" },
            ].map((step, index) => (
              <div key={step.title} className="flex items-start gap-3 rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#b69a45]/45 bg-[#b69a45]/14 font-sans text-[13px] font-semibold text-[#f5ecc7]">
                  {index + 1}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#f5f7fb]">{step.title}</p>
                  <p className={`mt-1 text-[12px] leading-[1.55] ${mutedTextClass}`}>{step.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Surface>

        <div className="grid gap-4">
          <Surface eyebrow="현재 단계" title="프로필 입력">
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <article className={panelClass}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 items-center rounded-full border border-[#b69a45]/45 bg-[#b69a45]/14 px-3 text-[11px] font-semibold text-[#f5ecc7]">구조화 입력만</span>
                  <span className="inline-flex h-7 items-center rounded-full border border-white/10 bg-white/[0.055] px-3 text-[11px] font-semibold text-[rgba(245,247,251,0.72)]">예측 가능한 값</span>
                </div>
                <h3 className={`mt-3 text-[24px] ${headingClass}`}>한 번에 한 구조만 입력합니다.</h3>
                <p className={`mt-2 text-[13px] leading-[1.65] ${mutedTextClass}`}>
                  자유 텍스트는 전략 판단에 쓰지 않고, 선택형 / 날짜형 / 숫자형 / 이진 값을 저장합니다. 저장 후에는 오늘의 브리핑과 경로 비교가 자동으로 다시 계산됩니다.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <MetricCard label="준비도" value={profile.profile_complete ? "완료" : profile.updated_at ? "진행 중" : "미등록"} detail="현재 상태를 먼저 구조화합니다." accent="teal" />
                  <MetricCard label="핵심 경로" value={profile.strongest_route || "대기"} detail={profile.main_status || "저장 후 최강 경로를 계산합니다."} accent="gold" />
                </div>
              </article>

              <article className={panelClass}>
                <h3 className={`text-[20px] ${headingClass}`}>구조화 입력 원칙</h3>
                <div className="mt-3 space-y-3">
                  {[
                    ["선택형", "카테고리와 상태는 목록/분할 선택으로 고정"],
                    ["날짜형", "생년월일은 Vancouver 기준 만 나이 계산에 사용"],
                    ["숫자형", "경력과 점수는 최소/최대 범위로 제한"],
                    ["이진형", "ECA/WES, 고용주, PNP 관심은 토글로 분리"],
                    ["해석 분리", "자유 텍스트는 나중에 보조 메모로만 사용"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
                      <p className="text-[13px] font-medium text-[#f5f7fb]">{label}</p>
                      <span className={`text-[13px] ${mutedTextClass}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </Surface>

          <ProfileWorkflow key={profile.updated_at || "assessment-profile"} profileBundle={profile} showIntro />

          <Surface eyebrow="흐름" title="프로필을 만들 때 보이는 것">
            <div className="grid gap-3 md:grid-cols-3">
              <TimelineItem index={1} title="짧게 시작" body="전략에 영향을 주는 항목만 첫 입력에 넣습니다." />
              <TimelineItem index={2} title="다음 질문 제시" body="한 단계가 끝나면 바로 다음 단계가 이어집니다." />
              <TimelineItem index={3} title="명확한 보상" body="마지막 화면은 일반 성공 메시지가 아니라 첫 전략 로드맵을 보여줍니다." />
            </div>
          </Surface>
        </div>
      </div>
    </AppFrame>
  );
}
