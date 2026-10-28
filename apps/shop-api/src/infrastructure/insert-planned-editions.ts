import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopEdition } from "@auction/db/schema";
import {
  type EditionRunSpec,
  LAX_STANDARD_RUN,
  assertValidEditionPlan,
  planEditionRun,
} from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import { runToColumns } from "./edition-run-columns.js";
import { ensureLaxShopParty } from "./ensure-lax-party.js";

const NO_PROOFS_KEPT = { ap: 0, pp: 0, hc: 0, bat: 0 } as const;

/**
 * Records a run on a new artwork and creates its prints, each unprinted and not yet authorised
 * for sale. Owners: LAX for LAX prints, the artist's party for artist prints, nobody for buyer
 * prints. Returns how many prints were made (0 for an open edition, which is stocked in batches).
 */
export async function insertEditionRun(
  tx: Database,
  input: { artworkId: string; artistId: string; run: EditionRunSpec },
): Promise<number> {
  const plan = planEditionRun(input.run);
  assertValidEditionPlan(plan, input.run);
  await tx
    .update(shopArtwork)
    .set(runToColumns({ spec: input.run, proofsKept: NO_PROOFS_KEPT }))
    .where(eq(shopArtwork.id, input.artworkId));
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
      stockRef: row.stockRef,
      proofNumber: row.proofNumber,
      allocation: row.allocation,
      ownerPartyId:
        row.allocation === "lax" ? laxPartyId : row.allocation === "artist" ? artistPartyId : null,
      listingStatus: "not_authorised" as const,
      custodyStatus: "unprinted" as const,
    })),
  );
  return plan.length;
}

/**
 * Creates the LAX standard run (1–24: 10 buyer entitlement, 10 for the artist, 4 for LAX) for an
 * artwork that sells prints, and nothing for an original. Returns how many prints were made.
 */
export async function insertPlannedEditions(
  tx: Database,
  input: { artworkId: string; artistId: string; eligibleForEditionAllocation: boolean },
): Promise<number> {
  if (!input.eligibleForEditionAllocation) return 0;
  return insertEditionRun(tx, {
    artworkId: input.artworkId,
    artistId: input.artistId,
    run: LAX_STANDARD_RUN,
  });
}
