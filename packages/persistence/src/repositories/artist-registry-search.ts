import { type Database, qualifiedColumn } from "@auction/db";
import { artistAlias, artistProfile } from "@auction/db/schema";
import type { ArtistKind, ArtistStatus } from "@auction/types";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { ArtistSearchHit } from "../interfaces/artist-registry.types.js";
import { FUZZY_THRESHOLD, partialSearchPattern, slugify } from "./artist-registry.helpers.js";

/** The alias of the artist in the same row that matches `pattern`, if any. */
export function matchedAliasSql(pattern: string) {
  return sql<string | null>`(
    select ${artistAlias.alias}
    from ${artistAlias}
    where ${artistAlias.artistProfileId} = ${qualifiedColumn(artistProfile.id)}
      and ${artistAlias.alias} ilike ${pattern}
    limit 1
  )`;
}

/** How close the artist in the same row is to `text`: the better of the name and any alias. */
export function fuzzyScoreSql(text: string) {
  return sql<number>`greatest(
    similarity(${artistProfile.displayName}, ${text}),
    coalesce((
      select max(similarity(${artistAlias.alias}, ${text}))
      from ${artistAlias}
      where ${artistAlias.artistProfileId} = ${qualifiedColumn(artistProfile.id)}
    ), 0)
  )`;
}

export async function searchArtists(
  db: Database,
  query: string,
  limit = 10,
): Promise<ArtistSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const slug = slugify(trimmed);

  const exactRows = await db
    .select()
    .from(artistProfile)
    .where(
      and(
        ne(artistProfile.status, "merged_into"),
        eq(artistProfile.archived, false),
        sql`(${artistProfile.slug} = ${slug} OR lower(${artistProfile.displayName}) = lower(${trimmed}))`,
      ),
    )
    .limit(limit);
  const exact: ArtistSearchHit[] = exactRows.map((r) => ({
    id: r.id as string,
    displayName: r.displayName as string,
    slug: r.slug as string,
    kind: (r.kind as ArtistKind) ?? "artist",
    status: (r.status as ArtistStatus) ?? "approved",
    matchedAlias: null,
    matchType: "exact",
    score: 1,
  }));
  if (exact.length >= limit) return exact;

  const exactIds = new Set(exact.map((h) => h.id));

  const aliasRows = await db
    .select({
      id: artistProfile.id,
      displayName: artistProfile.displayName,
      slug: artistProfile.slug,
      kind: artistProfile.kind,
      status: artistProfile.status,
      alias: artistAlias.alias,
    })
    .from(artistAlias)
    .innerJoin(artistProfile, eq(artistProfile.id, artistAlias.artistProfileId))
    .where(
      and(
        ne(artistProfile.status, "merged_into"),
        eq(artistProfile.archived, false),
        sql`lower(${artistAlias.alias}) = lower(${trimmed})`,
      ),
    )
    .limit(limit);
  const aliasHits: ArtistSearchHit[] = aliasRows
    .filter((r) => !exactIds.has(r.id as string))
    .map((r) => ({
      id: r.id as string,
      displayName: r.displayName as string,
      slug: r.slug as string,
      kind: (r.kind as ArtistKind) ?? "artist",
      status: (r.status as ArtistStatus) ?? "approved",
      matchedAlias: r.alias,
      matchType: "alias",
      score: 1,
    }));

  if (exact.length + aliasHits.length >= limit) {
    return [...exact, ...aliasHits].slice(0, limit);
  }

  const aliasIds = new Set(aliasHits.map((h) => h.id));
  const skipIds = new Set([...exactIds, ...aliasIds]);
  let remaining = limit - exact.length - aliasHits.length;

  const pattern = partialSearchPattern(trimmed);
  const partialRows = await db
    .select({
      id: artistProfile.id,
      displayName: artistProfile.displayName,
      slug: artistProfile.slug,
      kind: artistProfile.kind,
      status: artistProfile.status,
      alias: matchedAliasSql(pattern),
    })
    .from(artistProfile)
    .where(
      and(
        ne(artistProfile.status, "merged_into"),
        eq(artistProfile.archived, false),
        or(
          ilike(artistProfile.displayName, pattern),
          ilike(artistProfile.slug, pattern),
          sql`exists (
              select 1 from ${artistAlias}
              where ${artistAlias.artistProfileId} = ${artistProfile.id}
                and ${artistAlias.alias} ilike ${pattern}
            )`,
        ),
      ),
    )
    .orderBy(asc(artistProfile.displayName))
    .limit(remaining + skipIds.size);

  const partialHits: ArtistSearchHit[] = partialRows
    .filter((r) => !skipIds.has(r.id as string))
    .slice(0, remaining)
    .map((r) => ({
      id: r.id as string,
      displayName: r.displayName as string,
      slug: r.slug as string,
      kind: (r.kind as ArtistKind) ?? "artist",
      status: (r.status as ArtistStatus) ?? "approved",
      matchedAlias: r.alias ?? null,
      matchType: "partial",
      score: 0.85,
    }));

  for (const hit of partialHits) skipIds.add(hit.id);
  remaining -= partialHits.length;
  if (remaining <= 0) {
    return [...exact, ...aliasHits, ...partialHits].slice(0, limit);
  }

  const fuzzyRows = await db
    .select({
      id: artistProfile.id,
      displayName: artistProfile.displayName,
      slug: artistProfile.slug,
      kind: artistProfile.kind,
      status: artistProfile.status,
      score: fuzzyScoreSql(trimmed),
    })
    .from(artistProfile)
    .where(
      and(
        ne(artistProfile.status, "merged_into"),
        eq(artistProfile.archived, false),
        sql`(
            similarity(${artistProfile.displayName}, ${trimmed}) >= ${FUZZY_THRESHOLD}
            OR exists (
              select 1 from ${artistAlias}
              where ${artistAlias.artistProfileId} = ${artistProfile.id}
                and similarity(${artistAlias.alias}, ${trimmed}) >= ${FUZZY_THRESHOLD}
            )
          )`,
      ),
    )
    .orderBy(desc(fuzzyScoreSql(trimmed)))
    .limit(remaining + skipIds.size);

  const fuzzy: ArtistSearchHit[] = fuzzyRows
    .filter((r) => !skipIds.has(r.id as string))
    .slice(0, remaining)
    .map((r) => ({
      id: r.id as string,
      displayName: r.displayName as string,
      slug: r.slug as string,
      kind: (r.kind as ArtistKind) ?? "artist",
      status: (r.status as ArtistStatus) ?? "approved",
      matchedAlias: null,
      matchType: "fuzzy",
      score: Number(r.score ?? 0),
    }));

  return [...exact, ...aliasHits, ...partialHits, ...fuzzy];
}
