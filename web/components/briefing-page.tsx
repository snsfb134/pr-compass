import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, ExternalLink, Layers3, Mail, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import type { BriefingCategorySummary, BriefingData, BriefingProgramVisuals } from "@/lib/briefing-data";
import { SubscriptionForm } from "@/components/subscription-form";

export function BriefingPage({ briefing }: { briefing: BriefingData }) {
  const isSample = briefing.mode === "sample";

  return (
    <main id="top" className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_-12%,rgba(182,154,69,0.22),transparent_34%),linear-gradient(180deg,#08090d_0%,#11141a_62%,#090b10_100%)] text-[#f5f7fb]">
      <header className="mx-auto flex w-[min(1180px,calc(100vw-32px))] items-center justify-between gap-4 py-4">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <img src="/brand-logo.png" alt="" className="h-10 w-10 rounded-[13px] border border-white/15 object-cover shadow-[0_0_26px_rgba(182,154,69,0.2)]" />
          <div>
            <strong className="block text-[15px] text-white">PR Compass</strong>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d5bd6a]">Your True North</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {isSample ? (
            <Link href="/#subscribe" className="hidden h-9 items-center rounded-full border border-[#b69a45]/45 bg-[#b69a45]/14 px-3 text-[12px] font-bold text-[#f5ecc7] sm:inline-flex">
              구독하기
            </Link>
          ) : null}
          <Link href="/briefing/sample" className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.055] px-3 text-[12px] font-semibold text-[rgba(245,247,251,0.74)]">
            샘플 보기
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-[min(1180px,calc(100vw-32px))] gap-4 pb-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <article className="rounded-[26px] border border-[#b69a45]/25 bg-[linear-gradient(135deg,rgba(182,154,69,0.18),transparent_46%),rgba(255,255,255,0.06)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.32),inset_0_1px_rgba(255,255,255,0.06)] md:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center rounded-full border border-[#b69a45]/40 bg-[#b69a45]/14 px-3 text-[11px] font-extrabold tracking-[0.18em] text-[#f5ecc7]">
                {briefing.updateLabel}
              </span>
              {briefing.updateMeta?.typeLabel ? (
                <span className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.055] px-3 text-[11px] font-bold text-[rgba(245,247,251,0.72)]">
                  {briefing.updateMeta.typeLabel}
                </span>
              ) : null}
              <span className="text-[12px] font-semibold text-[rgba(245,247,251,0.58)]">{briefing.generatedAt}</span>
            </div>
            <h1 className="mt-5 max-w-[840px] text-[clamp(34px,5vw,62px)] font-semibold leading-[1.02] text-white">
              {briefing.headline}
            </h1>
            <p className="mt-5 max-w-[760px] text-[16px] leading-[1.75] text-[rgba(245,247,251,0.72)]">{briefing.latestUpdate.summary}</p>
            {briefing.updateMeta ? (
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <MetaPill label="출처" value={briefing.updateMeta.source} />
                <MetaPill label="확인 시각" value={briefing.updateMeta.displayDetectedAt || "확인 시각 미상"} />
                <MetaPill label="분석 기준" value={briefing.updateMeta.basis} />
              </div>
            ) : null}
            {isSample ? (
              <p className="mt-4 rounded-[16px] border border-white/10 bg-white/[0.055] px-4 py-3 text-[13px] leading-[1.65] text-[rgba(245,247,251,0.7)]">
                이 화면은 실제 구독자 분석 페이지와 같은 레이아웃입니다. 배포 환경에서 공식 데이터 API가 연결된 항목만 표시합니다.
              </p>
            ) : null}
            {briefing.dataQualityWarnings?.length ? (
              <div className="mt-4 rounded-[16px] border border-[#e59a9a]/35 bg-[#e59a9a]/10 px-4 py-3">
                <p className="text-[12px] font-bold text-[#ffd5d5]">데이터 품질 경고</p>
                <ul className="mt-2 grid gap-1.5">
                  {briefing.dataQualityWarnings.slice(0, 3).map((warning) => (
                    <li key={warning} className="text-[12px] leading-[1.55] text-[rgba(255,213,213,0.86)]">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>

          <BriefingVisualSystem briefing={briefing} />

          {hasInterpretation(briefing) ? (
            <section className="grid gap-4 md:grid-cols-2">
              {briefing.aiSummary ? <ImpactPanel label="AI 요약" title={briefing.latestUpdate.title} body={briefing.aiSummary} chip={briefing.latestUpdate.source} tone="gold" /> : null}
              {hasPanelContent(briefing.bcPnpImpact) ? <ImpactPanel label="BC PNP 영향" title={briefing.bcPnpImpact.title} body={briefing.bcPnpImpact.body} chip={briefing.bcPnpImpact.signal} tone="teal" /> : null}
              {hasPanelContent(briefing.expressEntryImpact) ? <ImpactPanel label="Express Entry 영향" title={briefing.expressEntryImpact.title} body={briefing.expressEntryImpact.body} chip={briefing.expressEntryImpact.signal} tone="blue" /> : null}
              {briefing.historicalComparison.points.length ? <ImpactPanel label="과거 데이터 대비" title={briefing.historicalComparison.title} body={briefing.historicalComparison.body} chip="비교 해석" tone="slate" /> : null}
            </section>
          ) : null}

          {briefing.historicalComparison.points.length ? (
          <section className="rounded-[22px] border border-white/10 bg-white/[0.055] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Historical Context</p>
            <h2 className="mt-2 text-[25px] font-semibold text-white">이번 업데이트를 과거 흐름 위에서 보면</h2>
            <div className="mt-4 grid gap-3">
              {briefing.historicalComparison.points.map((point, index) => (
                <div key={point} className="flex gap-3 rounded-[16px] border border-white/10 bg-[#0d1016] px-4 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#b69a45]/40 bg-[#b69a45]/14 text-[12px] font-bold text-[#f5ecc7]">{index + 1}</span>
                  <p className="text-[13px] leading-[1.65] text-[rgba(245,247,251,0.72)]">{point}</p>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {briefing.evidence.length ? (
          <section className="rounded-[22px] border border-white/10 bg-white/[0.055] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Official Evidence</p>
                <h2 className="mt-2 text-[25px] font-semibold text-white">최근 공식 근거 5개</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-[11px] font-semibold text-[rgba(245,247,251,0.66)]">원문과 AI 해석 분리</span>
            </div>
            <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-[18px] border border-white/10">
              {briefing.evidence.map((item) => (
                <a key={`${item.publisher}-${item.title}`} href={item.url} target="_blank" rel="noreferrer" className="grid gap-2 bg-[#0d1016]/80 px-4 py-4 transition hover:bg-white/[0.06] md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-[13px] font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.62)]">{item.note}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#f5ecc7]">
                    {item.publisher} · {item.date}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                </a>
              ))}
            </div>
          </section>
          ) : null}
        </div>

        <aside className="grid content-start gap-4">
          {briefing.watchPoints.length ? (
          <section className="rounded-[22px] border border-[#b69a45]/25 bg-[#b69a45]/10 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-[#b69a45]/35 bg-[#b69a45]/14 text-[#f5ecc7]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[#f5f7fb]">다음 관찰 포인트</p>
                <p className="text-[12px] text-[rgba(245,247,251,0.62)]">
                  신뢰도 {briefing.confidence ?? 60}% · {briefing.trendDirection === "mixed" ? "혼합 신호" : briefing.trendDirection === "strengthening" ? "강화 신호" : briefing.trendDirection === "weakening" ? "약화 신호" : "판단 보류"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {briefing.watchPoints.map((point) => (
                <div key={point} className="rounded-[14px] border border-white/10 bg-[#0d1016]/70 px-3 py-3 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.72)]">
                  {point}
                </div>
              ))}
            </div>
          </section>
          ) : null}

          <section className="rounded-[22px] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-white/10 bg-white/[0.06] text-[#f5ecc7]">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[#f5f7fb]">이메일 미리보기</p>
                <p className="text-[12px] text-[rgba(245,247,251,0.62)]">{briefing.emailPreview.subject}</p>
              </div>
            </div>
            {briefing.emailPreview.intro ? (
              <p className="mt-4 rounded-[14px] border border-[#b69a45]/25 bg-[#b69a45]/10 px-3 py-3 text-[12px] leading-[1.6] text-[#f5ecc7]">
                {briefing.emailPreview.intro}
              </p>
            ) : null}
            {briefing.emailPreview.meta?.length ? (
              <div className="mt-3 grid gap-2">
                {briefing.emailPreview.meta.map((item) => (
                  <p key={item} className="rounded-[12px] border border-white/10 bg-white/[0.045] px-3 py-2 text-[11px] leading-[1.5] text-[rgba(245,247,251,0.66)]">
                    {item}
                  </p>
                ))}
              </div>
            ) : null}
            <ul className="mt-4 grid gap-2">
              {briefing.emailPreview.bullets.map((bullet) => (
                <li key={bullet} className="rounded-[14px] border border-white/10 bg-[#0d1016] px-3 py-3 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.72)]">
                  {bullet}
                </li>
              ))}
            </ul>
            <a href="#top" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] text-[12px] font-bold text-[#f5ecc7]">
              원페이지 상단으로
              <ArrowRight className="h-4 w-4" />
            </a>
          </section>

          {isSample ? <SubscriptionForm compact /> : null}

          {!isSample && briefing.subscriber ? (
            <section className="rounded-[18px] border border-white/10 bg-white/[0.055] p-4 text-[13px] leading-[1.65] text-[rgba(245,247,251,0.72)]">
              <p className="font-semibold text-white">{briefing.subscriber.name}님 브리핑</p>
              <p>{briefing.subscriber.email}</p>
              <p>소속: {briefing.subscriber.affiliation}</p>
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-[#0d1016]/70 px-3 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#d5bd6a]">{label}</p>
      <p className="mt-1 text-[12px] leading-[1.45] text-[rgba(245,247,251,0.72)]">{value}</p>
    </div>
  );
}

function BriefingVisualSystem({ briefing }: { briefing: BriefingData }) {
  const bcPnp = briefing.visuals?.bcPnp;
  const expressEntry = briefing.visuals?.expressEntry;
  const sourceHealth = briefing.visuals?.sourceHealth;
  const timeline = briefing.evidence.slice(0, 5);
  const hasProgramData = hasProgramVisualData(bcPnp) || hasProgramVisualData(expressEntry);
  const hasCategoryData = Boolean((bcPnp?.categories.length ?? 0) || (expressEntry?.categories.length ?? 0));

  if (!hasProgramData && !hasCategoryData && !sourceHealth && !timeline.length) {
    return null;
  }

  return (
    <section className="grid gap-4">
      {hasProgramData ? (
      <article className="rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(182,154,69,0.12),rgba(255,255,255,0.045))] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Data Scale</p>
            <h2 className="mt-2 text-[25px] font-semibold text-white">기록 규모가 보이는 브리핑</h2>
            <p className="mt-2 max-w-[760px] text-[13px] leading-[1.65] text-[rgba(245,247,251,0.66)]">
              최신 해석만 읽는 카드가 아니라, BC PNP와 Express Entry의 누적 공식 기록을 작은 차트와 카테고리 밀도로 먼저 훑게 합니다.
            </p>
          </div>
          <PeriodControl />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {hasProgramVisualData(bcPnp) ? <ProgramMiniChart title="BC PNP" subtitle="직군/스트림 중심" tone="teal" data={bcPnp} /> : null}
          {hasProgramVisualData(expressEntry) ? <ProgramMiniChart title="Express Entry" subtitle="라운드/카테고리 중심" tone="blue" data={expressEntry} /> : null}
        </div>
      </article>
      ) : null}

      {hasCategoryData || sourceHealth ? (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        {hasCategoryData ? (
        <article className="rounded-[22px] border border-white/10 bg-white/[0.055] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Category Heat Strip</p>
              <h2 className="mt-2 text-[25px] font-semibold text-white">많은 카테고리는 상위 신호부터 접어 보기</h2>
              <p className="mt-2 max-w-[620px] text-[13px] leading-[1.65] text-[rgba(245,247,251,0.66)]">
                전체 표를 펼치기 전에 기록 수와 최신 점수/초청 수가 있는 상위 카테고리를 먼저 보여줍니다.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#b69a45]/35 bg-[#b69a45]/12 px-3 py-2 text-[11px] font-bold text-[#f5ecc7]">
              <Layers3 className="h-3.5 w-3.5" />
              Top categories
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            {bcPnp?.categories.length ? <CategoryHeatStrip title="BC PNP" categories={bcPnp.categories} tone="teal" /> : null}
            {expressEntry?.categories.length ? <CategoryHeatStrip title="Express Entry" categories={expressEntry.categories} tone="blue" /> : null}
          </div>
        </article>
        ) : null}

        {sourceHealth ? (
        <article className="rounded-[22px] border border-white/10 bg-white/[0.055] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Source Health</p>
              <h2 className="mt-2 text-[25px] font-semibold text-white">공식 소스 상태</h2>
            </div>
            <span className={`grid h-10 w-10 place-items-center rounded-[14px] border ${sourceHealth?.errorCount ? "border-[#e59a9a]/35 bg-[#e59a9a]/10 text-[#ffd5d5]" : "border-[#70e4b0]/30 bg-[#70e4b0]/10 text-[#c9f8e4]"}`}>
              {sourceHealth?.errorCount ? <ShieldAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <SourceHealthStat label="소스" value={sourceHealth?.sourceCount ?? 0} />
            <SourceHealthStat label="정상" value={sourceHealth?.okCount ?? 0} tone="good" />
            <SourceHealthStat label="경고" value={sourceHealth?.errorCount ?? 0} tone={sourceHealth?.errorCount ? "warn" : "default"} />
          </div>
          <p className="mt-4 rounded-[14px] border border-white/10 bg-[#0d1016]/70 px-3 py-3 text-[12px] leading-[1.6] text-[rgba(245,247,251,0.68)]">
            품질 상태는 AI 해석과 분리해서 봅니다. 소스 오류가 있으면 최신성 판단을 보수적으로 표시하고, 이메일은 중요도에 따라 보류하거나 경고와 함께 발송합니다.
          </p>
          <p className="mt-2 text-[11px] text-[rgba(245,247,251,0.48)]">마지막 확인: {formatBriefingDate(sourceHealth?.latestCheckedAt)}</p>
        </article>
        ) : null}
      </section>
      ) : null}

      {timeline.length ? (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <article className="rounded-[22px] border border-white/10 bg-white/[0.055] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
          <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Past To Latest</p>
            <h2 className="mt-2 text-[25px] font-semibold text-white">최근 근거 흐름</h2>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-white/10 bg-white/[0.06] text-[#f5ecc7]">
            <TrendingUp className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-5 grid gap-3">
          {timeline.map((item, index) => (
            <a key={`${item.publisher}-${item.title}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="group grid grid-cols-[auto_1fr] gap-3 rounded-[16px] border border-white/10 bg-[#0d1016]/75 p-3 transition hover:border-[#b69a45]/35 hover:bg-white/[0.06]">
              <div className="grid justify-items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-[#b69a45]/35 bg-[#b69a45]/12 text-[11px] font-bold text-[#f5ecc7]">{index + 1}</span>
                {index < timeline.length - 1 ? <span className="h-full w-px bg-white/10" /> : null}
              </div>
              <div className="min-w-0 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[#d5bd6a]">{item.publisher}</span>
                  <span className="text-[11px] text-[rgba(245,247,251,0.48)]">{item.date}</span>
                </div>
                <p className="mt-1 text-[13px] font-semibold leading-[1.45] text-white">{item.title}</p>
                <p className="mt-1 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.62)]">{item.note}</p>
              </div>
            </a>
          ))}
        </div>
        </article>

        <article className="rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(182,154,69,0.12),rgba(255,255,255,0.045))] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Program Compare</p>
            <h2 className="mt-2 text-[25px] font-semibold text-white">BC PNP와 Express Entry는 같은 표에서 줄 세우지 않습니다</h2>
            <p className="mt-2 max-w-[760px] text-[13px] leading-[1.65] text-[rgba(245,247,251,0.66)]">
              BC PNP는 직군·스트림·초청 점수 흐름을 보고, Express Entry는 라운드 타입·CRS 컷오프·초청 수를 봅니다. 화면은 두 축을 나란히 두되 판단 기준을 분리해 읽히게 합니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-bold text-[rgba(245,247,251,0.7)]">
            <BarChart3 className="h-3.5 w-3.5" />
            비교 기준 분리
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <CompareAxis title="BC PNP" rows={["카테고리/직업군 반복 여부", "최소 점수와 초청 수 변화", "고용주·스트림 조건의 변화 가능성"]} tone="border-[#70e4b0]/20 bg-[#70e4b0]/10" />
          <CompareAxis title="Express Entry" rows={["라운드 타입과 카테고리 구분", "CRS 컷오프와 초청 수 변화", "PNP round와 일반/CEC 흐름 분리"]} tone="border-[#8eb8dc]/20 bg-[#8eb8dc]/10" />
        </div>
        </article>
      </section>
      ) : null}
    </section>
  );
}

function PeriodControl() {
  return (
    <div className="inline-grid grid-cols-3 overflow-hidden rounded-full border border-white/10 bg-white/[0.055] p-1">
      {["30일", "90일", "전체"].map((label) => (
        <span key={label} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${label === "전체" ? "bg-[#b69a45] text-[#101820]" : "text-[rgba(245,247,251,0.6)]"}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

function ProgramMiniChart({
  title,
  subtitle,
  tone,
  data,
}: {
  title: string;
  subtitle: string;
  tone: "teal" | "blue";
  data?: BriefingProgramVisuals;
}) {
  const categories = (data?.categories ?? []).slice(0, 5);
  const maxCount = Math.max(1, ...categories.map((item) => item.count || 0));
  const latest = data?.latestDraw;
  const accent = tone === "teal" ? "bg-[#70e4b0]" : "bg-[#8eb8dc]";
  const soft = tone === "teal" ? "border-[#70e4b0]/20 bg-[#70e4b0]/10" : "border-[#8eb8dc]/20 bg-[#8eb8dc]/10";

  return (
    <div className={`rounded-[18px] border p-4 ${soft}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-white">{title}</p>
          <p className="mt-1 text-[12px] text-[rgba(245,247,251,0.6)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-[24px] font-semibold text-white">{data?.recordCount ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[rgba(245,247,251,0.48)]">records</p>
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-white/10 bg-[#0d1016]/65 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-white">{latest?.stage || latest?.title}</p>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-[rgba(245,247,251,0.66)]">{formatBriefingDate(latest?.event_date)}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {latest?.minimum_score ? <MetricPill label="최신 점수" value={latest.minimum_score} /> : null}
          {latest?.invitations ? <MetricPill label="초청 수" value={latest.invitations} /> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {categories.map((category) => (
          <div key={category.label} className="grid grid-cols-[minmax(0,1fr)_46px] items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[11px] font-semibold text-[rgba(245,247,251,0.78)]">{category.label}</p>
                <p className="text-[10px] text-[rgba(245,247,251,0.48)]">{category.count}건</p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(10, (category.count / maxCount) * 100)}%` }} />
              </div>
            </div>
            <p className="text-right text-[11px] font-bold text-[#f5ecc7]">{category.latest_score || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.045] px-3 py-2">
      <p className="text-[10px] font-bold text-[rgba(245,247,251,0.48)]">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-white">{value}</p>
    </div>
  );
}

function CategoryHeatStrip({ title, categories, tone }: { title: string; categories: BriefingCategorySummary[]; tone: "teal" | "blue" }) {
  const visible = categories.slice(0, 8);
  const rest = Math.max(0, categories.length - visible.length);
  const maxCount = Math.max(1, ...visible.map((item) => item.count || 0));
  const color = tone === "teal" ? "bg-[#70e4b0]" : "bg-[#8eb8dc]";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-white">{title}</p>
        {rest ? <span className="text-[11px] text-[rgba(245,247,251,0.5)]">+{rest}개 접힘</span> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((item) => (
          <div key={`${title}-${item.label}`} className="rounded-[14px] border border-white/10 bg-[#0d1016]/70 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-[10px] text-[rgba(245,247,251,0.48)]">{[formatBriefingDate(item.latest_event_date), item.latest_invitations ? `${item.latest_invitations}명` : ""].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-[#f5ecc7]">{item.latest_score || "-"}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(12, ((item.count || 0) / maxCount) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceHealthStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "good" | "warn" }) {
  const toneClass = tone === "good" ? "text-[#c9f8e4]" : tone === "warn" ? "text-[#ffd5d5]" : "text-white";
  return (
    <div className="rounded-[14px] border border-white/10 bg-[#0d1016]/70 p-3 text-center">
      <p className={`text-[22px] font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[10px] font-bold text-[rgba(245,247,251,0.48)]">{label}</p>
    </div>
  );
}

function CompareAxis({ title, rows, tone }: { title: string; rows: string[]; tone: string }) {
  return (
    <div className={`rounded-[18px] border p-4 ${tone}`}>
      <p className="text-[14px] font-semibold text-white">{title}</p>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div key={row} className="rounded-[13px] border border-white/10 bg-[#0d1016]/65 px-3 py-2.5 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.72)]">
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBriefingDate(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }
  return value;
}

function hasProgramVisualData(data?: BriefingProgramVisuals) {
  return Boolean(data && (data.recordCount > 0 || data.latestDraw || data.categories.length));
}

function hasPanelContent(panel: { title: string; body: string; signal: string }) {
  return Boolean(panel.title && panel.body && panel.signal !== "데이터 대기");
}

function hasInterpretation(briefing: BriefingData) {
  return Boolean(
    briefing.aiSummary ||
      hasPanelContent(briefing.bcPnpImpact) ||
      hasPanelContent(briefing.expressEntryImpact) ||
      briefing.historicalComparison.points.length,
  );
}

function ImpactPanel({
  label,
  title,
  body,
  chip,
  tone,
}: {
  label: string;
  title: string;
  body: string;
  chip: string;
  tone: "gold" | "teal" | "blue" | "slate";
}) {
  const toneClass =
    tone === "gold"
      ? "border-[#b69a45]/25 bg-[linear-gradient(180deg,rgba(182,154,69,0.15),rgba(255,255,255,0.055))]"
      : tone === "teal"
        ? "border-[#70e4b0]/20 bg-[linear-gradient(180deg,rgba(112,228,176,0.11),rgba(255,255,255,0.055))]"
        : tone === "blue"
          ? "border-[#8eb8dc]/20 bg-[linear-gradient(180deg,rgba(142,184,220,0.12),rgba(255,255,255,0.055))]"
          : "border-white/10 bg-white/[0.055]";

  return (
    <article className={`rounded-[20px] border p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)] ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">{label}</p>
          <h2 className="mt-2 text-[21px] font-semibold leading-[1.2] text-white">{title}</h2>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[rgba(245,247,251,0.72)]">{chip}</span>
      </div>
      <p className="mt-4 text-[13px] leading-[1.7] text-[rgba(245,247,251,0.7)]">{body}</p>
    </article>
  );
}
