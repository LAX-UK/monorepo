/**
 * Transaction boundary port for services that must run work inside a single DB transaction.
 * Implemented by {@link DrizzleRepositoryFactory} in the container; consumed today by BidService
 * and available for incremental adoption by other services (T1.4 backlog).
 */
export type { IRepositoryFactory as IUnitOfWork, LotBidRepos, TransactionRepos } from "@auction/persistence/interfaces";
