import type { Database } from "@auction/db";
import type { IBidRepository, ILotRepository } from "./repositories.js";

export type LotBidRepos = {
  lot: ILotRepository;
  bid: IBidRepository;
};

/** Provides repositories for a DB connection (pool or transaction) so BidService stays on interfaces (DIP).
 */
export interface IRepositoryFactory {
  /** Repositories bound to the root pool (read paths, non-transactional). */
  readonly root: LotBidRepos;
  /** Repositories for a specific connection (including transaction scope). */
  forConnection(db: Database): LotBidRepos;
  runInTransaction<T>(fn: (repos: LotBidRepos, tx: Database) => Promise<T>): Promise<T>;
}
