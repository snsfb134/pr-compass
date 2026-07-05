import Link from "next/link";
import { BriefingPage } from "@/components/briefing-page";
import { getBriefingByToken } from "@/lib/briefing-data";

type Params = Promise<{ token: string }>;

export default async function SubscriberBriefingPage({ params }: { params: Params }) {
  const { token } = await params;
  const briefing = await getBriefingByToken(token);

  if (!briefing) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_-12%,rgba(182,154,69,0.22),transparent_34%),linear-gradient(180deg,#08090d_0%,#11141a_100%)] px-4 text-[#f5f7fb]">
        <section className="w-full max-w-[520px] rounded-[24px] border border-white/10 bg-white/[0.06] p-6 text-center shadow-[inset_0_1px_rgba(255,255,255,0.06)]">
          <img src="/brand-logo.png" alt="" className="mx-auto h-14 w-14 rounded-[18px] border border-white/15 object-cover shadow-[0_0_28px_rgba(182,154,69,0.22)]" />
          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">Briefing Link</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white">구독 링크를 확인할 수 없습니다</h1>
          <p className="mt-3 text-[14px] leading-[1.7] text-[rgba(245,247,251,0.66)]">
            링크가 만료됐거나 구독 정보가 비활성 상태일 수 있습니다. 다시 구독하면 새 브리핑 링크를 받을 수 있습니다.
          </p>
          <Link href="/#subscribe" className="mt-5 inline-flex h-11 items-center rounded-full border border-[#b69a45] bg-[#b69a45] px-5 text-[13px] font-bold text-[#101820]">
            구독 페이지로 이동
          </Link>
        </section>
      </main>
    );
  }

  return <BriefingPage briefing={briefing} />;
}
