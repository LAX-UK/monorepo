import type { Database } from "@auction/db";
import { shopPayoutLedger } from "@auction/db/schema";
import { type SQL, eq, sql } from "drizzle-orm";
import {
  type PortalPartyScope,
  portalPartyRows,
  resolvePortalPartyScope,
} from "./portal-party-scope.js";

/**
 * The artwork a payout ledger row was earned on, whichever kind of sale it came from. Written as
 * correlated subqueries so it can sit in the WHERE of any query that reads `shop_payout_ledger`.
 */
const payoutArtworkId = sql`coalesce(
  (select ol.artwork_id from shop_order_line ol where ol.id = ${shopPayoutLedger.orderLineId}),
  (select e.artwork_id from shop_third_party_sale t
     join shop_edition e on e.id = t.edition_id
    where t.id = ${shopPayoutLedger.thirdPartySaleId}),
  (select os.artwork_id from shop_original_sale os where os.id = ${shopPayoutLedger.originalSaleId})
)`;

/**
 * Which payout ledger rows a person may see in the seller portal and in their data export, under
 * the rule in `portal-party-scope.ts`.
 *
 * - A party they own: every payout owed to it. A gallery signed in as itself therefore sees the
 *   payouts of every artist it represents.
 * - An artist profile on a party they do not own: only that artist's payouts, meaning rows owed to
 *   the artist (`payee_kind = 'artist'`) for the artist's own works. Another artist paid through
 *   the same gallery, and the gallery's own earnings, stay out.
 *
 * Null when the person has neither, so the caller reads nothing.
 */
export async function resolvePortalPayoutScope(
  db: Database,
  identitySubjectId: string,
): Promise<SQL | null> {
  const scope = await resolvePortalPartyScope(db, identitySubjectId);
  return portalPayoutRows(scope);
}

export function portalPayoutRows(scope: PortalPartyScope): SQL | null {
  return portalPartyRows(
    scope,
    shopPayoutLedger.ownerPartyId,
    payoutArtworkId,
    eq(shopPayoutLedger.payeeKind, "artist"),
  );
}
