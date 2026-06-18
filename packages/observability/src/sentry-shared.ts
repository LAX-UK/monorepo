import type { ErrorEvent, EventHint, SamplingContext, TransactionEvent } from "@sentry/core";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-cron-secret",
]);

const BODY_SCRUB_PATHS = ["/webhooks/", "/internal/jobs"];

const AUTH_USER_ERROR_PATTERNS = [
  /Invalid password/i,
  /User not found/i,
  /State mismatch/i,
  /state_mismatch/i,
] as const;

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

function messageFromExtraArguments(extra: ErrorEvent["extra"]): string {
  const args = extra?.arguments;
  if (!Array.isArray(args)) return "";

  let fallback = "";

  for (const arg of args) {
    if (typeof arg === "string") {
      if (arg.length > 0 && arg !== "[Filtered]") return arg;
      continue;
    }
    if (arg && typeof arg === "object") {
      const record = arg as Record<string, unknown>;
      if (record.code === "state_mismatch") return "State mismatch";
      if (typeof record.message === "string" && record.message.length > 0) {
        fallback = record.message;
      }
    }
  }

  return fallback;
}

function eventMessage(event: ErrorEvent): string {
  if (typeof event.message === "string" && event.message.length > 0) return event.message;
  if (event.logentry?.message) return event.logentry.message;

  const exceptionValue = event.exception?.values?.[0]?.value;
  if (typeof exceptionValue === "string" && exceptionValue.length > 0) return exceptionValue;

  return messageFromExtraArguments(event.extra);
}

function isConsoleLoggerEvent(event: ErrorEvent): boolean {
  if (event.logger === "console") return true;
  const tags = event.tags;
  return tags?.logger === "console";
}

function stackFrameTexts(event: ErrorEvent): string[] {
  const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
  return frames.flatMap((frame) =>
    [frame.filename, frame.abs_path, frame.function].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
  );
}

function hasStackFrameMatching(event: ErrorEvent, pattern: RegExp): boolean {
  return stackFrameTexts(event).some((frame) => pattern.test(frame));
}

function browserName(event: ErrorEvent): string {
  const contexts = event.contexts?.browser as { name?: string } | undefined;
  if (typeof contexts?.name === "string") return contexts.name;
  const tag = event.tags?.["browser.name"];
  return typeof tag === "string" ? tag : "";
}

/** Drop expected noise: web-vitals misreported as errors, Better Auth user mistakes. */
export function shouldDropSentryEvent(event: ErrorEvent): boolean {
  const message = eventMessage(event);
  if (message.startsWith("web-vitals.")) return true;

  if (!isConsoleLoggerEvent(event)) return false;

  const transaction = event.transaction ?? "";
  const isAuthRoute =
    transaction.includes("/api/auth/sign-in") ||
    transaction.includes("/api/auth/callback") ||
    transaction.includes("POST /api/auth/sign-in");

  if (!isAuthRoute) return false;

  return AUTH_USER_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** Drop unmapped browser-extension errors (React streaming / JSON-LD eval noise). */
export function shouldDropBrowserExtensionNoise(event: ErrorEvent): boolean {
  const message = eventMessage(event);
  if (!/parentNode|@context.*toLowerCase/i.test(message)) return false;

  const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
  if (frames.length === 0) return false;

  return frames.some(
    (frame) =>
      frame.filename?.startsWith("app:///") === true ||
      frame.abs_path?.startsWith("app:///") === true,
  );
}

/** Drop third-party client noise (GTM, in-app browsers, deploy stale server actions). */
export function shouldDropThirdPartyClientNoise(event: ErrorEvent): boolean {
  const message = eventMessage(event);

  if (/Failed to fetch.*gtm\.lax\.bid/i.test(message)) return true;
  if (/Load failed.*gtm\.lax\.bid/i.test(message)) return true;
  if (/webkit\.messageHandlers/i.test(message)) return true;
  if (/callWebView|Java bridge method invocation error|Java object is gone/i.test(message)) {
    return true;
  }
  if (/UnrecognizedActionError|failed-to-find-server-action/i.test(message)) return true;

  if (hasStackFrameMatching(event, /autofill_contact_enhanced/i)) return true;
  if (
    /Facebook/i.test(browserName(event)) &&
    /reading 'value'/i.test(message) &&
    (event.transaction?.includes("/dashboard/settings/addresses") ?? false)
  ) {
    return true;
  }

  if (
    /The object can not be found here/i.test(message) &&
    hasStackFrameMatching(event, /removeChild/i)
  ) {
    return true;
  }

  if (/^TypeError: Load failed$/i.test(message)) return true;

  return false;
}

/** Drop transient infrastructure noise (Postgres pool exhaustion, Redis blips, BullMQ lock loss). */
export function shouldDropInfrastructureNoise(event: ErrorEvent): boolean {
  const message = eventMessage(event);

  if (/connect ETIMEDOUT/i.test(message)) return true;
  if (/Missing lock for job/i.test(message)) return true;
  if (
    /remaining connection slots are reserved for roles with the SUPERUSER attribute/i.test(message)
  ) {
    return true;
  }

  // Node 22 web-streams regression (nodejs/node#62036): when a client disconnects
  // mid-stream during RSC/HTML streaming, the TransformStream controller is cleared
  // while a write is still pending, leaking an internal TypeError. It is unactionable
  // and harmless (the response was already being torn down). Drop until the upstream
  // fix (nodejs/node#62040) lands in the Node 22 LTS line.
  if (/transformAlgorithm is not a function/i.test(message)) return true;

  // Sentry envelope tunnel (`tunnelRoute`) failing to reach Sentry ingest from the
  // server — typically a browser beacon that disconnected on page unload or a
  // transient egress timeout to ingest. Not an application fault.
  if (/Failed to proxy\b.*ingest\.[^\s]*sentry\.io/i.test(message)) return true;

  return false;
}

/** Strip sensitive headers and webhook/cron bodies before events leave the process. */
export function scrubSentryEvent<T extends ErrorEvent>(event: T, _hint?: EventHint): T | null {
  if (shouldDropSentryEvent(event)) return null;
  if (shouldDropInfrastructureNoise(event)) return null;

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
