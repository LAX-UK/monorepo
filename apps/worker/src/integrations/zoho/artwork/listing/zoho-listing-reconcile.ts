import { randomUUID } from "node:crypto";
import type {
  IZohoListingRunStore,
  IZohoListingSourceReader,
  ZohoListingRunFailure,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { crmErrorOutcome } from "../../../crm/classify-crm-error.js";
import {
  EMPTY_REPORT,
  type ListingSyncReport,
  type ZohoListingSync,
  type ZohoListingSyncMode,
  addReports,
} from "./zoho-listing-sync.js";

/** Enough failures for staff to act on; the count holds the rest. */
export const RECONCILE_FAILURES_KEPT = 20;
const PAGE_SIZE = 200;

/**
 * The nightly pass: every original's listing is checked against Zoho and corrected where they
 * differ, whatever the reason (a missed event, a sale that started on its own time, someone
 * editing the field in Zoho, a withdrawn artwork's 30 days running out). A page that fails is
 * counted and the pass carries on, so one bad record never hides the rest.
 */
export class ZohoListingReconcile {
  private readonly now: () => Date;

  constructor(
    private readonly deps: {
      mode: ZohoListingSyncMode;
      sync: Pick<ZohoListingSync, "sync">;
      sources: Pick<IZohoListingSourceReader, "pageOriginals">;
      runs: IZohoListingRunStore;
      log: Logger;
      now?: () => Date;
    },
  ) {
    this.now = deps.now ?? (() => new Date());
  }

  async run(): Promise<ListingSyncReport> {
    const startedAt = this.now();
    const runId = `listing:${startedAt.toISOString()}:${randomUUID().slice(0, 8)}`;
    let report = EMPTY_REPORT;
    let after: string | null = null;
    for (;;) {
      const ids = await this.deps.sources.pageOriginals(after, PAGE_SIZE);
      if (ids.length === 0) break;
      try {
        report = addReports(report, await this.deps.sync.sync(ids));
      } catch (err) {
        const { error } = crmErrorOutcome(err);
        this.deps.log.warn(
          { runId, after, code: error.code },
          "zoho_listing_reconcile_page_failed",
        );
        report = addReports(report, {
          ...EMPTY_REPORT,
          checked: ids.length,
          failures: ids.map((registerId) => ({
            registerId,
            stockCode: "",
            code: error.code,
            retryable: error.retryable,
          })),
        });
      }
      after = ids[ids.length - 1] ?? null;
      if (ids.length < PAGE_SIZE) break;
    }

    const failed = report.failures.length;
    const failures: ZohoListingRunFailure[] = report.failures
      .slice(0, RECONCILE_FAILURES_KEPT)
      .map(({ registerId, stockCode, code }) => ({ registerId, stockCode, code }));
    await this.deps.runs.record({
      runId,
      mode: this.deps.mode,
      startedAt,
      finishedAt: this.now(),
      checked: report.checked,
      changed: report.changed,
      unchanged: report.unchanged + report.stale,
      failed,
      failures,
    });
    this.deps.log.info(
      { runId, mode: this.deps.mode, checked: report.checked, changed: report.changed, failed },
      "zoho_listing_reconcile_finished",
    );
    return report;
  }
}
