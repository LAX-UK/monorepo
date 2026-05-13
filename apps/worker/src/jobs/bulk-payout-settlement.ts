import type pino from "pino";

export async function runBulkPayoutSettlementJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const base = opts.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/internal/jobs/bulk-payout-settlement`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": opts.cronSecret,
    },
    body: "{}",
  });
  if (res.status === 503) {
    opts.log.warn({ url }, "bulk payout settlement skipped (API reports cron_not_configured)");
    return;
  }
  if (!res.ok) {
    const text = await res.text();
    opts.log.error({ status: res.status, body: text }, "bulk payout settlement request failed");
    throw new Error(`bulk_payout_settlement_failed:${res.status}`);
  }
  const json = (await res.json()) as { data?: unknown };
  opts.log.info({ result: json.data }, "bulk payout settlement completed");
}
