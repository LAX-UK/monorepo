import type { IZohoListingSourceReader } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { crmErrorOutcome } from "../../../crm/classify-crm-error.js";
import { LISTING_PAGE_SIZE } from "../listing/sync-pages.js";
import {
  EMPTY_STATUS_REPORT,
  type StatusSyncReport,
  type ZohoStatusSync,
  addStatusReports,
  reportOf,
} from "./zoho-status-sync.js";

/** Enough failures for staff to act on; the counts hold the rest. */
export const STATUS_FAILURES_KEPT = 20;

/**
 * The nightly check of the Zoho Status: every original is compared with what LAX would write and
 * repaired only where compare-and-set allows. A Status staff set in Zoho stays, and the
 * difference is raised (or kept) as a conflict. A page that fails is counted against its records
 * and the pass carries on, so one bad record never hides the rest.
 */
export class ZohoStatusReconcile {
  constructor(
    private readonly deps: {
      sync: Pick<ZohoStatusSync, "sync">;
      sources: Pick<IZohoListingSourceReader, "pageOriginals">;
      log: Logger;
    },
  ) {}

  async run(): Promise<StatusSyncReport> {
    let report = EMPTY_STATUS_REPORT;
    let after: string | null = null;
    for (;;) {
      const ids = await this.deps.sources.pageOriginals(after, LISTING_PAGE_SIZE);
      if (ids.length === 0) break;
      report = addStatusReports(report, await this.page(ids, after));
      after = ids[ids.length - 1] ?? null;
      if (ids.length < LISTING_PAGE_SIZE) break;
    }
    this.deps.log.info(
      {
        checked: report.checked,
        written: report.written,
        unchanged: report.unchanged,
        conflicts: report.conflicts,
        stale: report.stale,
        failed: report.failures.length,
        failures: report.failures.slice(0, STATUS_FAILURES_KEPT),
      },
      "zoho_status_reconcile_finished",
    );
    return report;
  }

  private async page(ids: string[], after: string | null): Promise<StatusSyncReport> {
    try {
      return reportOf(await this.deps.sync.sync(ids));
    } catch (err) {
      const { error } = crmErrorOutcome(err);
      this.deps.log.warn({ after, code: error.code }, "zoho_status_reconcile_page_failed");
      return {
        ...EMPTY_STATUS_REPORT,
        checked: ids.length,
        failures: ids.map((registerId) => ({
          registerId,
          code: error.code,
          retryable: error.retryable,
        })),
      };
    }
  }
}
