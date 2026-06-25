import type pino from "pino";

/** POST to an API `/internal/jobs/*` endpoint guarded by `X-Cron-Secret`. */
export async function postInternalCronJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  path: string;
  log: pino.Logger;
  /** Optional JSON body (defaults to `{}`). */
  body?: Record<string, unknown>;
  /** When true, HTTP 409 is treated as success (e.g. distributed lock already held). */
  treat409AsSuccess?: boolean;
}): Promise<void> {
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
    opts.log.warn({ url }, `${opts.path} skipped (API reports cron_not_configured)`);
    return;
  }
  if (opts.treat409AsSuccess && res.status === 409) {
    return;
  }
  if (!res.ok) {
    const text = await res.text();
    opts.log.error({ status: res.status, body: text, url }, `${opts.path} request failed`);
    throw new Error(`${opts.path.replace(/\//g, "_")}_failed:${res.status}`);
  }
}
