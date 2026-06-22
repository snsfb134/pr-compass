import { SimulatorWorkspace } from "@/components/simulator-workspace";
import { ProfileLockedView } from "@/components/profile-locked-view";
import { loadProfileWorkspace } from "@/lib/compass-data";
import { getSessionUser } from "@/lib/local-account-store";
import { cookies } from "next/headers";

export default async function SimulatorPage() {
  const sessionToken = (await cookies()).get("pc_session")?.value;
  const user = await getSessionUser(sessionToken);
  const profile = await loadProfileWorkspace(user?.id);
  if (!user || !profile.profile_complete) {
    return (
      <ProfileLockedView
        activeHref="/app/simulator"
        title="시나리오 시뮬레이터"
        subtitle="시뮬레이션은 자동 CRS와 BC PNP 기준값이 있어야 의미 있게 계산됩니다."
        mode={!user ? "guest" : "profile"}
      />
    );
  }
  return <SimulatorWorkspace profile={profile} />;
}
