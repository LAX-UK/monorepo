import "server-only";

import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { purchaseCard } from "@/lib/purchases/purchases.vm";
import type { PayLotDetails } from "./pay-page.vm";

/**
 * What the account's purchases know about each lot of the payment that the plan does not: its
 * artwork, the day it was won and who won it. These are only decoration for the title row and the
 * lots, so a read that fails leaves them out rather than the payment off the page.
 */
export async function loadPayLotDetails(
  lotIds: readonly string[],
): Promise<Record<string, PayLotDetails>> {
  try {
    const sources = await loadPurchaseSources();
    if (!sources) return {};
    const wanted = new Set(lotIds);
    return Object.fromEntries(
      sources.rows
        .filter((row) => wanted.has(row.lot.id))
        .map((row) => {
          const card = purchaseCard(row, sources);
          return [row.lot.id, { image: card.image, wonAt: row.lot.endTime, wonBy: card.wonBy }];
        }),
    );
  } catch {
    return {};
  }
}
