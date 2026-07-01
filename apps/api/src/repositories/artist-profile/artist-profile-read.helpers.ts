import type { Database } from "@auction/db";
import { artistCategories, category } from "@auction/db/schema";
import type { ArtistCategoryRef } from "@auction/types";
import { asc, eq, inArray } from "drizzle-orm";

/** Ordered category (department) refs for one artist. */
export async function loadCategories(
  db: Database,
  artistProfileId: string,
): Promise<ArtistCategoryRef[]> {
  const rows = await db
    .select({ id: category.id, name: category.name, slug: category.slug })
    .from(artistCategories)
    .innerJoin(category, eq(category.id, artistCategories.categoryId))
    .where(eq(artistCategories.artistProfileId, artistProfileId))
    .orderBy(asc(artistCategories.sortOrder), asc(category.name));
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
}

/** Batch category loader for list views (avoids N+1). */
export async function loadCategoriesForArtists(
  db: Database,
  artistProfileIds: string[],
): Promise<Map<string, ArtistCategoryRef[]>> {
  const map = new Map<string, ArtistCategoryRef[]>();
  if (artistProfileIds.length === 0) return map;
  const rows = await db
    .select({
      artistProfileId: artistCategories.artistProfileId,
      id: category.id,
      name: category.name,
      slug: category.slug,
      sortOrder: artistCategories.sortOrder,
    })
    .from(artistCategories)
    .innerJoin(category, eq(category.id, artistCategories.categoryId))
    .where(inArray(artistCategories.artistProfileId, artistProfileIds))
    .orderBy(asc(artistCategories.sortOrder), asc(category.name));
  for (const row of rows) {
    const list = map.get(row.artistProfileId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    map.set(row.artistProfileId, list);
  }
  return map;
}
