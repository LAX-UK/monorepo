import type { ErrorEvent, EventHint, SamplingContext, TransactionEvent } from "@sentry/core";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-cron-secret",
]);

const BODY_SCRUB_PATHS = ["/webhooks/", "/internal/jobs"];

function scrubRequestHeaders(headers: Record<string, string>): Record<string, string> {
  const scrubbed: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) continue;
    scrubbed[key] = value;
  }
  return scrubbed;
}

function shouldScrubBody(url: string | undefined): boolean {
  if (!url) return false;
  return BODY_SCRUB_PATHS.some((segment) => url.includes(segment));
}

/** Strip sensitive headers and webhook/cron bodies before events leave the process. */
export function scrubSentryEvent<T extends ErrorEvent>(event: T, _hint?: EventHint): T {
  if (event.request?.headers) {
    event.request.headers = scrubRequestHeaders(event.request.headers as Record<string, string>);
  }
  if (shouldScrubBody(event.request?.url) && event.request?.data !== undefined) {
    const { data: _body, ...requestWithoutBody } = event.request;
    event.request = requestWithoutBody;
  }
  return event;
}

/** Mirror header scrubbing on performance transactions. */
export function scrubSentryTransaction(event: TransactionEvent): TransactionEvent {
  if (event.request?.headers) {
    event.request.headers = scrubRequestHeaders(event.request.headers as Record<string, string>);
  }
  return event;
}

/** Always sample money-path transactions; otherwise use configured default. */
export function sentryTracesSampler(ctx: SamplingContext, defaultRate: number): number {
  const name = ctx.transactionContext?.name ?? "";
  if (name.includes("/webhooks/stripe/") || name.startsWith("POST /payout/")) {
    return 1;
  }
  return defaultRate;
}

export function readSampleRate(envValue: string | undefined, fallback: number): number {
  if (envValue === undefined || envValue === "") return fallback;
  const parsed = Number(envValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveSentryEnvironment(appEnv?: string, nodeEnv?: string): string {
  return appEnv ?? nodeEnv ?? "development";
}
