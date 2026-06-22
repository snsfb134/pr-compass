import Link from "next/link";
import { AppFrame, MetricCard, MiniTag, Surface, headingClass, itemClass, mutedTextClass, panelClass, primaryActionClass } from "@/components/redesign-shell";
import { ProfileLockedView } from "@/components/profile-locked-view";
import { loadRouteWorkspace } from "@/lib/compass-data";
import { formatVancouverCheckedLabel } from "@/lib/date-format";
import { getSessionUser } from "@/lib/local-account-store";
import { navItems } from "@/lib/redesign-data";
import { cookies } from "next/headers";

function sanitizeRouteLabel(label: string | undefined | null) {
  const value = String(label || "관찰");
  return value
    .replaceAll("가능성", "정합")
    .replaceAll("가능", "조건 정합")
    .replaceAll("합격", "보강 필요")
    .trim();
}

export default async function PathwaysPage() {
  const sessionToken = (await cookies()).get("pc_session")?.value;
  const user = await getSessionUser(sessionToken);
  const data = await loadRouteWorkspace(user?.id);
  const profile = data.profile;
  const routeCheckLabel = formatVancouverCheckedLabel(data.summary?.latest_snapshot || profile.updated_at);
  if (!user || !profile.profile_complete) {
    return (
      <ProfileLockedView
        activeHref="/app/pathways"
        title="경로 비교"
        subtitle="Express Entry와 BC PNP 비교는 프로필 완료 후 개인 기준으로 열립니다."
        mode={!user ? "guest" : "profile"}
      />
    );
  }
  const routeProfiles = profile.route_profiles || {};

  const pathways = [
    {
      name: "BC PNP",
      status: sanitizeRouteLabel(routeProfiles.bc_pnp?.fit_label || "관찰"),
      summary: routeProfiles.bc_pnp?.summary || "BC 연결, 직무, 고용주 신호를 먼저 봅니다.",
      fit: routeProfiles.bc_pnp?.score || 0,
      metricLabel: `정합도 ${routeProfiles.bc_pnp?.score || 0}`,
      evidence: routeProfiles.bc_pnp?.signals?.slice(0, 3).join(" · ") || "공식 신호 대기",
      gap: (routeProfiles.bc_pnp?.missing_requirements || []).slice(0, 2).map((item: any) => item.title).join(" · ") || "공백 없음",
    },
    {
      name: "Express Entry",
      status: sanitizeRouteLabel(routeProfiles.express_entry?.fit_label || "관찰"),
      summary: routeProfiles.express_entry?.summary || "CRS, 언어, 카테고리, 최신 컷오프 거리를 함께 봅니다.",
      fit: routeProfiles.express_entry?.score || 0,
      metricLabel:
        routeProfiles.express_entry?.latest_cutoff && typeof routeProfiles.express_entry?.cutoff_gap === "number"
          ? `CRS ${routeProfiles.express_entry?.crs_score || 0} · 컷오프 ${routeProfiles.express_entry.latest_cutoff} · ${routeProfiles.express_entry.cutoff_gap >= 0 ? "+" : ""}${routeProfiles.express_entry.cutoff_gap}`
          : `CRS ${routeProfiles.express_entry?.crs_score || 0}`,
      evidence: routeProfiles.express_entry?.signals?.slice(0, 4).join(" · ") || "공식 신호 대기",
      gap:
        (routeProfiles.express_entry?.missing_requirements || []).slice(0, 2).map((item: any) => item.title).join(" · ") ||
        routeProfiles.express_entry?.readiness_label ||
        "카테고리/컷오프 확인",
    },
    {
      name: "프랑스어 중심 경로",
      status: sanitizeRouteLabel(profile.profile?.french_score ? "업사이드" : "관찰"),
      summary: "프랑스어 업사이드는 별도 경로를 여는 레버입니다.",
      fit: profile.profile?.french_score ? 74 : 50,
      metricLabel: profile.profile?.french_score ? "업사이드" : "대기",
      evidence: profile.profile?.french_score || "프랑스어 버킷 대기",
      gap: profile.profile?.french_score ? "시나리오 연결 가능" : "NCLC 값을 먼저 입력",
    },
    {
      name: "CEC 하이브리드",
      status: sanitizeRouteLabel(profile.profile?.canadian_experience_years ? "미래" : "관찰"),
      summary: "캐나다 경력이 더 쌓이면 의미가 커집니다.",
      fit: profile.profile?.canadian_experience_years ? 62 : 48,
      metricLabel: profile.profile?.canadian_experience_years ? "12개월 레버" : "경력 대기",
      evidence: profile.profile?.canadian_experience_years || "캐나다 경력 대기",
      gap: profile.profile?.canadian_experience_years ? "시점만 점검" : "12개월 마일스톤 필요",
    },
  ];

  return (
    <AppFrame
      title="경로 비교"
      subtitle={`캐나다 PR 경로를 한 페이지에서 작고 선명하게 비교합니다. 기준 시각 ${routeCheckLabel}`}
      status="집중 보기"
      navItems={navItems.map((item) => ({ ...item, active: item.href === "/app/pathways" }))}
      action={
        <Link href="/app/signals" className={primaryActionClass}>
          신호와 연결
        </Link>
      }
    >
      <div className="grid gap-4">
        <Surface eyebrow="비교" title="네 가지 주요 경로">
          <div className="grid gap-3 xl:grid-cols-2">
            {pathways.map((pathway) => (
              <article key={pathway.name} className={panelClass}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">{pathway.status}</p>
                    <h3 className={`mt-1 text-[24px] ${headingClass}`}>{pathway.name}</h3>
                  </div>
                  <MiniTag tone={String(pathway.status).includes("업사이드") ? "gold" : String(pathway.status).includes("경쟁") || String(pathway.status).includes("상회") ? "teal" : "slate"}>{pathway.metricLabel}</MiniTag>
                </div>
                <p className={`mt-3 text-[13px] leading-[1.65] ${mutedTextClass}`}>{pathway.summary}</p>
                <p className="mt-2 text-[12px] font-semibold text-[rgba(245,247,251,0.62)]">기준 시각 {routeCheckLabel}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#b69a45]" style={{ width: `${Math.max(4, Math.min(100, pathway.fit))}%` }} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <MetricCard label="근거" value="왜 강한가" detail={pathway.evidence} accent="teal" />
                  <MetricCard label="간극" value="아직 필요한 것" detail={pathway.gap} accent="rose" />
                </div>
              </article>
            ))}
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <Surface eyebrow="판단 기준" title="앱이 경로를 고르는 방식">
            <div className="grid gap-3">
              {[
                ["BC PNP", "고용주, 직무, 주정부 연결이 모두 있을 때 조건 정합도가 올라갑니다."],
                ["Express Entry", "언어와 CRS가 최신 컷오프에 가까워질 때 경쟁력이 다시 살아납니다."],
                ["프랑스어", "큰 CRS 점프 없이도 두 번째 실행 경로를 열어줍니다."],
                ["CEC 하이브리드", "시간과 캐나다 경력이 핵심일 때 유리합니다."],
              ].map(([title, body]) => (
                <div key={title} className={itemClass}>
                  <h3 className={`text-[18px] ${headingClass}`}>{title}</h3>
                  <p className={`mt-2 text-[13px] leading-[1.6] ${mutedTextClass}`}>{body}</p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface eyebrow="다음 비교" title="다음에 함께 볼 것">
            <div className="space-y-3">
              {[
                "프랑스어가 CLB7에 도달하면 경로 순위를 다시 계산합니다.",
                "캐나다 경력이 12개월이 되면 CEC를 추가합니다.",
                "고용주 증빙이 부족하면 BC PNP를 최우선 관찰 경로로 둡니다.",
              ].map((item) => (
                <div key={item} className={`${itemClass} text-[13px] leading-[1.65] ${mutedTextClass}`}>
                  {item}
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>
    </AppFrame>
  );
}
