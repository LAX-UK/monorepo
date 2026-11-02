import "server-only";

import { getServerAccountPurchaseFacts } from "@/lib/data/http/account-buying.server";
import { getServerEntityWonLots } from "@/lib/data/http/payments.server";
import { listServerReturnedWorks } from "@/lib/data/http/workspace-selling.server";
import { type CollectionWork, boughtWork, ownedWins, returnedWork } from "./collection-works";

/**
 * The organisation's collection through Bid: the lots it owns, with where each one is (from the
 * purchase records the member follows), and the consigned works that came back unsold. A work is
 * owned once it is paid for and the purchase was not cancelled or refunded. `null` when the wins
 * or the purchase records could not be read, since ownership cannot be told without them; the
 * returned works degrade quietly.
 */
export async function loadCollectionWorks(input: {
  organisationId: string;
  canSell: boolean;
}): Promise<CollectionWork[] | null> {
  const [wins, facts, returned] = await Promise.all([
    getServerEntityWonLots()
      .then((read) => read.rows)
      .catch(() => null),
    getServerAccountPurchaseFacts(input.organisationId).catch(() => null),
    listServerReturnedWorks().catch(() => []),
  ]);
  if (!wins || !facts) return null;
  const now = new Date();
  const factsByLot = new Map(facts.map((row) => [row.lotId, row]));
  const owned = ownedWins(wins, factsByLot);
  return [
    ...owned.map((win) =>
      boughtWork(win, factsByLot.get(win.lotId), { now, canSell: input.canSell }),
    ),
    ...returned.map((work) => returnedWork(work, { now })),
  ];
}
