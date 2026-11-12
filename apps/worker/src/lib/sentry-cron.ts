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
