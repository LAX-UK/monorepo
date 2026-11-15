import * as Sentry from "@sentry/nextjs";

type BreadcrumbSink = { addBreadcrumb?: (breadcrumb: Sentry.Breadcrumb) => void };

/** Used when an error notice was raised without an `id`. */
export const UNKEYED_NOTICE = "unkeyed";

/**
 * Leaves a breadcrumb (not an event) saying an error notice was shown, so a later report has
 * context. Only the notice's key goes in: its title and description can carry user data, so they
 * never do. A missing or failing Sentry is ignored; a notice must never break the page.
 */
export function addErrorNoticeBreadcrumb(
  key: string | undefined,
  sink: BreadcrumbSink = Sentry,
): void {
  try {
    sink.addBreadcrumb?.({
      category: "ui.notice",
      level: "error",
      message: key ?? UNKEYED_NOTICE,
    });
  } catch {
    // Diagnostics only.
  }
}
