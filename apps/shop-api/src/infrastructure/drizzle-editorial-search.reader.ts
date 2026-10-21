import type { Database } from "@auction/db";
import { shopEditorialExhibition, shopEditorialStory } from "@auction/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { EditorialSearchReader } from "../application/ports/editorial-search.reader.js";
import {
  selectExhibitionSummaries,
  selectStorySummaries,
  toExhibitionSummary,
  toStorySummary,
} from "./drizzle-editorial-relations.js";

/** Search returns one bounded page; storefronts show matches without pagination. */
export const EDITORIAL_SEARCH_LIMIT = 50;

/** `%term%` with LIKE wildcards in the term escaped, so "50%" matches literally. */
export function containsPattern(query: string): string {
  return `%${query.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Reuses the editorial summary selects so search results carry the same fields as the lists. */
export function createDrizzleEditorialSearchReader(
  db: Database,
  options: { resolveMediaUrl: (value: string | null | undefined) => string | null },
): EditorialSearchReader {
  const { resolveMediaUrl } = options;
  return {
    async searchExhibitions(query) {
      const pattern = containsPattern(query);
      const rows = await selectExhibitionSummaries(db)
        .where(
          and(
            eq(shopEditorialExhibition.status, "published"),
            or(
              ilike(shopEditorialExhibition.title, pattern),
              ilike(shopEditorialExhibition.summary, pattern),
            ),
          ),
        )
        .orderBy(desc(shopEditorialExhibition.startsOn), desc(shopEditorialExhibition.createdAt))
        .limit(EDITORIAL_SEARCH_LIMIT);
      return rows.map((row) => toExhibitionSummary(row, resolveMediaUrl));
    },

    async searchStories(query, kind) {
      const pattern = containsPattern(query);
      const rows = await selectStorySummaries(db)
        .where(
          and(
            eq(shopEditorialStory.status, "published"),
            kind ? eq(shopEditorialStory.kind, kind) : undefined,
            or(
              ilike(shopEditorialStory.title, pattern),
              ilike(shopEditorialStory.standfirst, pattern),
            ),
          ),
        )
        .orderBy(desc(shopEditorialStory.publishedAt), desc(shopEditorialStory.createdAt))
        .limit(EDITORIAL_SEARCH_LIMIT);
      return rows.map((row) => ({
        ...toStorySummary(row, resolveMediaUrl),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
  };
}
