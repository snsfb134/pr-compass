export function buildViewHref(
  path: string,
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
  value: string,
) {
  const query = new URLSearchParams();
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      if (paramKey === key) continue;
      if (typeof paramValue === "string" && paramValue) {
        query.set(paramKey, paramValue);
      }
    }
  }
  query.set(key, value);
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}
