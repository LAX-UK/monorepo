import type { Database } from "@auction/db";
import type {
  AuctionBidRepos,
  IRepositoryFactory,
} from "../services/interfaces/repository-factory.js";
import { DrizzleAuctionRepository } from "./drizzle-auction.repository.js";
import { DrizzleBidRepository } from "./drizzle-bid.repository.js";

export class DrizzleRepositoryFactory implements IRepositoryFactory {
  readonly root: AuctionBidRepos;

  constructor(private readonly db: Database) {
    this.root = this.forConnection(db);
  }

  forConnection(conn: Database): AuctionBidRepos {
    return {
      auction: new DrizzleAuctionRepository(conn),
      bid: new DrizzleBidRepository(conn),
    };
  }

  runInTransaction<T>(fn: (repos: AuctionBidRepos) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(this.forConnection(tx)));
  }
}
