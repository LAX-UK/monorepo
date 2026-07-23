import type { FinanceCronDispatchContext } from "../finance/finance-cron-dispatch.js";

export async function runBulkPayoutSettlementJob(opts: {
  financeCron: FinanceCronDispatchContext;
}): Promise<void> {
  const workerOwns =
    opts.financeCron.env.FINANCE_CRON_EXECUTION_OWNER === "worker" &&
    !opts.financeCron.env.FINANCE_CRON_API_ROLLBACK &&
    opts.financeCron.handlers != null;

  if (workerOwns) {
    const outcome = await opts.financeCron.handlers?.runBulkPayoutSettlement();
    if (
      outcome &&
      typeof outcome === "object" &&
      "deferred" in outcome &&
      (outcome as { deferred?: boolean }).deferred
    ) {
      opts.financeCron.log.warn(
        { reason: (outcome as { reason?: string }).reason ?? "settlement_already_running" },
        "bulk_payout_settlement_deferred",
      );
    }
    return;
  }

  const post = await import("./post-internal-cron-job.js").then((m) =>
    m.postInternalCronJob({
      apiBaseUrl: opts.financeCron.env.API_INTERNAL_BASE_URL,
      cronSecret: opts.financeCron.cronSecret,
      log: opts.financeCron.log,
      path: "bulk-payout-settlement",
      treat409AsSuccess: true,
    }),
  );
  if (post.outcome === "deferred") {
    opts.financeCron.log.warn({ reason: post.reason }, "bulk_payout_settlement_deferred");
  }
}
