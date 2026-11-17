import type { Database } from "@auction/db";
import { shopParty } from "@auction/db/schema";
import type { IConsignorAgreementStore } from "@auction/persistence/interfaces";
import { and, eq, ne } from "drizzle-orm";
import type {
  ConsignorAgreementReads,
  ConsignorAgreementWritesFor,
} from "../application/ports/consignor-agreement.ports.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

/** The persistence store on a connection or transaction; the container supplies it. */
export type ConsignorAgreementStoreOn = (session: Database) => IConsignorAgreementStore;

/** Reads outside any unit of work. */
export function createDrizzleConsignorAgreementReads(
  db: Database,
  storeOn: ConsignorAgreementStoreOn,
): ConsignorAgreementReads {
  const store = storeOn(db);
  return {
    async consignorParty(partyId) {
      const [row] = await db
        .select({ partyId: shopParty.id, displayName: shopParty.displayName })
        .from(shopParty)
        .where(and(eq(shopParty.id, partyId), ne(shopParty.kind, "lax")))
        .limit(1);
      return row ?? null;
    },
    listAgreements: (partyId) => store.listAgreements(partyId),
    listVersions: (agreementId) => store.listVersions(agreementId),
    findAgreementVersion: (id) => store.findAgreementVersion(id),
  };
}

/**
 * The store on the unit of work's transaction. Its own `transaction` calls become savepoints, so
 * the agreement change commits with the audit row and the idempotency record.
 */
export const createDrizzleConsignorAgreementWritesFor =
  (storeOn: ConsignorAgreementStoreOn): ConsignorAgreementWritesFor =>
  (tx) =>
    storeOn(shopPhaseDbSession(tx));
