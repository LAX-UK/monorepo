import {
  type FinanceCronDispatchContext,
  dispatchFinanceCronJob,
} from "../finance/finance-cron-dispatch.js";

export async function runCleanupDisplayPairingsJob(opts: {
  financeCron: FinanceCronDispatchContext;
}): Promise<void> {
  await dispatchFinanceCronJob(opts.financeCron, "cleanup-display-pairings");
}
