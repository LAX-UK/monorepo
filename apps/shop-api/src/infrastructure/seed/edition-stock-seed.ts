import type { Database } from "@auction/db";
import { shopArtwork, shopEdition, shopParty, shopSaleAuthorityGrant } from "@auction/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type {
  GrantSaleAuthorityCommand,
  GrantSaleAuthorityResult,
} from "../../application/ports/sale-authority.writer.js";

export type GrantSaleAuthorityFn = (
  command: GrantSaleAuthorityCommand,
) => Promise<GrantSaleAuthorityResult>;

export async function depleteEditionStockForSlug(db: Database, slug: string): Promise<void> {
  const artwork = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, slug))
    .limit(1);
  const artworkId = artwork[0]?.id;
  if (!artworkId) return;
  const [alreadySold] = await db
    .select({ id: shopEdition.id })
    .from(shopEdition)
    .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.listingStatus, "sold")))
    .limit(1);
  if (alreadySold) return;
  await db
    .update(shopEdition)
    .set({ listingStatus: "sold", ownerPartyId: null })
    .where(eq(shopEdition.artworkId, artworkId));
}

export async function grantSeedAuthorityForArtwork(
  db: Database,
  grantSaleAuthority: GrantSaleAuthorityFn,
  artworkId: string,
): Promise<void> {
  const owners = await db
    .select({
      ownerPartyId: shopEdition.ownerPartyId,
      eligibleCount: sql<number>`count(*) filter (where "shop_edition"."listing_status" <> 'sold')::int`,
    })
    .from(shopEdition)
    .innerJoin(shopParty, eq(shopParty.id, shopEdition.ownerPartyId))
    .where(
      and(
        eq(shopEdition.artworkId, artworkId),
        isNotNull(shopEdition.ownerPartyId),
        eq(shopParty.kind, "lax"),
      ),
    )
    .groupBy(shopEdition.ownerPartyId);

  for (const row of owners) {
    if (!row.ownerPartyId || row.eligibleCount <= 0) continue;
    const [existingGrant] = await db
      .select({ id: shopSaleAuthorityGrant.id })
      .from(shopSaleAuthorityGrant)
      .where(
        and(
          eq(shopSaleAuthorityGrant.artworkId, artworkId),
          eq(shopSaleAuthorityGrant.ownerPartyId, row.ownerPartyId),
        ),
      )
      .limit(1);
    if (existingGrant) continue;
    await grantSaleAuthority({
      artworkId,
      ownerPartyId: row.ownerPartyId,
      authorisedCount: Math.min(Number(row.eligibleCount), 10),
      recordedBySubjectId: "seed:catalogue",
      evidenceNote: "Foundation catalogue seed explicit grant",
    });
  }
}
