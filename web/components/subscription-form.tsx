"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { affiliationOptions } from "@/lib/subscription-options";

type FieldErrors = {
  name?: string;
  email?: string;
  affiliation?: string;
};

export function SubscriptionForm({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  const [briefingUrl, setBriefingUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setFieldErrors({});

    const response = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, affiliation }),
    });
    const payload = await response.json();

    if (response.ok) {
      setNotice(payload.message || "브리핑 구독이 등록되었습니다.");
      setBriefingUrl(payload.briefingUrl || "");
    } else {
      setNotice(payload.message || "구독 정보를 다시 확인해 주세요.");
      setFieldErrors(payload.fieldErrors || {});
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className={`rounded-[22px] border border-white/10 bg-white/[0.065] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.06)] ${compact ? "" : "md:p-5"}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-[#b69a45]/35 bg-[#b69a45]/14 text-[#f5ecc7]">
          <Mail className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-[#f5f7fb]">무료 브리핑 구독</p>
          <p className="text-[12px] text-[rgba(245,247,251,0.62)]">새 공식 업데이트가 감지되면 AI 요약을 메일로 보냅니다.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <Field label="이름" value={name} onChange={setName} placeholder="홍길동" error={fieldErrors.name} />
        <Field label="이메일" value={email} onChange={setEmail} placeholder="you@example.com" error={fieldErrors.email} type="email" />
        <label className="grid gap-1.5">
          <span className="text-[12px] font-semibold text-[rgba(245,247,251,0.76)]">소속</span>
          <select
            value={affiliation}
            onChange={(event) => setAffiliation(event.target.value)}
            className="h-11 rounded-[12px] border border-white/10 bg-[#0d1016] px-3 text-[13px] font-semibold text-[#f5f7fb] outline-none transition focus:border-[#b69a45]/60"
          >
            <option value="">선택해 주세요</option>
            {affiliationOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {fieldErrors.affiliation ? <span className="text-[11px] font-semibold text-[#ffb4b4]">{fieldErrors.affiliation}</span> : null}
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#b69a45] bg-[#b69a45] px-4 text-[13px] font-bold text-[#101820] shadow-[0_14px_28px_rgba(182,154,69,0.18)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {saving ? "등록 중" : "무료 브리핑 구독"}
        <ArrowRight className="h-4 w-4" />
      </button>

      {notice ? (
        <div className={`mt-3 rounded-[14px] border px-3 py-3 text-[12px] leading-[1.55] ${briefingUrl ? "border-[#70e4b0]/30 bg-[#70e4b0]/10 text-[#c9f8e4]" : "border-[#e59a9a]/35 bg-[#e59a9a]/10 text-[#ffd5d5]"}`}>
          <div className="flex items-start gap-2">
            {briefingUrl ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            <div>
              <p className="font-semibold">{notice}</p>
              {briefingUrl ? (
                <a href={briefingUrl} className="mt-1 inline-flex font-bold text-[#f5ecc7] underline underline-offset-4">
                  구독자 브리핑 열기
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-[rgba(245,247,251,0.76)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        className="h-11 rounded-[12px] border border-white/10 bg-[#0d1016] px-3 text-[13px] font-semibold text-[#f5f7fb] outline-none transition placeholder:text-[rgba(245,247,251,0.34)] focus:border-[#b69a45]/60"
      />
      {error ? <span className="text-[11px] font-semibold text-[#ffb4b4]">{error}</span> : null}
    </label>
  );
}
