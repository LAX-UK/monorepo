import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopClientAssignment,
  shopEdition,
  shopParty,
  shopUserProfile,
} from "@auction/db/schema";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { AdminLookupReader } from "../application/ports/admin-readers.js";
import { containsPattern } from "./drizzle-editorial-search.reader.js";
import { printedEditionNumber } from "./printed-edition-number.js";

/**
 * Small, name-first searches behind the staff pickers. Each returns one bounded page of the best
 * matches; an empty search returns the most recent records so a picker is never blank.
 */
export function createDrizzleAdminLookupReader(db: Database): AdminLookupReader {
  return {
    async searchParties(input) {
      const q = input.q?.trim();
      const pattern = q ? containsPattern(q) : null;
      const rows = await db
        .select({
          partyId: shopParty.id,
          displayName: shopParty.displayName,
          kind: shopParty.kind,
          email: shopUserProfile.email,
        })
        .from(shopParty)
        .leftJoin(
          shopUserProfile,
          eq(shopUserProfile.identitySubjectId, shopParty.identitySubjectId),
        )
        .where(
          and(
            inArray(shopParty.kind, ["person", "gallery"]),
            input.brokerSubjectId
              ? inArray(
                  shopParty.id,
                  db
                    .select({ id: shopClientAssignment.clientPartyId })
                    .from(shopClientAssignment)
                    .where(eq(shopClientAssignment.brokerSubjectId, input.brokerSubjectId)),
                )
              : undefined,
            pattern
              ? or(
                  sql`${shopParty.displayName} ILIKE ${pattern}`,
                  sql`${shopUserProfile.email} ILIKE ${pattern}`,
                )
              : undefined,
          ),
        )
        .orderBy(asc(shopParty.displayName), asc(shopParty.id))
        .limit(input.limit);
      return rows.map((row) => ({
        partyId: row.partyId,
        displayName: row.displayName,
        kind: row.kind,
        email: row.email ?? null,
      }));
    },

    async searchArtworks(input) {
      const q = input.q?.trim();
      const pattern = q ? containsPattern(q) : null;
      const rows = await db
        .select({
          artworkId: shopArtwork.id,
          title: shopArtwork.title,
          artistName: shopParty.displayName,
        })
        .from(shopArtwork)
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(
            isNull(shopArtwork.archivedAt),
            pattern
              ? or(
                  sql`${shopArtwork.title} ILIKE ${pattern}`,
                  sql`${shopParty.displayName} ILIKE ${pattern}`,
                )
              : undefined,
          ),
        )
        .orderBy(desc(shopArtwork.createdAt), asc(shopArtwork.id))
        .limit(input.limit);
      return rows;
    },

    async searchEditions(input) {
      const q = input.q?.trim();
      const pattern = q ? containsPattern(q) : null;
      const rows = await db
        .select({
          editionId: shopEdition.id,
          artworkId: shopArtwork.id,
          artworkTitle: shopArtwork.title,
          artistName: shopParty.displayName,
          editionNumber: printedEditionNumber,
          listingStatus: shopEdition.listingStatus,
        })
        .from(shopEdition)
        .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(
            isNull(shopArtwork.archivedAt),
            pattern
              ? or(
                  sql`${shopArtwork.title} ILIKE ${pattern}`,
                  sql`${shopParty.displayName} ILIKE ${pattern}`,
                )
              : undefined,
          ),
        )
        .orderBy(asc(shopArtwork.title), asc(shopEdition.editionNumber), asc(shopEdition.id))
        .limit(input.limit);
      return rows;
    },
  };
}
