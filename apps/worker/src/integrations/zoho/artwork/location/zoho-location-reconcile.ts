import { randomUUID } from "node:crypto";
import type { IZohoListingSourceReader } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { syncPages } from "../listing/sync-pages.js";
import type { ListingSyncReport } from "../listing/zoho-listing-sync.js";
import type { ZohoLocationSync, ZohoLocationSyncMode } from "./zoho-location-sync.js";

/** Enough failures for staff to act on in the log; the count holds the rest. */
export const LOCATION_RECONCILE_FAILURES_LOGGED = 20;

/**
 * The nightly drift check: every original's `LAX_Location` is checked against LAX and corrected
 * where they differ (a missed event, an edit made in Zoho). A page that fails is counted and the
 * pass carries on, so one bad record never hides the rest.
 */
export class ZohoLocationReconcile {
  constructor(
    private readonly deps: {
      mode: ZohoLocationSyncMode;
      sync: Pick<ZohoLocationSync, "sync">;
      sources: Pick<IZohoListingSourceReader, "pageOriginals">;
      log: Logger;
      now?: () => Date;
    },
  ) {}

  async run(): Promise<ListingSyncReport> {
    const startedAt = (this.deps.now ?? (() => new Date()))();
    const runId = `location:${startedAt.toISOString()}:${randomUUID().slice(0, 8)}`;
    const { report } = await syncPages(
      {
        sync: this.deps.sync,
        log: this.deps.log,
        failedPageEvent: "zoho_location_reconcile_page_failed",
        logContext: { runId },
      },
      (after, limit) => this.deps.sources.pageOriginals(after, limit),
    );
    this.deps.log.info(
      {
        runId,
        mode: this.deps.mode,
        checked: report.checked,
        changed: report.changed,
        unchanged: report.unchanged,
        failed: report.failures.length,
        failures: report.failures
          .slice(0, LOCATION_RECONCILE_FAILURES_LOGGED)
          .map(({ registerId, stockCode, code }) => ({ registerId, stockCode, code })),
      },
      "zoho_location_reconcile_finished",
    );
    return report;
  }
}
