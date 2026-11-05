import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

/** GET /sales/:saleId/follow: whether the signed-in person follows the sale; false if unreadable. */
export async function fetchSaleFollowing(saleId: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await browserFetch(
      `${browserApiBase()}/sales/${encodeURIComponent(saleId)}/follow`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: { isFollowing?: boolean } };
    return body.data?.isFollowing === true;
  } catch {
    return false;
  }
}

/** POST/DELETE /sales/:saleId/follow */
export async function toggleSaleFollow(saleId: string, following: boolean): Promise<boolean> {
  const res = await browserFetch(`${browserApiBase()}/sales/${encodeURIComponent(saleId)}/follow`, {
    method: following ? "DELETE" : "POST",
  });
  return res.ok;
}
