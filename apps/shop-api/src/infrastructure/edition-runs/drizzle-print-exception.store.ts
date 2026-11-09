import type { Database } from "@auction/db";
import { shopPrintException } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { PrintExceptionStore } from "../../application/edition-runs/edition-run.ports.js";
import { exceptionFromColumns, exceptionToColumns } from "../print-exception-columns.js";

/** The record of a print sold apart from its run, and what differs about it. */
export function createDrizzlePrintExceptionStore(db: Database): PrintExceptionStore {
  return {
    async insert({ editionId, runArtworkId, listingArtworkId, differences, actorSubjectId }) {
      await db.insert(shopPrintException).values({
        editionId,
        runArtworkId,
        listingArtworkId,
        setApartBySubjectId: actorSubjectId,
        ...exceptionToColumns(differences),
      });
    },

    async openForListing(listingArtworkId) {
      const [row] = await db
        .select()
        .from(shopPrintException)
        .where(
          and(
            eq(shopPrintException.listingArtworkId, listingArtworkId),
            isNull(shopPrintException.returnedAt),
          ),
        )
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        editionId: row.editionId,
        runArtworkId: row.runArtworkId,
        listingArtworkId: row.listingArtworkId,
        differences: exceptionFromColumns(row),
        setApartBySubjectId: row.setApartBySubjectId,
        setApartAt: row.setApartAt,
      };
    },

    async markReturned(id, actorSubjectId) {
      await db
        .update(shopPrintException)
        .set({ returnedAt: new Date(), returnedBySubjectId: actorSubjectId })
        .where(eq(shopPrintException.id, id));
    },
  };
}
