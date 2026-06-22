import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type AppFrameProps = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  status?: string;
  navItems: NavItem[];
  children: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
};

export const primaryActionClass =
  "inline-flex h-11 items-center rounded-full border border-[#b69a45] bg-[#b69a45] px-5 text-[13px] font-bold text-[#101820] shadow-[0_8px_18px_rgba(182,154,69,0.16)] transition hover:translate-y-[-1px]";

export const secondaryActionClass =
  "inline-flex h-11 items-center rounded-full border border-white/12 bg-white/[0.06] px-5 text-[13px] font-semibold text-[rgba(245,247,251,0.72)] transition hover:border-[#b69a45]/45 hover:text-[#f5ecc7]";

export const panelClass =
  "rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.06)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]";

export const itemClass =
  "rounded-[16px] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.04)]";

export const compactItemClass =
  "rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3";

export const headingClass = "font-sans font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance";
export const mutedTextClass = "text-[rgba(245,247,251,0.66)]";

export function AppFrame({ title, subtitle, eyebrow = "PR Compass", status, navItems, children, action, secondaryAction }: AppFrameProps) {
  return (
    <main className="pc-app-scope min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_52%_-18%,rgba(182,154,69,0.22),transparent_34%),linear-gradient(180deg,#08090d_0%,#11141a_100%)] text-[#f5f7fb]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-3 pb-4 pt-3 md:px-4">
        <header className="sticky top-3 z-30 rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.06)] px-4 py-3 shadow-[inset_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/brand-logo.png" alt="" className="h-11 w-11 shrink-0 rounded-[14px] border border-white/15 object-cover shadow-[0_0_28px_rgba(182,154,69,0.22)]" />
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.26em] text-[#d5bd6a]">{eyebrow}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="break-words font-sans text-[26px] leading-none font-semibold tracking-[-0.03em] text-[#f5f7fb] text-balance md:text-[32px]">{title}</h1>
                  {status ? <span className="inline-flex h-7 items-center rounded-full border border-[#b69a45]/40 bg-[#b69a45]/14 px-3 text-[11px] font-bold text-[#f5ecc7]">{status}</span> : null}
                </div>
                <p className="mt-2 max-w-3xl text-[13px] leading-[1.55] text-[rgba(245,247,251,0.66)] text-pretty">{subtitle}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[rgba(213,189,106,0.66)]">Your True North for Canadian PR decisions</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {secondaryAction}
              {action}
            </div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto border-t border-white/10 pt-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-9 items-center whitespace-nowrap rounded-full border px-4 text-[12px] font-semibold transition ${
                  item.active
                    ? "border-[#b69a45] bg-[#b69a45] text-[#101820] shadow-[0_8px_18px_rgba(182,154,69,0.14)]"
                    : "border-white/10 bg-white/[0.045] text-[rgba(245,247,251,0.66)] hover:border-[#b69a45]/50 hover:text-[#f5ecc7]"
                }`}
                aria-current={item.active ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="mt-4 grid flex-1 gap-4">
          <section className="min-h-0 min-w-0">{children}</section>
        </div>
      </div>
    </main>
  );
}

export function Surface({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#d5bd6a]">{eyebrow}</p>
          <h2 className="mt-1 break-words font-sans text-[22px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">{title}</h2>
        </div>
        <div className="shrink-0">{actions}</div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent = "default",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "default" | "gold" | "teal" | "rose";
}) {
  const accentClass =
    accent === "gold"
      ? "bg-[linear-gradient(180deg,rgba(182,154,69,0.18),rgba(255,255,255,0.055))]"
      : accent === "teal"
        ? "bg-[linear-gradient(180deg,rgba(15,118,110,0.2),rgba(255,255,255,0.055))]"
        : accent === "rose"
          ? "bg-[linear-gradient(180deg,rgba(180,35,59,0.2),rgba(255,255,255,0.055))]"
          : "bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))]";

  return (
    <div className={`min-w-0 rounded-[16px] border border-white/10 p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)] ${accentClass}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">{label}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <strong className="break-words font-sans text-[30px] font-semibold tracking-[-0.04em] text-[#f5f7fb] text-balance">{value}</strong>
        <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-[#b69a45]/35 bg-[#b69a45]/12 px-3 text-[10px] font-extrabold tracking-[0.18em] text-[#f5ecc7]">
          {accent === "rose" ? "RISK" : accent === "teal" ? "FIT" : accent === "gold" ? "CORE" : "LIVE"}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-[1.55] text-[rgba(245,247,251,0.66)] text-pretty">{detail}</p>
    </div>
  );
}

export function InsightCard({
  title,
  meta,
  body,
  chip,
  tone = "default",
}: {
  title: string;
  meta: string;
  body: string;
  chip: string;
  tone?: "default" | "gold" | "teal" | "rose";
}) {
  const chipClass =
    tone === "gold"
      ? "border-[#b69a45]/45 bg-[#b69a45]/14 text-[#f5ecc7]"
      : tone === "teal"
        ? "border-[#70e4b0]/35 bg-[#70e4b0]/12 text-[#c9f8e4]"
        : tone === "rose"
          ? "border-[#e59a9a]/40 bg-[#e59a9a]/12 text-[#ffd5d5]"
          : "border-white/12 bg-white/[0.06] text-[rgba(245,247,251,0.72)]";

  return (
    <article className="min-w-0 rounded-[16px] border border-white/10 bg-[rgba(255,255,255,0.065)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#d5bd6a]">{meta}</p>
          <h3 className="mt-1 break-words font-sans text-[20px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">{title}</h3>
        </div>
        <span className={`inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-[11px] font-bold ${chipClass}`}>{chip}</span>
      </div>
      <p className="mt-4 text-[13px] leading-[1.65] text-[rgba(245,247,251,0.66)] text-pretty">{body}</p>
    </article>
  );
}

export function SplitGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">{children}</div>;
}

export function ProgressList({
  items,
}: {
  items: Array<{ label: string; status: "done" | "doing" | "todo" }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.055] px-3 py-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              item.status === "done" ? "bg-[#0f766e]" : item.status === "doing" ? "bg-[#c7ac65]" : "bg-[#d4c9b6]"
            }`}
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#f5f7fb]">{item.label}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[rgba(245,247,251,0.48)]">
              {item.status === "done" ? "완료" : item.status === "doing" ? "진행 중" : "대기"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TimelineItem({
  title,
  body,
  index,
}: {
  title: string;
  body: string;
  index: number;
}) {
  return (
    <div className="flex gap-4 rounded-[16px] border border-white/10 bg-white/[0.055] p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#b69a45]/45 bg-[#b69a45]/14 font-sans text-[14px] font-semibold text-[#f5ecc7]">
        {String(index).padStart(2, "0")}
      </div>
      <div>
        <h3 className="break-words font-sans text-[18px] font-semibold tracking-[-0.02em] text-[#f5f7fb] text-balance">{title}</h3>
        <p className="mt-1 text-[13px] leading-[1.6] text-[rgba(245,247,251,0.66)] text-pretty">{body}</p>
      </div>
    </div>
  );
}

export function MiniTag({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "gold" | "teal" | "rose" | "slate";
}) {
  const classes =
    tone === "gold"
      ? "border-[#b69a45]/45 bg-[#b69a45]/14 text-[#f5ecc7]"
      : tone === "teal"
        ? "border-[#70e4b0]/35 bg-[#70e4b0]/12 text-[#c9f8e4]"
        : tone === "rose"
          ? "border-[#e59a9a]/40 bg-[#e59a9a]/12 text-[#ffd5d5]"
          : tone === "slate"
            ? "border-white/12 bg-white/[0.06] text-[rgba(245,247,251,0.72)]"
            : "border-white/12 bg-white/[0.06] text-[rgba(245,247,251,0.72)]";
  return <span className={`inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-[11px] font-semibold ${classes}`}>{children}</span>;
}
