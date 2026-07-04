import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";

/** Wraps a test `Database` as `ITransactionRunner` for service unit tests. */
export function transactionRunnerFromDb(db: Database): ITransactionRunner {
  return {
    runInTransaction: (fn) => db.transaction(fn),
  };
}
