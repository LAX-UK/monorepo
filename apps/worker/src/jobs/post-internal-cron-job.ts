import type pino from "pino";

const DEFAULT_INTERNAL_CRON_TIMEOUT_MS = 120_000;

/** The proxy answers 502 or 504 while no API pod can take the request, for example mid-rollout. */
const GATEWAY_UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([502, 504]);

/** Wait a little and ask again, for jobs that are safe to repeat (see the job's own doc). */
export type GatewayRetry = { retries: number; delayMs: number };

export const DEFAULT_GATEWAY_RETRY: GatewayRetry = { retries: 2, delayMs: 15_000 };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  /**
   * Repeat the request when the proxy has no API pod to send it to (502 or 504). Only for
   * idempotent jobs; the next scheduled run repeats them anyway, so this just avoids a failed
   * run during a rollout. Omit for jobs that must not run twice.
   */
  gatewayRetry?: GatewayRetry;
  /** Replaceable in tests. */
  wait?: (ms: number) => Promise<void>;
}): Promise<PostInternalCronJobResult> {
  const base = opts.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/internal/jobs/${opts.path.replace(/^\//, "")}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_INTERNAL_CRON_TIMEOUT_MS;
  const wait = opts.wait ?? sleep;
  const retry = opts.gatewayRetry ?? { retries: 0, delayMs: 0 };
  const send = async (): Promise<Response> => {
    try {
      return await fetch(url, {
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
  };
  let res = await send();
  for (
    let attempt = 1;
    attempt <= retry.retries && GATEWAY_UNAVAILABLE_STATUSES.has(res.status);
    attempt++
  ) {
    opts.log.warn(
      { url, status: res.status, attempt, delayMs: retry.delayMs },
      "internal_cron_gateway_unavailable_retrying",
    );
    await wait(retry.delayMs);
    res = await send();
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
