import type { Database } from "@auction/db";
import type { IAuctionRepository, IBidRepository } from "./repositories.js";

export type AuctionBidRepos = {
  auction: IAuctionRepository;
  bid: IBidRepository;
};

/**
 * Provides repositories for a DB connection (pool or transaction) so BidService stays on interfaces (DIP).
 */
export interface IRepositoryFactory {
  /** Repositories bound to the root pool (read paths, non-transactional). */
  readonly root: AuctionBidRepos;
  /** Repositories for a specific connection (including transaction scope). */
  forConnection(db: Database): AuctionBidRepos;
  runInTransaction<T>(fn: (repos: AuctionBidRepos) => Promise<T>): Promise<T>;
}
