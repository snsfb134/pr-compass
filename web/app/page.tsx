import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronRight, Radar, ShieldCheck, TrendingUp } from "lucide-react";
import { pathways, profileState, publicSignals } from "@/lib/redesign-data";

function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-[10px]" : "h-11 w-11 rounded-[14px]";

  return (
    <img
      src="/brand-logo.png"
      alt=""
      className={`${box} shrink-0 border border-white/15 object-cover shadow-[0_0_30px_rgba(182,154,69,0.22)]`}
    />
  );
}

function SignalBar({ label, value, tone = "gold" }: { label: string; value: string; tone?: "gold" | "green" | "blue" }) {
  const fill =
    tone === "green"
      ? "bg-[linear-gradient(90deg,#70e4b0,rgba(112,228,176,0.18))]"
      : tone === "blue"
        ? "bg-[linear-gradient(90deg,#8eb8dc,rgba(142,184,220,0.18))]"
        : "bg-[linear-gradient(90deg,#d5bd6a,rgba(213,189,106,0.18))]";

  return (
    <div className="rounded-[14px] border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-[rgba(245,247,251,0.7)]">{label}</span>
        <strong className="text-[12px] font-semibold text-[#f5ecc7]">{value}</strong>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full w-[72%] rounded-full ${fill}`} />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_-10%,rgba(182,154,69,0.24),transparent_34%),linear-gradient(180deg,#08090d_0%,#11141a_58%,#151922_100%)] text-[#f5f7fb]">
      <nav className="mx-auto grid min-h-[68px] w-[min(1180px,calc(100vw-32px))] grid-cols-[1fr_auto_1fr] items-center gap-4 max-md:grid-cols-1">
        <Link href="/" className="inline-flex w-fit items-center gap-2.5 font-bold text-white">
          <BrandLogo size="sm" />
          <span>PR Compass</span>
        </Link>

        <div className="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.055] p-1 backdrop-blur-xl">
          <Link href="/app" className="rounded-full px-3 py-2 text-[13px] font-semibold text-[rgba(245,247,251,0.74)] transition hover:bg-white/[0.08] hover:text-white">
            대시보드
          </Link>
          <Link href="/app/signals" className="rounded-full px-3 py-2 text-[13px] font-semibold text-[rgba(245,247,251,0.74)] transition hover:bg-white/[0.08] hover:text-white">
            공식 신호
          </Link>
        </div>

        <Link
          href="/app"
          className="inline-flex h-9 w-fit items-center justify-self-end rounded-full border border-white/10 bg-white/[0.06] px-3 text-[13px] font-semibold text-[rgba(245,247,251,0.78)] transition hover:bg-white/[0.09] hover:text-white max-md:justify-self-start"
        >
          작업공간 열기
        </Link>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-92px)] w-[min(1180px,calc(100vw-32px))] grid-cols-[minmax(0,0.82fr)_minmax(620px,1.18fr)] items-center gap-8 pb-[72px] pt-11 max-lg:grid-cols-1 max-lg:pb-10">
        <div className="grid gap-5">
          <span className="w-fit rounded-full border border-[#d5bd6a]/30 bg-[#d5bd6a]/10 px-3 py-2 text-[12px] font-bold text-[#eadba3]">
            공식 업데이트 분석 + 개인 영향 예측
          </span>
          <h1 className="max-w-[640px] text-[clamp(42px,6vw,76px)] font-semibold leading-[0.98] tracking-[0] text-white">
            캐나다 영주권 전략을 공식 데이터 흐름으로 읽습니다.
          </h1>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">
            Your True North for Canadian PR decisions
          </p>
          <p className="max-w-[570px] text-[16px] leading-[1.7] text-[rgba(245,247,251,0.72)]">
            PR Compass는 BC PNP와 IRCC 공식 소스, 변경점, 구조화 기록, 개인 프로필 신호를 한 곳에서 연결해 오늘 무엇이 바뀌었고 CRS와 PNP 중
            어떤 경로가 더 가까운지 빠르게 보여줍니다.
          </p>

          <div className="mt-2 flex flex-wrap gap-2.5">
            <Link
              href="/app"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-white/15 bg-white px-4 text-[14px] font-bold text-[#101820] transition hover:translate-y-[-1px]"
            >
              운영 대시보드 열기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/app?state=empty"
              className="inline-flex min-h-[42px] items-center rounded-full border border-white/15 bg-white/[0.07] px-4 text-[14px] font-bold text-white transition hover:bg-white/[0.1]"
            >
              오늘의 브리핑 보기
            </Link>
            <Link
              href="/app/account"
              className="inline-flex min-h-[42px] items-center rounded-full border border-white/15 bg-white/[0.07] px-4 text-[14px] font-bold text-white transition hover:bg-white/[0.1]"
            >
              로그인 / 회원가입
            </Link>
          </div>

          <div className="grid max-w-[560px] grid-cols-3 gap-3 border-t border-white/10 pt-5 max-sm:grid-cols-1">
            {[
              ["감시 신호", `${publicSignals.length}`],
              ["주요 경로", `${pathways.length}`],
              ["개인화 잠금", "해제"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[rgba(245,247,251,0.44)]">{label}</p>
                <strong className="mt-1 block text-[26px] font-semibold tracking-[0] text-white">{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <aside className="grid min-h-[540px] grid-cols-[180px_minmax(0,1fr)] overflow-hidden rounded-[22px] border border-white/10 bg-[rgba(18,21,29,0.8)] shadow-[0_28px_80px_rgba(0,0,0,0.44),inset_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl max-md:grid-cols-1">
          <div className="grid content-start gap-2 border-r border-white/10 bg-white/[0.035] p-[18px] max-md:hidden">
            <div className="mb-3 flex min-h-[38px] items-center gap-2.5">
              <BrandLogo size="sm" />
              <strong className="text-white">PR Compass</strong>
            </div>
            {["오늘의 브리핑", "관심 신호", "경로 적합도", "공식 근거", "소스 상태"].map((item, index) => (
              <span
                key={item}
                className={`rounded-lg px-2.5 py-2 text-[12px] font-semibold ${
                  index === 0 ? "bg-[#d5bd6a]/14 text-[#f5ecc7]" : "text-[rgba(245,247,251,0.62)]"
                }`}
              >
                {item}
              </span>
            ))}
          </div>

          <div className="grid content-start gap-3.5 p-[18px]">
            <div className="flex justify-between gap-3 text-[12px] text-[rgba(245,247,251,0.54)]">
              <span>Vancouver 기준 시각</span>
              <strong className="text-[#f5ecc7]">공식 소스 12개 추적</strong>
            </div>

            <article className="rounded-[18px] border border-[#d5bd6a]/25 bg-[linear-gradient(135deg,rgba(213,189,106,0.16),transparent_42%),rgba(255,255,255,0.055)] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
              <span className="text-[12px] font-bold text-[#cbb46a]">오늘의 브리핑</span>
              <h2 className="mt-2 max-w-[620px] text-[28px] font-semibold leading-[1.15] text-white">
                BC PNP와 Express Entry 신호를 분리해서 확인하세요.
              </h2>
              <p className="mt-2 text-[13px] leading-[1.55] text-[rgba(245,247,251,0.62)]">
                공식 기록은 근거로, 해석은 별도 패널로 표시해 판단 흐름을 흐리지 않습니다.
              </p>
            </article>

            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <article className="grid min-h-[144px] gap-2 rounded-[14px] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
                <span className="text-[12px] font-bold text-[#cbb46a]">BC PNP</span>
                <strong className="text-white">적합도 높음</strong>
                <SignalBar label="추정 등록 범위" value="92-118점" />
              </article>
              <article className="grid min-h-[144px] gap-2 rounded-[14px] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
                <span className="text-[12px] font-bold text-[#cbb46a]">Express Entry</span>
                <strong className="text-white">자동 CRS 486</strong>
                <SignalBar label="카테고리 신호" value="관찰" tone="green" />
              </article>
              <article className="grid min-h-[128px] gap-2 rounded-[14px] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
                <span className="text-[12px] font-bold text-[#cbb46a]">직업군 분석</span>
                <strong className="text-white">Tech / TEER 1</strong>
                <p className="m-0 text-[13px] leading-[1.55] text-[rgba(245,247,251,0.62)]">선택 직업군 기준으로 가까운 경로를 비교</p>
              </article>
              <article className="grid min-h-[128px] gap-2 rounded-[14px] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
                <span className="text-[12px] font-bold text-[#cbb46a]">공식 영향</span>
                <strong className="text-white">내 경로 영향</strong>
                <p className="m-0 text-[13px] leading-[1.55] text-[rgba(245,247,251,0.62)]">업데이트 전후 차이를 프로필 기준으로 해석</p>
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className="mx-auto grid w-[min(1180px,calc(100vw-32px))] grid-cols-3 gap-3 pb-10 max-md:grid-cols-1">
        {[
          ["01", "공식 소스 추적", "페이지 변경, 스냅샷, 기준 시각, 원문 링크를 기록합니다.", ShieldCheck],
          ["02", "변화 해석", "공식 데이터와 해석을 분리해 보여줍니다.", Radar],
          ["03", "개인 전략 연결", "프로필 기준으로 BC PNP와 Express Entry 적합도를 비교합니다.", TrendingUp],
        ].map(([index, title, body, Icon]) => (
          <article key={String(title)} className="rounded-[14px] border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-extrabold tracking-[0.22em] text-[#d5bd6a]">{String(index)}</span>
              <Icon className="h-4 w-4 text-[#d5bd6a]" />
            </div>
            <strong className="mt-3 block text-white">{String(title)}</strong>
            <p className="mt-2 text-[13px] leading-[1.65] text-[rgba(245,247,251,0.62)]">{String(body)}</p>
          </article>
        ))}
      </section>

      <footer className="mx-auto flex w-[min(1180px,calc(100vw-32px))] items-center justify-between gap-4 border-t border-white/10 py-5 text-[12px] text-[rgba(245,247,251,0.5)] max-sm:flex-col max-sm:items-start">
        <span className="inline-flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-[#70e4b0]" />
          PR Compass · 공식 이민 신호를 읽는 캐나다 PR 전략 도구
        </span>
        <Link href="/app" className="inline-flex items-center gap-1 font-semibold text-[#f5ecc7]">
          대시보드로 이동
          <ChevronRight className="h-4 w-4" />
        </Link>
      </footer>
    </main>
  );
}
