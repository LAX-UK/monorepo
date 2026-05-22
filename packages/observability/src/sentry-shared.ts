import type { ErrorEvent, EventHint, SamplingContext } from "@sentry/core";

/** Strip auth headers and webhook bodies before events leave the process. */
export function scrubSentryEvent<T extends ErrorEvent>(event: T, _hint?: EventHint): T {
  if (event.request?.headers && "authorization" in event.request.headers) {
    const { authorization: _auth, ...headers } = event.request.headers;
    event.request.headers = headers;
  }
  if (event.request?.url?.includes("/webhooks/") && event.request.data !== undefined) {
    const { data: _body, ...requestWithoutBody } = event.request;
    event.request = requestWithoutBody;
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
