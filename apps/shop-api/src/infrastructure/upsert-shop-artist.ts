import type { Database } from "@auction/db";
import { shopArtist, shopParty } from "@auction/db/schema";
import { eq } from "drizzle-orm";

export type UpsertShopArtistInput = {
  slug: string;
  displayName: string;
  discipline: string | null;
  portraitImageUrl: string | null;
};

export async function updateShopArtist(
  db: Database,
  artistId: string,
  input: Omit<UpsertShopArtistInput, "slug">,
): Promise<void> {
  const [artist] = await db
    .select({ partyId: shopArtist.partyId })
    .from(shopArtist)
    .where(eq(shopArtist.id, artistId))
    .limit(1);
  if (!artist) {
    throw new Error(`Shop artist ${artistId} not found`);
  }
  await db
    .update(shopParty)
    .set({ displayName: input.displayName })
    .where(eq(shopParty.id, artist.partyId));
  await db
    .update(shopArtist)
    .set({
      discipline: input.discipline,
      portraitImageUrl: input.portraitImageUrl,
    })
    .where(eq(shopArtist.id, artistId));
}

export async function upsertShopArtist(
  db: Database,
  input: UpsertShopArtistInput,
): Promise<string> {
  const [existing] = await db
    .select({ id: shopArtist.id })
    .from(shopArtist)
    .where(eq(shopArtist.slug, input.slug))
    .limit(1);
  if (existing) {
    await updateShopArtist(db, existing.id, input);
    return existing.id;
  }

  const [party] = await db
    .insert(shopParty)
    .values({ displayName: input.displayName })
    .returning({ id: shopParty.id });
  if (!party) {
    throw new Error(`Failed to create party for artist ${input.slug}`);
  }
  const [artist] = await db
    .insert(shopArtist)
    .values({
      partyId: party.id,
      slug: input.slug,
      discipline: input.discipline,
      portraitImageUrl: input.portraitImageUrl,
    })
    .returning({ id: shopArtist.id });
  if (!artist) {
    throw new Error(`Failed to create artist ${input.slug}`);
  }
  return artist.id;
}
