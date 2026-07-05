import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import type { BriefingData } from "@/lib/briefing-data";

type AdminBriefingResponse = {
  run_id?: string;
  generated_at?: string;
  status?: string;
  provider?: string;
  confidence?: number;
  trend_direction?: string;
  briefing?: Omit<BriefingData, "mode" | "subscriber">;
  error?: string;
};

async function loadLatestBriefing(): Promise<AdminBriefingResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/briefing/runs/latest`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as AdminBriefingResponse;
  } catch {
    return null;
  }
}

export default async function AdminBriefingsPage() {
  const run = await loadLatestBriefing();
  const briefing = run?.briefing;
  const warnings = briefing?.dataQualityWarnings ?? [];
  const isReady = Boolean(briefing && run?.status === "analyzed" && warnings.length === 0);
  const reviewLabel = !briefing ? "브리핑 없음" : isReady ? "발송 가능" : warnings.length ? "검수 필요" : "발송 가능";

  return (
    <main className="min-h-screen bg-[#08090d] text-[#f5f7fb]">
      <section className="mx-auto grid w-[min(1180px,calc(100vw-32px))] gap-5 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#d5bd6a]">
              PR Compass Admin
            </Link>
            <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.02em] text-white">브리핑 발송 검수</h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-[1.7] text-[rgba(245,247,251,0.66)]">
              새 공식 업데이트를 이메일로 보내기 전에 출처, 분석 기준, 품질 경고, 메일 미리보기를 한 화면에서 확인합니다.
            </p>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/[0.055] px-4 py-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d5bd6a]">검수 상태</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{reviewLabel}</p>
          </div>
        </header>

        {!briefing ? (
          <section className="rounded-[24px] border border-[#e59a9a]/30 bg-[#e59a9a]/10 p-6">
            <h2 className="text-[20px] font-semibold text-white">검수할 브리핑이 없습니다</h2>
            <p className="mt-2 text-[13px] leading-[1.7] text-[rgba(245,247,251,0.7)]">
              백엔드에서 브리핑 run을 먼저 생성한 뒤 다시 확인하세요.
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <article className="rounded-[24px] border border-[#b69a45]/25 bg-[linear-gradient(135deg,rgba(182,154,69,0.14),rgba(255,255,255,0.045))] p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge>{briefing.updateLabel}</Badge>
                  <Badge>{briefing.updateMeta?.typeLabel ?? briefing.latestUpdate.typeLabel ?? "공식 업데이트"}</Badge>
                  <Badge>{run?.provider ?? briefing.analysisProvider ?? "provider 미상"}</Badge>
                </div>
                <h2 className="mt-4 text-[30px] font-semibold leading-[1.15] text-white">{briefing.headline}</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <MetaCard label="출처" value={briefing.updateMeta?.source ?? briefing.latestUpdate.source} />
                  <MetaCard label="확인 시각" value={briefing.updateMeta?.displayDetectedAt || briefing.latestUpdate.detectedAt || "확인 시각 미상"} />
                  <MetaCard label="분석 기준" value={briefing.updateMeta?.basis ?? "공식 원문과 기록 비교"} />
                </div>
              </article>

              <aside className="grid gap-3">
                <AdminAction
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="발송 승인 기준"
                  body={isReady ? "품질 경고가 없어 발송 후보로 볼 수 있습니다." : "품질 경고 또는 fallback 상태를 먼저 확인하세요."}
                />
                <AdminAction
                  icon={<RefreshCw className="h-4 w-4" />}
                  title="재분석 명령"
                  body="python3 scripts/send_test_briefing_email.py --recipient-email you@example.com --scenarios 3 --pretty"
                />
                <AdminAction
                  icon={<Mail className="h-4 w-4" />}
                  title="실제 발송"
                  body="SMTP 또는 Resend credential이 설정된 환경에서만 sent 상태로 전환됩니다."
                />
              </aside>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Panel title="이메일 미리보기" eyebrow={briefing.emailPreview.updateTypeLabel ?? "Email Preview"}>
                {briefing.emailPreview.intro ? <p className="text-[14px] leading-[1.7] text-[#f5ecc7]">{briefing.emailPreview.intro}</p> : null}
                <div className="mt-4 grid gap-2">
                  {(briefing.emailPreview.meta ?? []).map((item) => (
                    <p key={item} className="rounded-[13px] border border-white/10 bg-[#0d1016] px-3 py-2 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.7)]">
                      {item}
                    </p>
                  ))}
                </div>
                <ul className="mt-4 grid gap-2">
                  {briefing.emailPreview.bullets.map((bullet) => (
                    <li key={bullet} className="rounded-[13px] border border-white/10 bg-white/[0.045] px-3 py-3 text-[13px] leading-[1.6] text-[rgba(245,247,251,0.76)]">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="품질 경고" eyebrow="Quality Gate">
                {warnings.length ? (
                  <div className="grid gap-2">
                    {warnings.slice(0, 6).map((warning) => (
                      <div key={warning} className="flex gap-2 rounded-[13px] border border-[#e59a9a]/30 bg-[#e59a9a]/10 px-3 py-3 text-[12px] leading-[1.55] text-[#ffd5d5]">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 rounded-[13px] border border-[#70e4b0]/25 bg-[#70e4b0]/10 px-3 py-3 text-[13px] text-[#c9f8e4]">
                    <CheckCircle2 className="h-4 w-4" />
                    발송을 막는 품질 경고가 없습니다.
                  </div>
                )}
              </Panel>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Panel title="BC PNP 영향" eyebrow={briefing.bcPnpImpact.signal}>
                <p className="text-[13px] leading-[1.75] text-[rgba(245,247,251,0.72)]">{briefing.bcPnpImpact.body}</p>
              </Panel>
              <Panel title="Express Entry 영향" eyebrow={briefing.expressEntryImpact.signal}>
                <p className="text-[13px] leading-[1.75] text-[rgba(245,247,251,0.72)]">{briefing.expressEntryImpact.body}</p>
              </Panel>
            </section>

            {briefing.evidence.length ? (
              <Panel title="공식 근거" eyebrow="Official Evidence">
                <div className="divide-y divide-white/10 overflow-hidden rounded-[16px] border border-white/10">
                  {briefing.evidence.map((item) => (
                    <a key={`${item.publisher}-${item.title}`} href={item.url} target="_blank" rel="noreferrer" className="grid gap-2 bg-[#0d1016]/75 px-4 py-3 hover:bg-white/[0.06] md:grid-cols-[1fr_auto]">
                      <div>
                        <p className="text-[13px] font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-[12px] leading-[1.55] text-[rgba(245,247,251,0.62)]">{item.note}</p>
                      </div>
                      <span className="inline-flex items-center gap-2 text-[11px] font-bold text-[#f5ecc7]">
                        {item.publisher} · {item.date}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                    </a>
                  ))}
                </div>
              </Panel>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/[0.06] px-3 text-[11px] font-bold text-[rgba(245,247,251,0.74)]">
      {children}
    </span>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[15px] border border-white/10 bg-[#0d1016]/70 px-3 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#d5bd6a]">{label}</p>
      <p className="mt-1 text-[12px] leading-[1.5] text-[rgba(245,247,251,0.72)]">{value}</p>
    </div>
  );
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-white/[0.055] p-5 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">{eyebrow}</p>
      <h2 className="mt-2 text-[22px] font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AdminAction({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.055] p-4">
      <div className="flex items-center gap-2 text-[#f5ecc7]">
        {icon}
        <p className="text-[13px] font-semibold text-white">{title}</p>
      </div>
      <p className="mt-2 break-words text-[12px] leading-[1.6] text-[rgba(245,247,251,0.66)]">{body}</p>
    </div>
  );
}
