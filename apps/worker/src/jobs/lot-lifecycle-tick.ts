import type pino from "pino";

export async function runLotLifecycleTickJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const base = opts.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/internal/jobs/lot-lifecycle-tick`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": opts.cronSecret,
    },
    body: "{}",
  });
  if (res.status === 503) {
    opts.log.warn({ url }, "lot lifecycle tick skipped (API reports cron_not_configured)");
    return;
  }
  if (res.status === 409) {
    return;
  }
  if (!res.ok) {
    const text = await res.text();
    opts.log.error({ status: res.status, body: text }, "lot lifecycle tick request failed");
    throw new Error(`lot_lifecycle_tick_failed:${res.status}`);
  }
}
