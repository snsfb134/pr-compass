"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppFrame, MetricCard, MiniTag, Surface, mutedTextClass, panelClass, primaryActionClass } from "@/components/redesign-shell";
import { navItems } from "@/lib/redesign-data";
import type { CompassProfileResponse } from "@/lib/compass-data";

type SimulatorWorkspaceProps = {
  profile: CompassProfileResponse;
};

const clbOptions = ["Below CLB 7", "CLB 7", "CLB 8", "CLB 9", "CLB 10+"];
const nclcOptions = ["None", "NCLC 5-6", "NCLC 7", "NCLC 8+", "NCLC 9+"];
const occupationOptions = ["Tech / Software", "Design / Product", "Healthcare", "Construction", "Education", "Other"];
const monthsOptions = ["0", "6", "12", "18", "24"];
const boolOptions = ["Yes", "No"];
const optionLabels: Record<string, string> = {
  "Below CLB 7": "CLB 7 미만",
  None: "없음",
  Yes: "있음",
  No: "없음",
  "Tech / Software": "기술/소프트웨어",
  "Design / Product": "디자인/프로덕트",
  Healthcare: "헬스케어",
  Construction: "건설/기능직",
  Education: "교육/보육",
  Other: "기타",
};

function scoreForClb(value: string) {
  return { "Below CLB 7": -12, "CLB 7": 0, "CLB 8": 8, "CLB 9": 15, "CLB 10+": 22 }[value] ?? 0;
}

function scoreForNclc(value: string) {
  return { None: 0, "NCLC 5-6": 6, "NCLC 7": 14, "NCLC 8+": 20, "NCLC 9+": 26 }[value] ?? 0;
}

function scoreForMonths(value: string) {
  return Number(value || 0) >= 12 ? 12 : Number(value || 0) >= 6 ? 6 : 0;
}

function scoreForBinary(value: string) {
  return value === "Yes" ? 10 : 0;
}

export function SimulatorWorkspace({ profile }: SimulatorWorkspaceProps) {
  const autoCrs = Number(profile.computed_scores?.crs?.score ?? 0);
  const [english, setEnglish] = useState(profile.profile?.language_score ? String(profile.profile.language_score) : "CLB 8");
  const [french, setFrench] = useState(profile.profile?.french_score ? String(profile.profile.french_score) : "None");
  const [experienceMonths, setExperienceMonths] = useState(String(profile.profile?.canadian_experience_years || "8"));
  const [occupation, setOccupation] = useState(String(profile.profile?.bc_occupation_focus || "Tech / Software"));
  const [jobOffer, setJobOffer] = useState(String(profile.profile?.bc_job_offer || "No"));
  const [employerSupport, setEmployerSupport] = useState(profile.profile?.employer_support ? "Yes" : "No");

  const result = useMemo(() => {
    const occupationScore = occupation === "Tech / Software" || occupation === "Healthcare" ? 14 : occupation === "Design / Product" ? 12 : occupation === "Construction" ? 10 : occupation === "Education" ? 9 : 6;
    const score =
      scoreForClb(english) +
      scoreForNclc(french) +
      scoreForMonths(experienceMonths) +
      occupationScore +
      scoreForBinary(jobOffer) +
      scoreForBinary(employerSupport);

    const route = score >= 55 && autoCrs >= 450 ? "BC PNP + Express Entry 병행" : score >= 40 ? "BC PNP 우선" : autoCrs >= 470 ? "Express Entry 관찰" : "신호 보강 필요";
    const nextAction =
      score >= 55
        ? "지금은 BC PNP와 Express Entry를 함께 보면서 공식 업데이트를 추적하는 것이 좋습니다."
        : score >= 40
          ? "BC PNP를 더 강하게 보기 전에 TEER, 고용주 지원, BC 연결성을 다시 점검하세요."
          : autoCrs >= 470
            ? "자동 CRS는 괜찮지만 BC PNP 신호는 약합니다. 직업군과 BC 연결을 보강하세요."
            : "언어 또는 경력 중 하나를 구조적으로 보강해야 경로가 선명해집니다.";
    const impact = score >= 55 ? "긍정" : score >= 40 ? "보통" : "주의";
    return { score, route, nextAction, impact, occupationScore };
  }, [autoCrs, english, experienceMonths, french, jobOffer, employerSupport, occupation]);

  return (
    <AppFrame
      title="시나리오 시뮬레이터"
      subtitle="프로필에서 계산된 CRS를 기준으로, BC PNP 쪽 레버를 바꿨을 때 어떤 경로가 가까워지는지 시험합니다."
      status="시나리오"
      navItems={navItems.map((item) => ({ ...item, active: item.href === "/app/simulator" }))}
      action={
        <Link href="/app/roadmap" className={primaryActionClass}>
          로드맵에 연결
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Surface eyebrow="시뮬레이션" title="프로필 레버를 바꾸면 무엇이 달라지나">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="영어 CLB" value={english} onChange={setEnglish} options={clbOptions} />
            <Field label="프랑스어 NCLC" value={french} onChange={setFrench} options={nclcOptions} />
            <Field label="캐나다 경력" value={experienceMonths} onChange={setExperienceMonths} options={monthsOptions} suffix="개월" />
            <Field label="직업군" value={occupation} onChange={setOccupation} options={occupationOptions} />
            <Field label="BC 잡오퍼" value={jobOffer} onChange={setJobOffer} options={boolOptions} />
            <Field label="고용주 지원" value={employerSupport} onChange={setEmployerSupport} options={boolOptions} />
          </div>
        </Surface>

        <div className="grid gap-4 content-start">
          <Surface eyebrow="결과" title="시나리오 판독">
            <div className="space-y-3">
              <MetricCard label="자동 CRS" value={autoCrs ? `${autoCrs}점` : "잠금"} detail="프로필에서 계산된 값이며 직접 입력하지 않습니다." accent="gold" />
              <MetricCard label="BC PNP 레버" value={`${result.score}`} detail="직업군, 언어, 경력, 잡오퍼, 고용주 지원을 바꿔보는 시뮬레이션입니다." accent="teal" />
              <MetricCard label="가장 유력한 경로" value={result.route} detail={result.nextAction} accent={result.impact === "긍정" ? "teal" : result.impact === "보통" ? "gold" : "rose"} />
              <div className={panelClass}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-[rgba(245,247,251,0.72)]">경로 가까움</span>
                  <span className="text-[12px] font-bold text-[#f5ecc7]">{Math.min(100, result.score + Math.min(28, Math.max(12, Math.round(autoCrs / 20))))}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#b69a45]" style={{ width: `${Math.min(100, result.score + Math.min(28, Math.max(12, Math.round(autoCrs / 20))))}%` }} />
                </div>
              </div>
            </div>
          </Surface>

          <Surface eyebrow="다음 액션" title="무엇을 확인해야 하나">
            <p className={`text-[13px] leading-[1.7] ${mutedTextClass}`}>{result.nextAction}</p>
            <div className="mt-3 rounded-[14px] border border-white/10 bg-white/[0.055] p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">프로필 스냅샷</p>
              <p className="mt-2 text-[13px] text-[#f5f7fb]">{profile.strongest_route || "프로필 미연결"}</p>
              <p className="mt-1 text-[12px] text-[rgba(245,247,251,0.62)]">자동 CRS는 프로필값을 그대로 읽고, 아래 레버는 BC PNP 쪽 적합도만 흔듭니다.</p>
            </div>
          </Surface>
        </div>
      </div>
    </AppFrame>
  );
}

function Field({
  label,
  value,
  onChange,
  options,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  suffix?: string;
}) {
  return (
    <div className={panelClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-[#d5bd6a]">{label}</p>
          <p className={`mt-1 text-[11px] leading-[1.45] ${mutedTextClass}`}>구조화된 시나리오 입력</p>
        </div>
        <MiniTag tone="slate">선택</MiniTag>
      </div>
      <select className="mt-3 h-10 w-full rounded-[12px] border border-white/10 bg-[#0d1016] px-3 text-[13px] font-semibold text-[#f5f7fb] outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels[option] || option}
          </option>
        ))}
      </select>
      {suffix ? <p className="mt-2 text-[11px] text-[rgba(245,247,251,0.48)]">{suffix}</p> : null}
    </div>
  );
}
