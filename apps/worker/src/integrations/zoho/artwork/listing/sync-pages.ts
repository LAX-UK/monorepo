import type { Logger } from "pino";
import { crmErrorOutcome } from "../../../crm/classify-crm-error.js";
import {
  EMPTY_REPORT,
  type ListingSyncReport,
  type ZohoListingSync,
  addReports,
} from "./zoho-listing-sync.js";

export const LISTING_PAGE_SIZE = 200;

/** One page of register ids in id order after the cursor. */
export type ListingPageFn = (after: string | null, limit: number) => Promise<string[]>;

export type SyncPagesResult = {
  report: ListingSyncReport;
  /** True when `maxPages` stopped the walk with records possibly left. */
  capped: boolean;
};

/**
 * Walks pages of register ids and syncs each through the listing sync. A page that fails is counted
 * against every record on it and the walk carries on, so one bad record never hides the rest. The
 * failure carries no stock code: the page failed before its records were read.
 */
export async function syncPages(
  deps: {
    sync: Pick<ZohoListingSync, "sync">;
    log: Logger;
    /** Log event for a failed page, so each pass keeps its own name in the logs. */
    failedPageEvent: string;
    /** Stops the walk after this many pages; the walk is unbounded when omitted. */
    maxPages?: number;
    logContext?: Record<string, unknown>;
  },
  nextPage: ListingPageFn,
): Promise<SyncPagesResult> {
  const maxPages = deps.maxPages ?? Number.POSITIVE_INFINITY;
  let report = EMPTY_REPORT;
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const ids = await nextPage(after, LISTING_PAGE_SIZE);
    if (ids.length === 0) return { report, capped: false };
    try {
      report = addReports(report, await deps.sync.sync(ids));
    } catch (err) {
      const { error } = crmErrorOutcome(err);
      deps.log.warn({ ...deps.logContext, after, code: error.code }, deps.failedPageEvent);
      report = addReports(report, {
        ...EMPTY_REPORT,
        checked: ids.length,
        failures: ids.map((registerId) => ({
          registerId,
          code: error.code,
          retryable: error.retryable,
        })),
      });
    }
    after = ids[ids.length - 1] ?? null;
    if (ids.length < LISTING_PAGE_SIZE) return { report, capped: false };
  }
  // Every allowed page was full, so there may be more.
  return { report, capped: true };
}
