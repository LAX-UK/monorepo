import type pino from "pino";

const DEFAULT_INTERNAL_CRON_TIMEOUT_MS = 120_000;

export type PostInternalCronJobResult =
  | { ok: true; outcome: "completed" }
  | { ok: true; outcome: "deferred"; reason: "settlement_already_running" | "resource_locked" }
  | { ok: true; outcome: "skipped"; reason: "cron_not_configured" };

/** POST to an API `/internal/jobs/*` endpoint guarded by `X-Cron-Secret`. */
export async function postInternalCronJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  path: string;
  log: pino.Logger;
  /** Optional JSON body (defaults to `{}`). */
  body?: Record<string, unknown>;
  /** When true, HTTP 409 is treated as deferred lock contention (not a hard failure). */
  treat409AsSuccess?: boolean;
  /** Abort the request after this many milliseconds (default 120s). */
  timeoutMs?: number;
}): Promise<PostInternalCronJobResult> {
  const base = opts.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/internal/jobs/${opts.path.replace(/^\//, "")}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_INTERNAL_CRON_TIMEOUT_MS;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cron-Secret": opts.cronSecret,
      },
      body: JSON.stringify(opts.body ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    opts.log.error({ url, timeoutMs, err: message }, `${opts.path} request timed out or failed`);
    throw new Error(`${opts.path.replace(/\//g, "_")}_failed:timeout`);
  }
  if (res.status === 503) {
    opts.log.warn({ url }, `${opts.path} skipped (API reports cron_not_configured)`);
    return { ok: true, outcome: "skipped", reason: "cron_not_configured" };
  }
  if (opts.treat409AsSuccess && res.status === 409) {
    const reason =
      opts.path === "bulk-payout-settlement"
        ? ("settlement_already_running" as const)
        : ("resource_locked" as const);
    opts.log.warn(
      { url, path: opts.path, status: res.status, reason },
      "internal_cron_deferred_lock_contention",
    );
    return { ok: true, outcome: "deferred", reason };
  }
  if (!res.ok) {
    const text = await res.text();
    opts.log.error({ status: res.status, body: text, url }, `${opts.path} request failed`);
    throw new Error(`${opts.path.replace(/\//g, "_")}_failed:${res.status}`);
  }
  return { ok: true, outcome: "completed" };
}
