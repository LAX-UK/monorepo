import type { Database } from "@auction/db";
import { shopArtist, shopParty, shopPayoutLedger } from "@auction/db/schema";
import { type SQL, and, eq, or, sql } from "drizzle-orm";

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
 * Which payout ledger rows a person may see in the seller portal and in their data export.
 *
 * - Their own party (the one their sign-in is linked to) sees every payout owed to it. A gallery
 *   signed in as itself therefore sees the payouts of every artist it represents.
 * - Their artist profile grants only that artist's payouts: rows owed to the profile's party for
 *   the artist's own works. One party may represent several artists, so the party alone never
 *   decides; another artist paid through the same gallery stays out.
 *
 * Null when the person has neither, so the caller reads nothing.
 */
export async function resolvePortalPayoutScope(
  db: Database,
  identitySubjectId: string,
): Promise<SQL | null> {
  const [[ownParty], [artist]] = await Promise.all([
    db
      .select({ id: shopParty.id })
      .from(shopParty)
      .where(eq(shopParty.identitySubjectId, identitySubjectId))
      .limit(1),
    db
      .select({ id: shopArtist.id, partyId: shopArtist.partyId })
      .from(shopArtist)
      .where(eq(shopArtist.identitySubjectId, identitySubjectId))
      .limit(1),
  ]);

  const grants: SQL[] = [];
  if (ownParty) {
    grants.push(eq(shopPayoutLedger.ownerPartyId, ownParty.id));
  }
  if (artist && artist.partyId !== ownParty?.id) {
    const artistRows = and(
      eq(shopPayoutLedger.ownerPartyId, artist.partyId),
      sql`exists (select 1 from shop_artwork a where a.id = ${payoutArtworkId} and a.artist_id = ${artist.id})`,
    );
    if (artistRows) grants.push(artistRows);
  }
  if (grants.length === 0) return null;
  return grants.length === 1 ? (grants[0] as SQL) : (or(...grants) as SQL);
}
