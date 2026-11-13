import type { PayoutTransferTransactions } from "./connect-transfer-initiation.service.js";

/**
 * A transaction for unit tests of the transfer step: it runs the work at once and reads the
 * payout "under lock" through the fake repository's own `findById`.
 */
export function inlinePayoutTransactions(): PayoutTransferTransactions {
  return {
    runner: { runInTransaction: (fn) => fn({} as never) },
    payoutRepoForTx: (root) => ({
      ...root,
      findByIdForUpdate: root.findByIdForUpdate ?? root.findById,
    }),
  };
}
