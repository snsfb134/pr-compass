import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/local-account-store";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get("pc_session")?.value);
  return NextResponse.json({ user });
}
