import { DashboardCommandCenter } from "@/components/dashboard-command-center";
import { loadCompassWorkspace, type DashboardState } from "@/lib/compass-data";
import { getSessionUser } from "@/lib/local-account-store";
import { cookies } from "next/headers";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AppDashboardPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) || {};
  const state = (typeof params.state === "string" ? params.state : "returning") as DashboardState;
  const sessionToken = (await cookies()).get("pc_session")?.value;
  const user = await getSessionUser(sessionToken);
  const data = await loadCompassWorkspace(user?.id);

  return <DashboardCommandCenter state={state === "empty" || state === "started" ? state : "returning"} data={data} authUser={user ? { username: user.username, email: user.email } : null} />;
}
