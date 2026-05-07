import type pino from "pino";

/** calls API internal cron to create a Xero supplier bill for a paid payout.
 * Idempotent; safe to retry.
 */
export async function syncXeroPayoutBillViaApi(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  payoutId: string;
  log: pino.Logger;
}): Promise<boolean> {
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
    return true;
  }
  if (!res.ok) {
    const text = await res.text();
    opts.log.error(
      { status: res.status, body: text, payoutId: opts.payoutId },
      "xero payout bill request failed",
    );
    return false;
  }
  return true;
}
