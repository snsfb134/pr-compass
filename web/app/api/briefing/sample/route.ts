import { NextResponse } from "next/server";
import { loadOperationalBriefing } from "@/lib/briefing-data";

export async function GET() {
  return NextResponse.json({ briefing: await loadOperationalBriefing("sample") });
}
