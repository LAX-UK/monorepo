import type pino from "pino";
import { postInternalCronJob } from "../../jobs/post-internal-cron-job.js";
import { syncXeroPayoutBillViaApi } from "../../projectors/xero-payout-bill-sync.js";
import { XeroLiveExecutorError, type XeroLiveExecutorPorts } from "./xero-live-executor.js";

async function postXeroJob(
  opts: {
    apiBaseUrl: string;
    cronSecret: string;
    path: string;
    log: pino.Logger;
    body?: Record<string, unknown>;
  },
  retryableStatuses = new Set([502, 503, 504]),
): Promise<void> {
  const base = opts.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/internal/jobs/${opts.path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": opts.cronSecret,
    },
    body: JSON.stringify(opts.body ?? {}),
  });
  if (res.status === 503) {
    throw new XeroLiveExecutorError(`${opts.path}_disabled`, false);
  }
  if (!res.ok) {
    const text = await res.text();
    opts.log.error({ status: res.status, body: text, url }, `${opts.path} request failed`);
    throw new XeroLiveExecutorError(
      `${opts.path}_failed:${res.status}:${text}`,
      retryableStatuses.has(res.status),
    );
  }
}

export function createXeroLiveExecutorPorts(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): XeroLiveExecutorPorts {
  const base = {
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    log: opts.log,
  };

  return {
    recordStripeCapture: async (paymentId) => {
      await postXeroJob({
        ...base,
        path: "xero-record-stripe-capture",
        body: { paymentId },
      });
    },
    recordRefundCreditNote: async (paymentId) => {
      await postXeroJob({
        ...base,
        path: "xero-record-refund-credit-note",
        body: { paymentId },
      });
    },
    ensureLotInvoice: async (lotId) => {
      await postInternalCronJob({
        apiBaseUrl: opts.apiBaseUrl,
        cronSecret: opts.cronSecret,
        path: "ensure-lot-invoice",
        body: { lotId },
        log: opts.log,
      });
    },
    syncPayoutBill: async (payoutId) => {
      const outcome = await syncXeroPayoutBillViaApi({
        apiBaseUrl: opts.apiBaseUrl,
        cronSecret: opts.cronSecret,
        payoutId,
        log: opts.log,
      });
      if (outcome.kind === "retryable_failure") {
        throw new XeroLiveExecutorError(`xero_payout_bill_failed:${outcome.status}`, true);
      }
      if (outcome.kind === "terminal_skip") {
        opts.log.warn({ payoutId }, "xero_payout_bill_terminal_skip");
      }
    },
    acknowledgePayoutSettlement: async (payoutId) => {
      await postXeroJob({
        ...base,
        path: "xero-acknowledge-payout-settlement",
        body: { payoutId },
      });
    },
  };
}

export async function syncXeroInvoiceWebhookViaApi(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  tenantId: string;
  resourceId: string;
  eventKey: string;
  log: pino.Logger;
}): Promise<void> {
  await postXeroJob(
    {
      apiBaseUrl: opts.apiBaseUrl,
      cronSecret: opts.cronSecret,
      path: "xero-sync-invoice-webhook",
      log: opts.log,
      body: {
        tenantId: opts.tenantId,
        resourceId: opts.resourceId,
        eventKey: opts.eventKey,
      },
    },
    new Set([502, 503, 504, 429]),
  );
}
