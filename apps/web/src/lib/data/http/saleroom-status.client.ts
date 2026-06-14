import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";

const DEFAULT_STATUS: PublicSaleroomSessionStatus = {
  status: "none",
  currentLotId: null,
};

/** Browser fetch for saleroom session state (reconnect hydration). */
export async function fetchSaleroomStatus(
  saleId: string,
): Promise<PublicSaleroomSessionStatus | null> {
  try {
    const url = `${browserApiBase()}/sales/${encodeURIComponent(saleId)}/saleroom/status`;
    const res = await browserFetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: PublicSaleroomSessionStatus };
    const data = body.data;
    if (!data || typeof data.status !== "string") return DEFAULT_STATUS;
    return {
      status: data.status,
      currentLotId: data.currentLotId ?? null,
    };
  } catch {
    return null;
  }
}
