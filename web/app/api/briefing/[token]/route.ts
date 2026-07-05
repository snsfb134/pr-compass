import { NextResponse } from "next/server";
import { getBriefingByToken } from "@/lib/briefing-data";

type Params = Promise<{ token: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { token } = await params;
  const briefing = await getBriefingByToken(token);
  if (!briefing) {
    return NextResponse.json({ message: "구독 링크를 확인할 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ briefing });
}
