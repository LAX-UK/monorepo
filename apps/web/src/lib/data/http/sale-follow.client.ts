import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

/** POST/DELETE /sales/:saleId/follow */
export async function toggleSaleFollow(saleId: string, following: boolean): Promise<boolean> {
  const res = await browserFetch(`${browserApiBase()}/sales/${encodeURIComponent(saleId)}/follow`, {
    method: following ? "DELETE" : "POST",
  });
  return res.ok;
}
