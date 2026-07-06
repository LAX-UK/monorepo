import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";

export type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
export { isSaleroomSessionActive } from "@/lib/saleroom/public-session-status";

const DEFAULT_STATUS: PublicSaleroomSessionStatus = {
  status: "none",
  currentLotId: null,
  nextLotId: null,
};

export async function getServerSaleroomStatus(
  saleId: string,
): Promise<PublicSaleroomSessionStatus> {
  const base = getServerApiBase();
  const url = `${base}/sales/${encodeURIComponent(saleId)}/saleroom/status`;
  // Live saleroom state: must reflect the clerk's current lot on every request,
  // so it is never cached (matches the admin saleroom-session fetch convention).
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return DEFAULT_STATUS;
  const body = (await res.json()) as { data?: PublicSaleroomSessionStatus };
  const data = body.data;
  if (!data || typeof data.status !== "string") return DEFAULT_STATUS;
  return {
    status: data.status,
    currentLotId: data.currentLotId ?? null,
    nextLotId: data.nextLotId ?? null,
  };
}
