import type { Database } from "@auction/db";
import { artworkRegister, shopParty } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import type {
  ArtworkConsignorReads,
  ArtworkConsignorWritesFor,
} from "../application/ports/artwork-consignor.ports.js";
import type { ConsignorAgreementStoreOn } from "./drizzle-consignor-agreement.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

/** Reads for the Consignor field on a From Zoho record, outside any unit of work. */
export function createDrizzleArtworkConsignorReads(
  db: Database,
  storeOn: ConsignorAgreementStoreOn,
): ArtworkConsignorReads {
  const store = storeOn(db);
  return {
    async artworkExists(registerId) {
      const [row] = await db
        .select({ id: artworkRegister.id })
        .from(artworkRegister)
        .where(eq(artworkRegister.id, registerId))
        .limit(1);
      return row !== undefined;
    },
    listChanges: (registerId, limit) => store.listConsignorChanges(registerId, limit),
    async partyNames(partyIds) {
      if (partyIds.length === 0) return new Map();
      const rows = await db
        .select({ id: shopParty.id, name: shopParty.displayName })
        .from(shopParty)
        .where(inArray(shopParty.id, [...partyIds]));
      return new Map(rows.map((row) => [row.id, row.name]));
    },
    async currentAgreements(partyId) {
      const agreements = await store.listAgreements(partyId);
      return agreements.filter((agreement) => agreement.status === "current");
    },
  };
}

/**
 * The store on the unit of work's transaction. Its own `transaction` call becomes a savepoint, so
 * the consignor change commits with the audit row and the idempotency record.
 */
export const createDrizzleArtworkConsignorWritesFor =
  (storeOn: ConsignorAgreementStoreOn): ArtworkConsignorWritesFor =>
  (tx) =>
    storeOn(shopPhaseDbSession(tx));
