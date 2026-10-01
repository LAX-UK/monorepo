import type { Database } from "@auction/db";
import { shopEdition } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";

/** Test helper: mark every owned edition on an artwork as authorised for checkout tests. */
export async function authoriseAllOwnedEditionsForTests(
  db: Database,
  artworkId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(shopEdition)
    .set({
      listingStatus: "authorised",
      saleAuthorisedAt: now,
    })
    .where(
      and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.listingStatus, "not_authorised")),
    );
}
