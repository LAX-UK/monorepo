import { Sentry } from "@auction/observability";

export function loadSentryMonitorSlugs(): Record<string, string> {
  const raw = process.env.SENTRY_MONITOR_SLUGS;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function withSentryCronMonitor(
  slugKey: string,
  monitorSlugs: Record<string, string>,
  fn: () => Promise<void>,
): Promise<void> {
  const slug = monitorSlugs[slugKey];
  // Without a DSN Sentry is not running, so there is nothing to check in with.
  if (!slug || !process.env.SENTRY_DSN_WORKER) {
    await fn();
    return;
  }
  await Sentry.withMonitor(slug, fn);
}

/**
 * A cron monitor for work that runs far more often than a monitor should be told (every couple
 * of seconds): it checks in at most once per `everyMs`, and the runs between pass straight through.
 * A missed check-in then means the work stopped running, which is what the monitor watches for.
 */
export function throttledCronMonitor(
  slugKey: string,
  monitorSlugs: Record<string, string>,
  everyMs: number,
  now: () => number = Date.now,
): (fn: () => Promise<void>) => Promise<void> {
  let last = Number.NEGATIVE_INFINITY;
  return async (fn) => {
    if (now() - last < everyMs) {
      await fn();
      return;
    }
    last = now();
    await withSentryCronMonitor(slugKey, monitorSlugs, fn);
  };
}
