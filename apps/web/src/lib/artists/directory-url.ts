import { firstString } from "@/lib/admin/admin-list-params";

export function parseArtistDirectoryOffset(
  sp: Record<string, string | string[] | undefined>,
): number {
  const raw = firstString(sp.offset);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Append/replace `?key=value` keeping the rest of the query intact. `null` removes. */
export function artistDirectoryWithQuery(
  basePath: string,
  current: Record<string, string | string[] | undefined>,
  patch: Record<string, string | number | null | undefined>,
  options: { preserveOffset?: boolean } = {},
): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const s = firstString(v);
    if (s) out.set(k, s);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") {
      out.delete(k);
      continue;
    }
    out.set(k, String(v));
  }
  if (!options.preserveOffset) {
    out.delete("offset");
  }
  const q = out.toString();
  return q ? `${basePath}?${q}` : basePath;
}
