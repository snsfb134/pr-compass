import { NextResponse } from "next/server";
import { upsertSubscription } from "@/lib/subscription-store";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const result = await upsertSubscription(String(payload.name || ""), String(payload.email || ""), String(payload.affiliation || ""));
    return NextResponse.json({
      ...result,
      briefingUrl: `/briefing/${result.subscription.token}`,
      message: result.created ? "브리핑 구독이 등록되었습니다." : "구독 정보가 업데이트되었습니다.",
    });
  } catch (error) {
    const fieldErrors = error instanceof Error && "fieldErrors" in error ? (error as Error & { fieldErrors?: Record<string, string> }).fieldErrors : undefined;
    return NextResponse.json({ message: error instanceof Error ? error.message : "구독 등록에 실패했습니다.", fieldErrors }, { status: 400 });
  }
}
