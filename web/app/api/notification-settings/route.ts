import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getNotificationSettings, getSessionUser, saveNotificationSettings } from "@/lib/local-account-store";

async function currentUserId() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get("pc_session")?.value);
  return user?.id || "public";
}

export async function GET() {
  const settings = await getNotificationSettings(await currentUserId());
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const settings = await saveNotificationSettings(
    {
      categories: Array.isArray(payload.categories) ? payload.categories.map(String) : [],
      minimumImportance: payload.minimumImportance === "high" || payload.minimumImportance === "all" ? payload.minimumImportance : "medium",
      profileImpact: Boolean(payload.profileImpact),
      frequency: payload.frequency === "instant" || payload.frequency === "weekly" ? payload.frequency : "daily",
    },
    await currentUserId(),
  );
  return NextResponse.json({ settings });
}
