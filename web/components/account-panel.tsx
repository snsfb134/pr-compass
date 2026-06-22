"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import { MiniTag, mutedTextClass, panelClass, primaryActionClass, secondaryActionClass } from "@/components/redesign-shell";
import { validateLoginInput, validateSignupInput, type AuthFieldErrors } from "@/lib/auth-validation";

type User = { id: string; username: string; email: string; createdAt: string };

export function AccountPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("로그인하면 프로필, 알림 설정, 저장된 분석 상태를 사용자별로 분리할 준비가 됩니다.");
  const [noticeTone, setNoticeTone] = useState<"neutral" | "error">("neutral");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFieldErrors({});
    setPassword("");
  }, [mode]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload) => setUser(payload.user || null))
      .catch(() => setUser(null));
  }, []);

  async function submit() {
    const validation = mode === "signup" ? validateSignupInput(username, email, password) : validateLoginInput(identifier, password);
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setNotice(validation.message);
      setNoticeTone("error");
      return;
    }
    setFieldErrors({});
    setNoticeTone("neutral");
    setSaving(true);
    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const body = mode === "signup" ? { username, email, password } : { identifier, password };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        setUser(payload.user);
        setNotice(mode === "signup" ? "회원가입이 완료되었습니다." : "로그인되었습니다.");
        setNoticeTone("neutral");
        setFieldErrors({});
      } else {
        setNotice(payload?.message || "처리에 실패했습니다.");
        setNoticeTone("error");
        setFieldErrors(payload?.fieldErrors || {});
      }
    } catch {
      setNotice("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      setNoticeTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setPassword("");
    setNotice("로그아웃되었습니다.");
    setNoticeTone("neutral");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">로컬 계정</p>
            <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#f5f7fb]">아이디, 이메일, 비밀번호만 사용합니다</h2>
          </div>
          <MiniTag tone={user ? "teal" : "gold"}>{user ? "로그인됨" : "인증 대기"}</MiniTag>
        </div>

        {user ? (
          <div className="mt-5 grid gap-3">
            <div className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
              <p className="text-[13px] font-semibold text-[#f5f7fb]">{user.username}</p>
              <p className={`mt-1 text-[12px] ${mutedTextClass}`}>{user.email}</p>
              <p className={`mt-3 text-[12px] ${mutedTextClass}`}>생성일: {user.createdAt}</p>
            </div>
            <button type="button" className={secondaryActionClass} onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <div className="flex gap-2">
              <button type="button" className={mode === "login" ? primaryActionClass : secondaryActionClass} onClick={() => setMode("login")}>
                로그인
              </button>
              <button type="button" className={mode === "signup" ? primaryActionClass : secondaryActionClass} onClick={() => setMode("signup")}>
                회원가입
              </button>
            </div>

            {mode === "signup" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="아이디" value={username} onChange={setUsername} error={fieldErrors.username} />
                <Field label="이메일" value={email} onChange={setEmail} type="email" error={fieldErrors.email} />
                <Field label="비밀번호" value={password} onChange={setPassword} type="password" className="md:col-span-2" error={fieldErrors.password} />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="아이디 또는 이메일" value={identifier} onChange={setIdentifier} error={fieldErrors.identifier} />
                <Field label="비밀번호" value={password} onChange={setPassword} type="password" error={fieldErrors.password} />
              </div>
            )}

            <button type="button" className={primaryActionClass} onClick={submit} disabled={saving}>
              {mode === "signup" ? <UserPlus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
              {saving ? "처리 중" : mode === "signup" ? "회원가입" : "로그인"}
            </button>
          </div>
        )}
      </section>

      <aside className="grid content-start gap-4">
        <section className={panelClass}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">연결 범위</p>
          <h3 className="mt-1 text-[20px] font-semibold text-[#f5f7fb]">이번 단계의 계정 역할</h3>
          <div className="mt-4 grid gap-2">
            {["프로필 저장 주체 분리", "알림 설정 사용자별 저장", "저장된 분석 상태 확장 준비"].map((item) => (
              <div key={item} className="rounded-[14px] border border-white/10 bg-white/[0.045] px-3 py-3 text-[13px] text-[rgba(245,247,251,0.72)]">
                {item}
              </div>
            ))}
          </div>
        </section>
        <div className={`rounded-[16px] border px-4 py-3 text-[13px] leading-[1.65] ${noticeTone === "error" ? "border-[#f2a36b]/30 bg-[#f2a36b]/10 text-[#ffd3ac]" : "border-[#b69a45]/30 bg-[#b69a45]/10 text-[#f5ecc7]"}`}>
          {notice}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", className = "", error }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string; error?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[12px] font-semibold text-[#d5bd6a]">{label}</span>
      <input
        className={`mt-2 h-11 w-full rounded-[12px] border bg-[#0d1016] px-3 text-[13px] font-semibold text-[#f5f7fb] outline-none transition focus:border-[#b69a45]/60 ${error ? "border-[#f2a36b]/45" : "border-white/10"}`}
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="mt-1.5 text-[11px] leading-[1.4] text-[#ffd3ac]">{error}</p> : null}
    </label>
  );
}
