import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.server";

/** GET /payments/me/lot/:lotId/fulfilment */
export async function fetchMyLotFulfilment(
  lotId: string,
): Promise<LotFulfilmentSnapshot | null | "error"> {
  const res = await browserFetch(
    `${browserApiBase()}/payments/me/lot/${encodeURIComponent(lotId)}/fulfilment`,
    { cache: "no-store" },
  );
  if (!res.ok) return "error";
  const body = (await res.json()) as { data: LotFulfilmentSnapshot | null };
  return body.data ?? null;
}
