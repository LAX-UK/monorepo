import type { Database } from "@auction/db";
import type { DbTransaction } from "./interfaces/artist-delete.repository.js";

/**
 * Minimal transaction boundary port (DIP). Services that only need "run this
 * work inside one DB transaction" depend on this instead of holding a raw
 * `Database`. Repositories are bound to the provided `tx` at the call site
 * (via each repo's connection-scoped constructor or a scoped-repo helper).
 */
export interface ITransactionRunner {
  runInTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T>;
}

export class DrizzleTransactionRunner implements ITransactionRunner {
  constructor(private readonly db: Database) {}

  runInTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => fn(tx));
  }
}
