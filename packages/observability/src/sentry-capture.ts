import * as Sentry from "@sentry/node";

export type BackgroundErrorContext = {
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
};

/** Report infrastructure failures (redis, queues, lifecycle loops) to Sentry. */
export function captureBackgroundError(
  component: string,
  error: unknown,
  context?: BackgroundErrorContext,
): void {
  const tags = { component, ...context?.tags };
  const extra = context?.extra;
  if (error instanceof Error) {
    Sentry.captureException(error, { tags, ...(extra ? { extra } : {}) });
    return;
  }
  Sentry.captureMessage(String(error), {
    level: "error",
    tags,
    ...(extra ? { extra } : {}),
  });
}

/** Send a connectivity probe event and flush before returning. */
export async function probeSentryConnectivity(): Promise<string | undefined> {
  const eventId = Sentry.captureMessage("sentry_connectivity_test", {
    level: "info",
    tags: { source: "sentry-connectivity-probe" },
  });
  await Sentry.flush(2_000);
  return eventId;
}
