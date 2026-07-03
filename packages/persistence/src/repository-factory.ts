import type { Database } from "@auction/db";
import type {
  IBidRepository,
  IItemSubmissionRepository,
  ILotRepository,
  ISaleRepository,
} from "./interfaces/index.js";

export type LotBidRepos = {
  lot: ILotRepository;
  bid: IBidRepository;
};

export type TransactionRepos = LotBidRepos & {
  sale: ISaleRepository;
  itemSubmission: IItemSubmissionRepository;
};

/** Provides repositories for a DB connection (pool or transaction) so BidService stays on interfaces (DIP).
 */
export interface IRepositoryFactory {
  /** Repositories bound to the root pool (read paths, non-transactional). */
  readonly root: LotBidRepos;
  /** Repositories for a specific connection (including transaction scope). */
  forConnection(db: Database): LotBidRepos;
  /** Lot, bid, sale, and item-submission repos scoped to a connection (typically a transaction). */
  forTransaction(db: Database): TransactionRepos;
  runInTransaction<T>(fn: (repos: LotBidRepos, tx: Database) => Promise<T>): Promise<T>;
}
