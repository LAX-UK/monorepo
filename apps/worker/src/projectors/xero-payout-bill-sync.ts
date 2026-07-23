import type pino from "pino";

export type XeroPayoutBillSyncOutcome =
  | { kind: "success" }
  | { kind: "terminal_skip"; reason: "disabled_or_not_configured" }
  | { kind: "retryable_failure"; status: number; body: string };

/** Calls API internal cron to create a Xero supplier bill for a paid payout. Idempotent; safe to retry. */
export async function syncXeroPayoutBillViaApi(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  payoutId: string;
  log: pino.Logger;
}): Promise<XeroPayoutBillSyncOutcome> {
  const base = opts.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/internal/jobs/xero-payout-bill`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": opts.cronSecret,
    },
    body: JSON.stringify({ payoutId: opts.payoutId }),
  });
  if (res.status === 503) {
    const text = await res.text();
    opts.log.warn(
      { url, body: text },
      "xero payout bill skipped (API disabled or cron not configured)",
    );
    return { kind: "terminal_skip", reason: "disabled_or_not_configured" };
  }
  if (!res.ok) {
    const text = await res.text();
    opts.log.error(
      { status: res.status, body: text, payoutId: opts.payoutId },
      "xero payout bill request failed",
    );
    return { kind: "retryable_failure", status: res.status, body: text };
  }
  return { kind: "success" };
}
