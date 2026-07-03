import type { Database } from "@auction/db";
import {
  DrizzleBidRepository,
  DrizzleItemSubmissionRepository,
  DrizzleLotRepository,
  DrizzleSaleRepository,
} from "./repositories/index.js";
import type { IRepositoryFactory, LotBidRepos, TransactionRepos } from "./repository-factory.js";

export class DrizzleRepositoryFactory implements IRepositoryFactory {
  readonly root: LotBidRepos;

  constructor(private readonly db: Database) {
    this.root = this.forConnection(db);
  }

  forConnection(conn: Database): LotBidRepos {
    return {
      lot: new DrizzleLotRepository(conn),
      bid: new DrizzleBidRepository(conn),
    };
  }

  forTransaction(conn: Database): TransactionRepos {
    return {
      ...this.forConnection(conn),
      sale: new DrizzleSaleRepository(conn),
      itemSubmission: new DrizzleItemSubmissionRepository(conn),
    };
  }

  runInTransaction<T>(fn: (repos: LotBidRepos, tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(this.forConnection(tx), tx));
  }
}
