import { getPreviewApiResponse } from "@/lib/preview-data";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8010";

export type DashboardSummary = {
  source_count: number;
  change_count: number;
  record_count: number;
  needs_review_count: number;
  latest_snapshot: string | null;
  latest_change: Record<string, unknown> | null;
  latest_record: Record<string, unknown> | null;
};

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init });
    if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
    return response.json() as Promise<T>;
  } catch {
    const preview = getPreviewApiResponse(path);
    if (preview !== null && preview !== undefined) return preview as T;
    throw new Error(`Failed to fetch ${path} and no preview fallback is available.`);
  }
}
