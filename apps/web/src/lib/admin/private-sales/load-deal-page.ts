import "server-only";

import { getAdminDeal } from "@/lib/data/http/admin-private-sales.reader";
import type { DealRecord } from "@/lib/data/http/admin-private-sales.schema";

export type DealPageModel =
  | { kind: "ready"; deal: DealRecord }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** One deal; the kind says why there is no record to show. */
export async function loadAdminDealPage(ref: string): Promise<DealPageModel> {
  try {
    const deal = await getAdminDeal(ref);
    return deal ? { kind: "ready", deal } : { kind: "not_found" };
  } catch (error) {
    return {
      kind: error instanceof Error && error.message === "forbidden" ? "forbidden" : "unavailable",
    };
  }
}
