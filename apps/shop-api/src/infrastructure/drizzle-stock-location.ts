import type { Database } from "@auction/db";
import { artworkRegister } from "@auction/db/schema";
import type { IStockLocationStore } from "@auction/persistence/interfaces";
import { eq } from "drizzle-orm";
import type {
  StockLocationReads,
  StockLocationWritesFor,
} from "../application/ports/stock-location.ports.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

/** The persistence store on a connection or transaction; the container supplies it. */
export type StockLocationStoreOn = (session: Database) => IStockLocationStore;

/** Reads outside any unit of work. */
export function createDrizzleStockLocationReads(
  db: Database,
  storeOn: StockLocationStoreOn,
): StockLocationReads {
  const store = storeOn(db);
  return {
    listLocations: (options) => store.listLocations(options),
    artworkMoves: (registerId, limit) =>
      db.transaction(
        async (tx) => {
          const [row] = await tx
            .select({ id: artworkRegister.id })
            .from(artworkRegister)
            .where(eq(artworkRegister.id, registerId))
            .limit(1);
          if (!row) return null;
          return storeOn(tx).listMoves(registerId, limit);
        },
        // One snapshot for both reads, taken by the first; read only, so it holds no locks.
        { isolationLevel: "repeatable read", accessMode: "read only" },
      ),
  };
}

/**
 * The store on the unit of work's transaction. Its own `transaction` calls become savepoints, so
 * the change, its history and its events commit with the audit row and the idempotency record.
 */
export const createDrizzleStockLocationWritesFor =
  (storeOn: StockLocationStoreOn): StockLocationWritesFor =>
  (tx) =>
    storeOn(shopPhaseDbSession(tx));
