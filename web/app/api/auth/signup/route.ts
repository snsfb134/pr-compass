import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createLocalUser } from "@/lib/local-account-store";
import { validateSignupInput } from "@/lib/auth-validation";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const validation = validateSignupInput(String(payload.username || ""), String(payload.email || ""), String(payload.password || ""));
    if (!validation.valid) {
      return NextResponse.json({ message: validation.message, fieldErrors: validation.fieldErrors }, { status: 400 });
    }
    const session = await createLocalUser(String(payload.username || ""), String(payload.email || ""), String(payload.password || ""));
    const cookieStore = await cookies();
    cookieStore.set("pc_session", session.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return NextResponse.json({ user: session.user });
  } catch (error) {
    const fieldErrors = error instanceof Error && "fieldErrors" in error ? (error as Error & { fieldErrors?: Record<string, string> }).fieldErrors : undefined;
    return NextResponse.json({ message: error instanceof Error ? error.message : "회원가입에 실패했습니다.", fieldErrors }, { status: 400 });
  }
}
