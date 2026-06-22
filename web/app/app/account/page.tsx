import Link from "next/link";
import { AccountPanel } from "@/components/account-panel";
import { AppFrame, Surface, primaryActionClass, secondaryActionClass } from "@/components/redesign-shell";
import { navItems } from "@/lib/redesign-data";

export default function AccountPage() {
  return (
    <AppFrame
      title="계정"
      subtitle="로컬 계정으로 프로필, 알림 설정, 저장된 분석 상태를 사용자별로 분리할 준비를 합니다."
      status="로컬 계정"
      navItems={navItems.map((item) => ({ ...item, active: item.href === "/app/account" }))}
      action={
        <Link href="/app/assessment" className={primaryActionClass}>
          프로필 관리
        </Link>
      }
      secondaryAction={
        <Link href="/app/notifications" className={secondaryActionClass}>
          알림 설정
        </Link>
      }
    >
      <Surface eyebrow="계정" title="로그인 / 회원가입">
        <AccountPanel />
      </Surface>
    </AppFrame>
  );
}
