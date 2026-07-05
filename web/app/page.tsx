import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BadgeCheck, ChevronRight, Mail, Radar, Sparkles } from "lucide-react";
import { SubscriptionForm } from "@/components/subscription-form";
import { createSampleBriefing } from "@/lib/briefing-data";

const sample = createSampleBriefing("sample");

function BrandLogo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <img src="/brand-logo.png" alt="" className="h-10 w-10 rounded-[13px] border border-white/15 object-cover shadow-[0_0_28px_rgba(182,154,69,0.22)]" />
      <div>
        <strong className="block text-[15px] text-white">PR Compass</strong>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d5bd6a]">Your True North</span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_-10%,rgba(182,154,69,0.24),transparent_34%),linear-gradient(180deg,#08090d_0%,#11141a_58%,#090b10_100%)] text-[#f5f7fb]">
      <nav className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100vw-32px))] items-center justify-between gap-4">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <Link href="/briefing/sample" className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.055] px-3 text-[12px] font-semibold text-[rgba(245,247,251,0.74)] transition hover:border-[#b69a45]/45 hover:text-[#f5ecc7]">
            샘플 보기
          </Link>
          <a href="#subscribe" className="inline-flex h-9 items-center rounded-full border border-[#b69a45] bg-[#b69a45] px-3 text-[12px] font-bold text-[#101820] transition hover:translate-y-[-1px]">
            구독하기
          </a>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-92px)] w-[min(1180px,calc(100vw-32px))] grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)] items-center gap-8 pb-[72px] pt-10 max-lg:grid-cols-1 max-lg:pb-10">
        <div className="grid gap-5">
          <span className="w-fit rounded-full border border-[#d5bd6a]/30 bg-[#d5bd6a]/10 px-3 py-2 text-[12px] font-bold text-[#eadba3]">
            BC PNP + Express Entry AI 브리핑
          </span>
          <h1 className="max-w-[690px] text-[clamp(42px,6vw,76px)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
            공식 업데이트를 AI 분석으로 먼저 받아보세요.
          </h1>
          <p className="max-w-[590px] text-[16px] leading-[1.75] text-[rgba(245,247,251,0.72)]">
            PR Compass는 WelcomeBC와 IRCC 공식 업데이트를 추적하고, BC PNP와 Express Entry 흐름을 함께 비교해 한국어 이메일 브리핑으로 정리합니다.
            자세한 과거 대비 분석은 구독자 원페이지에서 이어서 볼 수 있습니다.
          </p>

          <div className="grid max-w-[620px] gap-3 sm:grid-cols-3">
            {[
              ["짧은 이메일", "핵심 변화만 먼저"],
              ["AI 비교 해석", "BC PNP와 EE를 함께"],
              ["원페이지 분석", "과거 기록 대비 전망"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[16px] border border-white/10 bg-white/[0.055] p-4">
                <p className="text-[13px] font-semibold text-white">{title}</p>
                <p className="mt-1 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.62)]">{body}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <a href="#subscribe" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#b69a45] bg-[#b69a45] px-5 text-[14px] font-bold text-[#101820] transition hover:translate-y-[-1px]">
              무료 브리핑 구독
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/briefing/sample" className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 bg-white/[0.07] px-5 text-[14px] font-bold text-white transition hover:bg-white/[0.1]">
              샘플 화면 보기
            </Link>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="rounded-[26px] border border-white/10 bg-[rgba(18,21,29,0.82)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.38),inset_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Email Preview</p>
                <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-white">메일은 짧게, 분석은 깊게</h2>
              </div>
              <span className="rounded-full border border-[#70e4b0]/35 bg-[#70e4b0]/12 px-3 py-2 text-[11px] font-bold text-[#c9f8e4]">AI 분석</span>
            </div>

            <div className="mt-4 rounded-[18px] border border-white/10 bg-[#0d1016] p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-[#b69a45]/35 bg-[#b69a45]/14 text-[#f5ecc7]">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-white">{sample.emailPreview.subject}</p>
                  <p className="text-[12px] text-[rgba(245,247,251,0.55)]">새 공식 업데이트 감지 시 발송</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {sample.emailPreview.bullets.map((bullet) => (
                  <p key={bullet} className="rounded-[13px] border border-white/10 bg-white/[0.045] px-3 py-3 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.72)]">
                    {bullet}
                  </p>
                ))}
              </div>
              <Link href="/briefing/sample" className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-[12px] font-bold text-[#f5ecc7]">
                자세한 분석 보기
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PreviewCard icon={<Sparkles className="h-4 w-4" />} title="BC PNP 영향" body={sample.bcPnpImpact.signal} />
            <PreviewCard icon={<Radar className="h-4 w-4" />} title="Express Entry 영향" body={sample.expressEntryImpact.signal} />
          </div>
        </aside>
      </section>

      <section id="subscribe" className="mx-auto grid w-[min(1180px,calc(100vw-32px))] gap-5 border-t border-white/10 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-center gap-4">
          <p className="w-fit rounded-full border border-[#d5bd6a]/30 bg-[#d5bd6a]/10 px-3 py-2 text-[12px] font-bold text-[#eadba3]">무료 구독</p>
          <h2 className="max-w-[680px] text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] text-white">이름, 이메일, 소속만 남기면 새 공식 업데이트를 놓치지 않습니다.</h2>
          <p className="max-w-[620px] text-[15px] leading-[1.75] text-[rgba(245,247,251,0.68)]">
            구독자에게는 짧은 이메일 요약과 상세 분석 링크를 제공합니다. 로그인이나 프로필 입력 없이 시작하고, 실제 발송 채널은 다음 단계에서 연결합니다.
          </p>
          <div className="grid max-w-[680px] gap-3 md:grid-cols-3">
            {[
              ["01", "공식 업데이트 감지"],
              ["02", "AI 요약·비교"],
              ["03", "이메일 링크로 원페이지 확인"],
            ].map(([index, title]) => (
              <div key={title} className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
                <span className="text-[11px] font-extrabold tracking-[0.22em] text-[#d5bd6a]">{index}</span>
                <p className="mt-2 text-[13px] font-semibold text-white">{title}</p>
              </div>
            ))}
          </div>
        </div>
        <SubscriptionForm />
      </section>

      <footer className="mx-auto flex w-[min(1180px,calc(100vw-32px))] items-center justify-between gap-4 border-t border-white/10 py-5 text-[12px] text-[rgba(245,247,251,0.5)] max-sm:flex-col max-sm:items-start">
        <span className="inline-flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-[#70e4b0]" />
          PR Compass · 공식 업데이트를 AI로 읽는 캐나다 PR 브리핑
        </span>
        <Link href="/briefing/sample" className="inline-flex items-center gap-1 font-semibold text-[#f5ecc7]">
          샘플 브리핑 보기
          <ChevronRight className="h-4 w-4" />
        </Link>
      </footer>
    </main>
  );
}

function PreviewCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article className="rounded-[18px] border border-white/10 bg-white/[0.055] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#d5bd6a]">{icon}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-[rgba(245,247,251,0.62)]">관찰</span>
      </div>
      <p className="mt-3 text-[14px] font-semibold text-white">{title}</p>
      <p className="mt-1 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.62)]">{body}</p>
    </article>
  );
}
