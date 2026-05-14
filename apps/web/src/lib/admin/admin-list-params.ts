export function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return s === "" ? undefined : s;
}

function parseIntBounded(
  raw: string | string[] | undefined,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  const s = firstString(raw);
  if (s === undefined) return fallback;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

/** Shared limit/offset/q/sort parsing for admin list URLs (server-safe). */
export function parseListSearchParams(sp: Record<string, string | string[] | undefined>) {
  return {
    q: firstString(sp.q)?.trim() || undefined,
    limit: parseIntBounded(sp.limit, 50, { min: 10, max: 200 }),
    offset: parseIntBounded(sp.offset, 0, { min: 0, max: 50_000 }),
    sort: firstString(sp.sort)?.trim() || undefined,
  };
}

/** Window into a full in-memory list (API has no offset). */
export function sliceAdminListWindow<T>(
  items: readonly T[],
  offset: number,
  limit: number,
): { rows: T[]; total: number } {
  const total = items.length;
  const start = Math.min(Math.max(0, offset), total);
  const rows = items.slice(start, start + limit);
  return { rows, total };
}

/** Merge current search params with patch; `null` or `""` removes a key. */
export function buildListHref(
  basePath: string,
  current: Record<string, string | string[] | undefined>,
  patch: Record<string, string | number | boolean | undefined | null | "">,
): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) merged[k] = s;
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null || v === "") {
      delete merged[k];
      continue;
    }
    if (typeof v === "boolean") {
      if (v) merged[k] = "1";
      else delete merged[k];
      continue;
    }
    merged[k] = String(v);
  }
  const qs = new URLSearchParams(merged);
  const q = qs.toString();
  return q ? `${basePath}?${q}` : basePath;
}
