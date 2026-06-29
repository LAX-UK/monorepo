import type { Database } from "@auction/db";
import type {
  IRepositoryFactory,
  LotBidRepos,
  TransactionRepos,
} from "../services/interfaces/repository-factory.js";
import { DrizzleBidRepository } from "./drizzle-bid.repository.js";
import { DrizzleItemSubmissionRepository } from "./drizzle-item-submission.repository.js";
import { DrizzleLotRepository } from "./drizzle-lot.repository.js";
import { DrizzleSaleRepository } from "./drizzle-sale.repository.js";

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
