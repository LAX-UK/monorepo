import "server-only";

import { purchasesToPayBy } from "@/lib/buying/account-buying-figures";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { ClientAttention } from "./client-attention";
import { deriveClientAttention } from "./derive-client-attention";

/** Unread notifications counted for the menu; the badge shows "9+" past this. */
const UNREAD_LIMIT = 10;

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/**
 * What is waiting for the person in the account in use: the one reader behind the header chip,
 * the menu counts and the Needs action list. Each source degrades to "nothing" on failure.
 */
export async function loadClientAttention(userId: string): Promise<ClientAttention> {
  const c = await getServerDataContainer();
  const [scope, bids, purchases, unread] = await Promise.allSettled([
    c.buying.scope(),
    c.buying.bids(),
    c.buying.purchases(),
    c.notifications.listMine({ tab: "unread", limit: UNREAD_LIMIT }),
  ]);
  return deriveClientAttention({
    userId,
    bids: settled(bids, []),
    // Only what this person pays: a buyer agent is told about a win, not asked to pay for it.
    purchasesToPay:
      scope.status === "fulfilled" ? purchasesToPayBy(scope.value, settled(purchases, [])) : [],
    unreadNotifications: settled(unread, []),
  });
}
