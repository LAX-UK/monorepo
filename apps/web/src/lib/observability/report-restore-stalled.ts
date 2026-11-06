import * as Sentry from "@sentry/nextjs";

/**
 * A restore ran and the browser still has no usable account. The person sees the retry state;
 * this makes the failure visible, because the loop it replaces left no trace at all.
 */
export function reportRestoreStalled(restoreHref: string): void {
  Sentry.captureMessage("Account restore did not take", {
    level: "error",
    tags: { area: "account-switching" },
    extra: { restoreHref },
  });
}
