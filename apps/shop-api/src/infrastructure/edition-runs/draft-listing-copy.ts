import type { Database } from "@auction/db";
import { shopArtwork, shopArtworkImage } from "@auction/db/schema";
import { asc, eq, like } from "drizzle-orm";

/** The slug itself when free, otherwise the first of "-2", "-3"… that is. */
export async function nextFreeSlug(db: Database, slug: string): Promise<string> {
  const taken = new Set(
    (
      await db
        .select({ slug: shopArtwork.slug })
        .from(shopArtwork)
        .where(like(shopArtwork.slug, `${slug}%`))
    ).map((row) => row.slug),
  );
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n += 1) {
    const candidate = `${slug}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Gives a new listing the same images, in the same order, as the artwork it is made from. */
export async function copyArtworkImages(
  db: Database,
  fromArtworkId: string,
  toArtworkId: string,
): Promise<void> {
  const images = await db
    .select({ mediaKey: shopArtworkImage.mediaKey, alt: shopArtworkImage.alt })
    .from(shopArtworkImage)
    .where(eq(shopArtworkImage.artworkId, fromArtworkId))
    .orderBy(asc(shopArtworkImage.position));
  if (images.length === 0) return;
  await db.insert(shopArtworkImage).values(
    images.map((image, position) => ({
      artworkId: toArtworkId,
      mediaKey: image.mediaKey,
      alt: image.alt,
      position,
    })),
  );
}
