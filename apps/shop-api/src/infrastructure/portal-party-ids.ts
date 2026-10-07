import type { Database } from "@auction/db";
import { shopArtist, shopParty } from "@auction/db/schema";
import { eq } from "drizzle-orm";

export async function resolvePortalPartyIds(
  db: Database,
  identitySubjectId: string,
): Promise<string[]> {
  const partyIds = new Set<string>();

  const [ownedParty] = await db
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, identitySubjectId))
    .limit(1);
  if (ownedParty) {
    partyIds.add(ownedParty.id);
  }

  const [linkedArtist] = await db
    .select({ partyId: shopArtist.partyId })
    .from(shopArtist)
    .where(eq(shopArtist.identitySubjectId, identitySubjectId))
    .limit(1);
  if (linkedArtist) {
    partyIds.add(linkedArtist.partyId);
  }

  return [...partyIds];
}
