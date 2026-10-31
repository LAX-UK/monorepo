import "server-only";

import { getServerAccountPurchaseFacts } from "@/lib/data/http/account-buying.server";
import { getServerEntityWonLots } from "@/lib/data/http/payments.server";
import { listServerReturnedWorks } from "@/lib/data/http/workspace-selling.server";
import { type CollectionWork, boughtWork, returnedWork } from "./collection-works";

/**
 * The organisation's collection through Bid: the lots it won, with where each one is (from the
 * purchase records the member follows), and the consigned works that came back unsold. `null`
 * when the wins could not be read; the returned works and delivery states degrade quietly.
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
  if (!wins) return null;
  const now = new Date();
  const factsByLot = new Map((facts ?? []).map((row) => [row.lotId, row]));
  return [
    ...wins.map((win) =>
      boughtWork(win, factsByLot.get(win.lotId), { now, canSell: input.canSell }),
    ),
    ...returned.map((work) => returnedWork(work, { now })),
  ];
}
