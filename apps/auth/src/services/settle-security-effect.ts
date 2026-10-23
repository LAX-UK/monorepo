export type SecurityEffectLogger = {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
};

/** Delays before each background retry of a security side effect that failed after the auth change succeeded. */
export const SECURITY_EFFECT_RETRY_DELAYS_MS = [2_000, 10_000, 60_000] as const;

export function describeError(error: unknown): { errorName: string; errorMessage: string } {
  return error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: "unknown", errorMessage: String(error) };
}

/**
 * Runs a side effect of an already-committed auth change. A failure is logged with
 * its context (never the request or its cookies) and retried in the background with
 * back-off, because the change cannot be rolled back and the user must still get
 * the real success response. The first attempt is awaited so the usual case has
 * finished, and session revocation in particular, before the response returns.
 */
export async function settleSecurityEffect(
  log: SecurityEffectLogger,
  context: { path: string; effect: string; userId?: string },
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
    return;
  } catch (error) {
    log.error({ ...context, ...describeError(error), attempt: 1 }, "auth_security_effect_failed");
  }
  retryInBackground(log, context, run);
}

/**
 * Last-resort in-process retries, used only when the durable record could not be written
 * either. They are lost on restart, which is why the durable outbox is the normal path.
 */
export function retryInBackground(
  log: SecurityEffectLogger,
  context: { path: string; effect: string; userId?: string },
  run: () => Promise<void>,
): void {
  const retry = (index: number): void => {
    const delay = SECURITY_EFFECT_RETRY_DELAYS_MS[index];
    if (delay === undefined) {
      log.error(context, "auth_security_effect_abandoned");
      return;
    }
    setTimeout(() => {
      run().then(
        () => log.warn({ ...context, attempt: index + 2 }, "auth_security_effect_recovered"),
        (error: unknown) => {
          log.error(
            { ...context, ...describeError(error), attempt: index + 2 },
            "auth_security_effect_failed",
          );
          retry(index + 1);
        },
      );
    }, delay).unref();
  };
  retry(0);
}
