import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/local-account-store";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pc_session")?.value;
  await clearSession(token);
  cookieStore.delete("pc_session");
  return NextResponse.json({ ok: true });
}
