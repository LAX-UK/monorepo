import type { Database } from "@auction/db";
import { artistCategories, artistProfile, category } from "@auction/db/schema";
import type { ArtistKind, PublicArtistDirectoryFacets } from "@auction/types";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { artistHasPublicBrowseLotsExists } from "../artist-public-lot-count.sql.js";
import { birthYearExpr } from "./artist-profile-list-filters.js";

/** Facet aggregates for the public directory — letters / kinds / living-historical / featured / nationalities.
 * Computed against the *base* filter (q + approved + non-archived) so each
 * facet count is independent of the current refinement (else chip counts
 * always equal the current total, which is useless for navigation). */
export async function computeDirectoryFacets(
  db: Database,
  baseWhere: ReturnType<typeof and>,
): Promise<PublicArtistDirectoryFacets> {
  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      featured: sql<number>`count(*) filter (where ${artistProfile.featured})::int`,
      living: sql<number>`count(*) filter (where ${artistProfile.deathYear} is null)::int`,
      historical: sql<number>`count(*) filter (where ${artistProfile.deathYear} is not null)::int`,
      hasUpcoming: sql<number>`count(*) filter (where ${artistHasPublicBrowseLotsExists()})::int`,
    })
    .from(artistProfile)
    .where(baseWhere);

  // Kind counts grouped dynamically so new kinds appear without code changes (OCP).
  const kindRows = await db
    .select({ kind: artistProfile.kind, n: sql<number>`count(*)::int` })
    .from(artistProfile)
    .where(baseWhere)
    .groupBy(artistProfile.kind);
  const byKind: Partial<Record<ArtistKind, number>> = {};
  for (const row of kindRows) {
    byKind[row.kind as ArtistKind] = Number(row.n ?? 0);
  }

  // Top collecting categories (departments) for the directory side rail.
  const categoryFacetRows = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      n: sql<number>`count(*)::int`,
    })
    .from(artistCategories)
    .innerJoin(category, eq(category.id, artistCategories.categoryId))
    .innerJoin(artistProfile, eq(artistProfile.id, artistCategories.artistProfileId))
    .where(and(baseWhere, eq(category.archived, false)))
    .groupBy(category.id, category.name, category.slug)
    .orderBy(sql`count(*) desc`)
    .limit(12);
  const topCategories = categoryFacetRows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    count: Number(r.n ?? 0),
  }));

  const letterBucketExpr = sql<string>`case
      when lower(left(trim(${artistProfile.displayName}), 1)) ~ '^[a-z]' then lower(left(trim(${artistProfile.displayName}), 1))
      when lower(left(trim(${artistProfile.displayName}), 1)) ~ '^[0-9]' then '#'
      else 'other'
    end`;

  const letterRows = await db
    .select({
      bucket: letterBucketExpr,
      n: sql<number>`count(*)::int`,
    })
    .from(artistProfile)
    .where(baseWhere)
    .groupBy(letterBucketExpr);

  const letters = letterRows.map((r) => ({
    letter: String(r.bucket),
    count: Number(r.n ?? 0),
  }));

  const nationalityRows = await db
    .select({
      nationality: artistProfile.nationality,
      n: sql<number>`count(*)::int`,
    })
    .from(artistProfile)
    .where(and(baseWhere, isNotNull(artistProfile.nationality)))
    .groupBy(artistProfile.nationality)
    .orderBy(sql`count(*) desc`)
    .limit(12);

  const topNationalities = nationalityRows
    .map((r) => ({
      value: (r.nationality ?? "").trim(),
      count: Number(r.n ?? 0),
    }))
    .filter((r) => r.value.length > 0);

  /** Decades grouped on the floor of birthYear / 10, with a single "pre-1800"
   * bucket so the rail doesn't sprawl. We return the top 8 by count so the
   * UI stays compact. */
  const decadeBucketExpr = sql<string>`case
      when ${birthYearExpr} is null then null
      when ${birthYearExpr} < 1800 then 'pre-1800'
      else (floor(${birthYearExpr} / 10) * 10)::int::text || 's'
    end`;

  const decadeRows = await db
    .select({
      bucket: decadeBucketExpr,
      n: sql<number>`count(*)::int`,
    })
    .from(artistProfile)
    .where(and(baseWhere, isNotNull(artistProfile.birthYear)))
    .groupBy(decadeBucketExpr)
    .orderBy(decadeBucketExpr);

  const topDecades = decadeRows
    .map((r) => {
      const key = String(r.bucket ?? "").trim();
      if (!key) return null;
      const label = key === "pre-1800" ? "Before 1800" : key;
      return { key, label, count: Number(r.n ?? 0) };
    })
    .filter((r): r is { key: string; label: string; count: number } => r !== null);

  return {
    total: Number(agg?.total ?? 0),
    featured: Number(agg?.featured ?? 0),
    living: Number(agg?.living ?? 0),
    historical: Number(agg?.historical ?? 0),
    byKind,
    hasUpcoming: Number(agg?.hasUpcoming ?? 0),
    topNationalities,
    topCategories,
    topDecades,
    letters,
  };
}
