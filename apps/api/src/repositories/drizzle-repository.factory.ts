import type { Database } from "@auction/db";
import type { IRepositoryFactory, LotBidRepos } from "../services/interfaces/repository-factory.js";
import { DrizzleBidRepository } from "./drizzle-bid.repository.js";
import { DrizzleLotRepository } from "./drizzle-lot.repository.js";

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

  runInTransaction<T>(fn: (repos: LotBidRepos) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(this.forConnection(tx)));
  }
}
