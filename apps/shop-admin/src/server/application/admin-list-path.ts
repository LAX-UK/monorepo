export function adminListPath(
  resourcePath: string,
  input?: { cursor?: string | undefined; query?: Record<string, string> },
): string {
  const params = new URLSearchParams({ limit: "50", ...input?.query });
  const cursor = input?.cursor?.trim();
  if (cursor) {
    params.set("cursor", cursor);
  }
  const base = resourcePath.replace(/^\//, "").replace(/\?.*$/, "");
  return `${base}?${params.toString()}`;
}
