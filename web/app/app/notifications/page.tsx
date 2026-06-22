import { AppFrame, Surface, primaryActionClass, secondaryActionClass } from "@/components/redesign-shell";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import { ProfileLockedView } from "@/components/profile-locked-view";
import { loadProfileWorkspace } from "@/lib/compass-data";
import { getSessionUser } from "@/lib/local-account-store";
import { navItems } from "@/lib/redesign-data";
import Link from "next/link";
import { cookies } from "next/headers";

export default async function NotificationsPage() {
  const sessionToken = (await cookies()).get("pc_session")?.value;
  const user = await getSessionUser(sessionToken);
  const profile = await loadProfileWorkspace(user?.id);
  if (!user || !profile.profile_complete) {
    return (
      <ProfileLockedView
        activeHref="/app/notifications"
        title="알림 설정"
        subtitle="개인 영향 알림은 프로필 완료 후 관심 경로와 직업군 기준으로 설정합니다."
        mode={!user ? "guest" : "profile"}
      />
    );
  }

  return (
    <AppFrame
      title="알림 설정"
      subtitle="공식 업데이트가 들어왔을 때 어떤 주제와 중요도를 먼저 볼지 저장합니다. 실제 이메일/푸시 발송은 다음 단계에서 연결합니다."
      status="설정 저장"
      navItems={navItems.map((item) => ({ ...item, active: item.href === "/app/notifications" }))}
      action={
        <Link href="/app/signals" className={primaryActionClass}>
          신호 보기
        </Link>
      }
      secondaryAction={
        <Link href="/app" className={secondaryActionClass}>
          대시보드
        </Link>
      }
    >
      <Surface eyebrow="알림" title="공식 소식과 개인 영향 알림 기준">
        <NotificationSettingsPanel />
      </Surface>
    </AppFrame>
  );
}
