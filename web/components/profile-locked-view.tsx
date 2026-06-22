import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { AppFrame, MetricCard, MiniTag, Surface, headingClass, mutedTextClass, panelClass, primaryActionClass, secondaryActionClass } from "@/components/redesign-shell";
import { navItems } from "@/lib/redesign-data";

type ProfileLockedViewProps = {
  activeHref: string;
  title: string;
  subtitle: string;
  mode: "guest" | "profile";
};

export function ProfileLockedView({ activeHref, title, subtitle, mode }: ProfileLockedViewProps) {
  const isGuest = mode === "guest";

  return (
    <AppFrame
      title={title}
      subtitle={subtitle}
      status={isGuest ? "로그인 필요" : "프로필 잠금"}
      navItems={navItems.map((item) => ({ ...item, active: item.href === activeHref }))}
      action={
        <Link href={isGuest ? "/app/account" : "/app/assessment"} className={primaryActionClass}>
          {isGuest ? "로그인 / 회원가입" : "프로필 완료하기"}
        </Link>
      }
      secondaryAction={
        <Link href="/app" className={secondaryActionClass}>
          오늘의 브리핑
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Surface eyebrow="잠금 상태" title={isGuest ? "로그인 후 개인화 페이지가 열립니다" : "프로필 완료 후 이 페이지가 열립니다"}>
          <div className="grid gap-4">
            <div className="rounded-[18px] border border-[#b69a45]/25 bg-[linear-gradient(135deg,rgba(182,154,69,0.16),rgba(255,255,255,0.045)_48%)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <MiniTag tone="rose">{isGuest ? "비로그인" : "프로필 미완료"}</MiniTag>
                  <h2 className={`mt-3 text-[28px] ${headingClass}`}>{isGuest ? "샘플은 볼 수 있지만, 개인화 판단은 아직 잠겨 있습니다." : "필수 프로필을 완료해야 CRS/PNP 비교가 열립니다."}</h2>
                  <p className={`mt-3 max-w-2xl text-[13px] leading-[1.7] ${mutedTextClass}`}>
                    {isGuest
                      ? "공식 브리핑은 공개되어 있지만, 경로 비교와 시뮬레이션은 사용자별 프로필 기준이 필요합니다."
                      : "부분 저장은 하지 않습니다. 나이, 학력, 언어, 경력, 직업군, TEER, BC 연결, 잡오퍼, 고용주 지원까지 모두 입력하면 잠금이 해제됩니다."}
                  </p>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] border border-[#b69a45]/30 bg-[#b69a45]/12 text-[#f5ecc7]">
                  <LockKeyhole className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="자동 CRS" value="잠금" detail="CRS는 직접 입력하지 않고 프로필 완료 후 자동 계산합니다." accent="rose" />
              <MetricCard label="BC PNP" value="잠금" detail="직업군, TEER, 잡오퍼, BC 연결성으로 적합도와 추정 범위를 계산합니다." accent="rose" />
              <MetricCard label="개인 영향" value="잠금" detail="공식 업데이트가 내 경로에 미치는 영향은 프로필 완료 후 표시합니다." accent="rose" />
            </div>
          </div>
        </Surface>

        <Surface eyebrow="열리는 내용" title="프로필 완료 후 보이는 것">
          <div className="grid gap-3">
            {[
              ["경로 비교", "Express Entry는 CRS와 컷오프 거리로, BC PNP는 조건 정합도로 분리해 봅니다."],
              ["직업군 분석", "선택한 직업군과 TEER 기준으로 가까운 경로와 부족 요건을 보여줍니다."],
              ["공식 영향", "새 공식 업데이트가 내 점수/직업군/경로에 어떤 영향을 주는지 분리해서 보여줍니다."],
            ].map(([label, body]) => (
              <div key={label} className={panelClass}>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#d5bd6a]" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#f5f7fb]">{label}</p>
                    <p className={`mt-1 text-[12px] leading-[1.6] ${mutedTextClass}`}>{body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </AppFrame>
  );
}
