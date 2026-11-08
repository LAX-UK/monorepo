import type { Database } from "@auction/db";
import { shopArtwork, shopEdition } from "@auction/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PrintGroupFacts, PrintGroupFactsReader } from "./print-group-facts.js";

const EDITION_TYPE: Record<string, PrintGroupFacts["editionType"]> = {
  limited: "Numbered",
  open: "Open",
};

/**
 * Reads a prints listing from Shop's tables through the column grants the worker holds for this
 * and nothing else: the listing, its original, and a count of its prints by who owns them.
 */
export function createDrizzlePrintGroupFactsReader(db: Database): PrintGroupFactsReader {
  const original = alias(shopArtwork, "original");

  return {
    async read(printsArtworkId) {
      const [row] = await db
        .select({
          title: shopArtwork.title,
          medium: shopArtwork.medium,
          dimensions: shopArtwork.dimensions,
          year: shopArtwork.yearCreated,
          runKind: shopArtwork.runKind,
          runRole: shopArtwork.runRole,
          mainRunArtworkId: shopArtwork.mainRunArtworkId,
          originalId: shopArtwork.sourceOriginalArtworkId,
          originalZohoProductId: original.zohoProductId,
        })
        .from(shopArtwork)
        .leftJoin(original, eq(original.id, shopArtwork.sourceOriginalArtworkId))
        .where(eq(shopArtwork.id, printsArtworkId))
        .limit(1);
      if (!row) return null;

      // Proofs are listed on their own and are not part of the numbered run.
      const counts = await db
        .select({
          allocation: shopEdition.allocation,
          prints: sql<number>`count(*)::int`,
        })
        .from(shopEdition)
        .where(and(eq(shopEdition.artworkId, printsArtworkId), isNull(shopEdition.proofNumber)))
        .groupBy(shopEdition.allocation);
      const held = (allocation: string) =>
        counts.find((entry) => entry.allocation === allocation)?.prints ?? 0;
      const collector = held("original_buyer_entitlement");
      const artist = held("artist");
      const lax = held("lax");

      return {
        printsArtworkId,
        isMainRun:
          row.mainRunArtworkId === null && row.runRole !== "proof" && row.runRole !== "companion",
        title: row.title,
        medium: row.medium,
        dimensions: row.dimensions,
        year: row.year,
        original: row.originalId
          ? { artworkId: row.originalId, zohoProductId: row.originalZohoProductId ?? null }
          : null,
        editionType: row.runKind ? (EDITION_TYPE[row.runKind] ?? null) : null,
        total: collector + artist + lax,
        collector,
        artist,
        lax,
      };
    },
  };
}
