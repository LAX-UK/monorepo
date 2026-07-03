import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

/** DELETE /users/me/watchlist/:lotId */
export async function removeWatchlistLot(lotId: string): Promise<boolean> {
  const res = await browserFetch(
    `${browserApiBase()}/users/me/watchlist/${encodeURIComponent(lotId)}`,
    { method: "DELETE" },
  );
  return res.ok;
}
