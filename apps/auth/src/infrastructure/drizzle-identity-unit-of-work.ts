import type { IdentityDatabase } from "@auction/identity-db";
import type {
  IIdentityUnitOfWork,
  IdentityOperationTransaction,
} from "../services/identity-operations.ports.js";

export function identityOperationDb(
  db: IdentityDatabase,
  transaction: IdentityOperationTransaction | null,
): IdentityDatabase {
  return (transaction ?? db) as IdentityDatabase;
}

export class DrizzleIdentityUnitOfWork implements IIdentityUnitOfWork {
  constructor(private readonly db: IdentityDatabase) {}

  transaction(
    operation: (transaction: IdentityOperationTransaction) => Promise<void>,
  ): Promise<void> {
    return this.db.transaction(operation);
  }
}
