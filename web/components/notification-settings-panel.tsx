"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bell, Save } from "lucide-react";
import { MiniTag, mutedTextClass, panelClass, primaryActionClass } from "@/components/redesign-shell";

const categoryOptions = ["BC PNP", "Express Entry", "처리기간", "정책 변경", "직업군"];
const importanceOptions = [
  { label: "높음만", value: "high" },
  { label: "중간 이상", value: "medium" },
  { label: "전체", value: "all" },
];
const frequencyOptions = [
  { label: "즉시", value: "instant" },
  { label: "일간 요약", value: "daily" },
  { label: "주간 요약", value: "weekly" },
];

type Settings = {
  categories: string[];
  minimumImportance: "high" | "medium" | "all";
  profileImpact: boolean;
  frequency: "instant" | "daily" | "weekly";
  updatedAt?: string;
};

const fallback: Settings = {
  categories: ["BC PNP", "Express Entry", "처리기간", "정책 변경"],
  minimumImportance: "medium",
  profileImpact: true,
  frequency: "daily",
};

export function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<Settings>(fallback);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("실제 이메일/푸시 발송은 아직 비활성 상태입니다.");

  useEffect(() => {
    fetch("/api/notification-settings")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.settings) setSettings(payload.settings);
      })
      .catch(() => setNotice("설정을 불러오지 못해 기본값으로 표시합니다."));
  }, []);

  async function save() {
    setSaving(true);
    const response = await fetch("/api/notification-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const payload = await response.json();
    if (response.ok && payload.settings) {
      setSettings(payload.settings);
      setNotice("알림 설정이 저장되었습니다. 발송 채널은 다음 단계에서 연결합니다.");
    } else {
      setNotice(payload.message || "저장에 실패했습니다.");
    }
    setSaving(false);
  }

  function toggleCategory(category: string) {
    const exists = settings.categories.includes(category);
    setSettings({
      ...settings,
      categories: exists ? settings.categories.filter((item) => item !== category) : [...settings.categories, category],
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">알림 조건</p>
            <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#f5f7fb]">공식 업데이트를 어떤 기준으로 볼지 정합니다</h2>
          </div>
          <MiniTag tone="gold">발송 준비 전</MiniTag>
        </div>

        <div className="mt-5 grid gap-4">
          <ControlGroup title="관심 카테고리" description="정부 업데이트가 들어왔을 때 먼저 분류할 주제입니다.">
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`rounded-full border px-3 py-2 text-[12px] font-semibold transition ${
                    settings.categories.includes(category) ? "border-[#b69a45] bg-[#b69a45] text-[#101820]" : "border-white/10 bg-white/[0.055] text-[rgba(245,247,251,0.72)]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup title="중요도 기준" description="오늘의 브리핑과 알림 큐에 올릴 최소 영향도입니다.">
            <Segmented value={settings.minimumImportance} options={importanceOptions} onChange={(value) => setSettings({ ...settings, minimumImportance: value as Settings["minimumImportance"] })} />
          </ControlGroup>

          <ControlGroup title="프로필 영향 알림" description="프로필이 있으면 내 CRS/직업군/경로에 미치는 영향까지 분리해서 봅니다.">
            <Segmented
              value={settings.profileImpact ? "on" : "off"}
              options={[
                { label: "켬", value: "on" },
                { label: "끔", value: "off" },
              ]}
              onChange={(value) => setSettings({ ...settings, profileImpact: value === "on" })}
            />
          </ControlGroup>

          <ControlGroup title="빈도" description="실제 발송 채널이 연결되면 이 주기를 기준으로 동작합니다.">
            <Segmented value={settings.frequency} options={frequencyOptions} onChange={(value) => setSettings({ ...settings, frequency: value as Settings["frequency"] })} />
          </ControlGroup>
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <section className={panelClass}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-[#b69a45]/35 bg-[#b69a45]/14 text-[#f5ecc7]">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[#f5f7fb]">저장된 설정</p>
              <p className={`text-[12px] ${mutedTextClass}`}>{settings.updatedAt ? `마지막 저장 ${settings.updatedAt}` : "아직 저장 전"}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-[13px] text-[rgba(245,247,251,0.72)]">
            <p>카테고리: {settings.categories.join(" · ") || "선택 없음"}</p>
            <p>프로필 영향: {settings.profileImpact ? "켬" : "끔"}</p>
            <p>빈도: {frequencyOptions.find((item) => item.value === settings.frequency)?.label}</p>
          </div>
          <button type="button" className={`mt-4 ${primaryActionClass}`} onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "저장 중" : "설정 저장"}
          </button>
        </section>
        <div className="rounded-[16px] border border-[#b69a45]/30 bg-[#b69a45]/10 px-4 py-3 text-[13px] leading-[1.65] text-[#f5ecc7]">{notice}</div>
      </aside>
    </div>
  );
}

function ControlGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
      <p className="text-[13px] font-semibold text-[#f5f7fb]">{title}</p>
      <p className={`mt-1 text-[12px] leading-[1.55] ${mutedTextClass}`}>{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: Array<{ label: string; value: string }>; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-10 rounded-[12px] border px-3 text-[12px] font-semibold transition ${
            value === option.value ? "border-[#b69a45] bg-[#b69a45] text-[#101820]" : "border-white/10 bg-[#0d1016] text-[rgba(245,247,251,0.72)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
