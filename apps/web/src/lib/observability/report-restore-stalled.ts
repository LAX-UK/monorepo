import * as Sentry from "@sentry/nextjs";

/** The page alone: a query string can carry an invitation token or other private values. */
function pathOnly(href: string): string {
  return href.split(/[?#]/)[0] ?? "";
}

/**
 * A restore ran and the browser still has no usable account. The person sees the retry state;
 * this makes the failure visible, because the loop it replaces left no trace at all. Only the
 * path of the page being opened is sent (never its query), and every report shares one
 * fingerprint so they group together.
 */
export function reportRestoreStalled(returnTo: string): void {
  Sentry.captureMessage("Account restore did not take", {
    level: "error",
    tags: { area: "account-switching" },
    fingerprint: ["account-restore-stalled"],
    extra: { page: pathOnly(returnTo) },
  });
}
