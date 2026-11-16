import type { FinanceCronInternalJobPath } from "@auction/finance-cron-app";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import {
  type FinanceCronDispatchContext,
  dispatchFinanceCronJob,
} from "../finance/finance-cron-dispatch.js";
import { DEFAULT_GATEWAY_RETRY, type GatewayRetry } from "./post-internal-cron-job.js";

type JobOpts = {
  env: WorkerEnv;
  cronSecret: string;
  log: pino.Logger;
  financeCron: FinanceCronDispatchContext;
};

async function runFinanceCronPath(
  path: FinanceCronInternalJobPath,
  opts: JobOpts,
  options?: {
    treat409AsSuccess?: boolean;
    body?: Record<string, unknown>;
    gatewayRetry?: GatewayRetry;
  },
): Promise<void> {
  await dispatchFinanceCronJob(opts.financeCron, path, options);
}

export async function runExpireStalePaymentsJob(opts: JobOpts): Promise<void> {
  // Each invoice is re-read before it is touched, cancelled only while unpaid, and money found
  // paid is recorded once, so a repeat or an overlap with the first request changes nothing more.
  await runFinanceCronPath("expire-stale-payments", opts, { gatewayRetry: DEFAULT_GATEWAY_RETRY });
}

export async function runRetryXeroWebhookFailuresJob(opts: JobOpts): Promise<void> {
  // Replaying an event only reads the invoice from Xero and sets the same payment id and the
  // same processed mark, so a repeat, or an overlap with the first request, changes nothing more.
  await runFinanceCronPath("retry-xero-webhook-failures", opts, {
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
}

export async function runRetryXeroStripeCaptureSyncJob(opts: JobOpts): Promise<void> {
  // A capture already recorded in Xero is skipped, and the payment call carries a per-payment
  // idempotency key, so asking again cannot record a payment twice.
  await runFinanceCronPath("retry-xero-stripe-capture-sync", opts, {
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
}

export async function runRetryXeroInvoiceCreationJob(opts: JobOpts): Promise<void> {
  // A payment that already has a Xero invoice is skipped, and the invoice call carries a
  // per-payment idempotency key, so Xero returns the same invoice if an overlapping request
  // reaches it twice. It never creates a second invoice.
  await runFinanceCronPath("retry-xero-invoice-creation", opts, {
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
}

export async function runRetryRefundReconcilesJob(opts: JobOpts): Promise<void> {
  // Each refund is applied under a lock on the payment, only while it is still captured, and its
  // ledger line is keyed per payment, so an overlap waits, finds it done, and records nothing more.
  await runFinanceCronPath("retry-refund-reconciles", opts, {
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
}

export async function runRefreshXeroTokensJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("refresh-xero-tokens", opts);
}

export async function runProcessNotificationOutboxJob(opts: JobOpts): Promise<void> {
  // Rows are claimed with FOR UPDATE SKIP LOCKED and a claim is only released after ten minutes,
  // so a repeat, or an overlap with the first request, takes different rows and never
  // dispatches a notification twice.
  await runFinanceCronPath("process-notification-outbox", opts, {
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
}

export async function runEnsureLotInvoicesJob(opts: JobOpts): Promise<void> {
  // Creating a lot's invoice is idempotent, so a briefly unavailable API is asked again.
  await runFinanceCronPath("ensure-lot-invoices", opts, { gatewayRetry: DEFAULT_GATEWAY_RETRY });
}

/** The outbox drain claims this many rows per call (see LifecycleCronService). */
const NOTIFICATION_OUTBOX_BATCH_SIZE = 50;
/** One wake drains at most this many batches, then leaves the rest to the next wake or sweep. */
export const NOTIFICATION_OUTBOX_WAKE_MAX_BATCHES = 10;

function isFullOutboxBatch(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const { processed, failed } = result as { processed?: unknown; failed?: unknown };
  if (typeof processed !== "number" || typeof failed !== "number") return false;
  return processed + failed >= NOTIFICATION_OUTBOX_BATCH_SIZE;
}

/**
 * Drain run on demand when a time-critical notification is committed. It goes through the same
 * drain as the minute sweep, so claiming, retries and the dedupe key behave exactly the same.
 * Where the worker drains locally it keeps going while batches come back full (a lot closing with
 * many bidders), bounded so one wake cannot hold the queue. Through the API it drains one batch and
 * does not retry on a gateway error: the follow-up wake and the minute sweep are the retry.
 */
export async function runProcessNotificationOutboxWakeJob(opts: JobOpts): Promise<void> {
  const { env, handlers } = opts.financeCron;
  const workerDrainsLocally =
    env.FINANCE_CRON_EXECUTION_OWNER === "worker" && !env.FINANCE_CRON_API_ROLLBACK && handlers;
  if (!workerDrainsLocally) {
    await runFinanceCronPath("process-notification-outbox", opts);
    return;
  }
  for (let batch = 0; batch < NOTIFICATION_OUTBOX_WAKE_MAX_BATCHES; batch++) {
    const result = await handlers.processNotificationOutbox();
    if (!isFullOutboxBatch(result)) return;
  }
}
