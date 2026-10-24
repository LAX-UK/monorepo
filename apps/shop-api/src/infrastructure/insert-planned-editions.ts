import type { Database } from "@auction/db";
import { shopArtist, shopEdition } from "@auction/db/schema";
import { assertValidEditionPlan, planEditionsForArtwork } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import { ensureLaxShopParty } from "./ensure-lax-party.js";

/**
 * Creates the canonical edition run for a new artwork (1–24: 10 buyer entitlement, 10 for the
 * artist, 4 for LAX), each unprinted and not yet authorised for sale. Returns how many were made:
 * 24, or 0 for an original.
 */
export async function insertPlannedEditions(
  tx: Database,
  input: { artworkId: string; artistId: string; eligibleForEditionAllocation: boolean },
): Promise<number> {
  const plan = planEditionsForArtwork(input.eligibleForEditionAllocation);
  assertValidEditionPlan(plan);
  if (plan.length === 0) return 0;
  const laxPartyId = await ensureLaxShopParty(tx);
  const [artist] = await tx
    .select({ partyId: shopArtist.partyId })
    .from(shopArtist)
    .where(eq(shopArtist.id, input.artistId))
    .limit(1);
  const artistPartyId = artist?.partyId ?? null;
  await tx.insert(shopEdition).values(
    plan.map((row) => ({
      artworkId: input.artworkId,
      editionNumber: row.editionNumber,
      allocation: row.allocation,
      ownerPartyId:
        row.allocation === "lax" ? laxPartyId : row.allocation === "artist" ? artistPartyId : null,
      listingStatus: "not_authorised" as const,
      custodyStatus: "unprinted" as const,
    })),
  );
  return plan.length;
}
