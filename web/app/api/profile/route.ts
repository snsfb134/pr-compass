import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api";
import { getSessionUser } from "@/lib/local-account-store";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get("pc_session")?.value);
  const headers = user ? { "x-user-id": user.id } : undefined;
  const response = await fetch(`${API_BASE_URL}/api/profile`, { cache: "no-store", headers });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get("pc_session")?.value);
  if (!user) {
    return NextResponse.json({ message: "로그인 후 프로필을 저장할 수 있습니다." }, { status: 401 });
  }
  const payload = await request.json();
  const response = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.id,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get("pc_session")?.value);
  if (!user) {
    return NextResponse.json({ message: "로그인 후 프로필을 저장할 수 있습니다." }, { status: 401 });
  }
  const payload = await request.json();
  const response = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.id,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}
