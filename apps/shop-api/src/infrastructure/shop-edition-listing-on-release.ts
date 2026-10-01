import type { Database } from "@auction/db";
import { shopEdition, shopSaleAuthorityGrant } from "@auction/db/schema";
import { and, desc, eq } from "drizzle-orm";

type DbExecutor = Pick<Database, "select">;

/** Matches sale-authority writer semantics: grant counts only `authorised` editions, not reserved. */
export async function resolveListingStatusAfterReservationRelease(
  tx: DbExecutor,
  input: { artworkId: string; ownerPartyId: string | null },
): Promise<"authorised" | "not_authorised"> {
  if (!input.ownerPartyId) {
    return "not_authorised";
  }

  const ownedRows = await tx
    .select({ listingStatus: shopEdition.listingStatus })
    .from(shopEdition)
    .where(
      and(
        eq(shopEdition.artworkId, input.artworkId),
        eq(shopEdition.ownerPartyId, input.ownerPartyId),
      ),
    )
    .for("update");

  const currentAuthorised = ownedRows.filter((row) => row.listingStatus === "authorised").length;

  const [grant] = await tx
    .select({ authorisedCount: shopSaleAuthorityGrant.authorisedCount })
    .from(shopSaleAuthorityGrant)
    .where(
      and(
        eq(shopSaleAuthorityGrant.artworkId, input.artworkId),
        eq(shopSaleAuthorityGrant.ownerPartyId, input.ownerPartyId),
      ),
    )
    .orderBy(desc(shopSaleAuthorityGrant.createdAt), desc(shopSaleAuthorityGrant.id))
    .limit(1);

  if (!grant) {
    return "not_authorised";
  }
  if (currentAuthorised < grant.authorisedCount) {
    return "authorised";
  }
  return "not_authorised";
}
