import type { Database } from "@auction/db";
import { artworkRegister } from "@auction/db/schema";
import { DrizzleStockLocationStore } from "@auction/persistence/repositories";
import { eq } from "drizzle-orm";
import type {
  StockLocationReads,
  StockLocationWriteResult,
  StockLocationWrites,
  StockLocationWritesFor,
} from "../application/ports/stock-location.ports.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

/** Carries a refused add out of its savepoint, so the savepoint rolls back and the result survives. */
class AddRefused extends Error {
  constructor(readonly result: StockLocationWriteResult) {
    super("artwork_location add refused");
  }
}

/** Reads outside any unit of work. */
export function createDrizzleStockLocationReads(db: Database): StockLocationReads {
  const store = new DrizzleStockLocationStore(db);
  return {
    listLocations: (options) => store.listLocations(options),
    currentLocation: (registerId) => store.currentLocation(registerId),
    listMoves: (registerId, limit) => store.listMoves(registerId, limit),
    async registerExists(registerId) {
      const [row] = await db
        .select({ id: artworkRegister.id })
        .from(artworkRegister)
        .where(eq(artworkRegister.id, registerId))
        .limit(1);
      return row !== undefined;
    },
  };
}

/**
 * The store on the unit of work's transaction. Its own `transaction` calls become savepoints, so
 * the change, its history and its events commit with the audit row and the idempotency record.
 */
export const drizzleStockLocationWritesFor: StockLocationWritesFor = (tx) => {
  const session = shopPhaseDbSession(tx);
  const store = new DrizzleStockLocationStore(session);
  const writes: StockLocationWrites = {
    findLocation: (id) => store.findLocation(id),
    async addLocation(input) {
      // The store answers a taken name by catching the unique violation, which would leave the
      // unit of work's transaction aborted. A savepoint keeps it usable.
      try {
        return await session.transaction(async (savepoint) => {
          const result = await new DrizzleStockLocationStore(savepoint).addLocation(input);
          if (!result.ok) throw new AddRefused(result);
          return result;
        });
      } catch (error) {
        if (error instanceof AddRefused) return error.result;
        throw error;
      }
    },
    updateLocation: (input) => store.updateLocation(input),
    setLocationStatus: (input) => store.setLocationStatus(input),
    moveArtworks: (input) => store.moveArtworks(input),
  };
  return writes;
};
