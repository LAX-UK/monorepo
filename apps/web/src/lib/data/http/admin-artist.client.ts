import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

/** GET /admin/artists/:id */
export async function fetchAdminArtistById(
  id: string,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  const res = await browserFetch(`${browserApiBase()}/admin/artists/${encodeURIComponent(id)}`);
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: await res.json() };
}
