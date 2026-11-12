import { randomUUID } from "node:crypto";
import type {
  IZohoListingRunStore,
  IZohoListingSourceReader,
  ZohoListingRunFailure,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import type { ZohoStatusReconcile } from "../status/zoho-status-reconcile.js";
import { syncPages } from "./sync-pages.js";
import type {
  ListingSyncReport,
  ZohoListingSync,
  ZohoListingSyncMode,
} from "./zoho-listing-sync.js";

/** Enough failures for staff to act on; the count holds the rest. */
export const RECONCILE_FAILURES_KEPT = 20;

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
      /** The Zoho Status check that follows the listing pass; absent when Status writes are off. */
      statuses?: Pick<ZohoStatusReconcile, "run">;
      log: Logger;
      now?: () => Date;
    },
  ) {
    this.now = deps.now ?? (() => new Date());
  }

  async run(): Promise<ListingSyncReport> {
    const startedAt = this.now();
    const runId = `listing:${startedAt.toISOString()}:${randomUUID().slice(0, 8)}`;
    const { report } = await syncPages(
      {
        sync: this.deps.sync,
        log: this.deps.log,
        failedPageEvent: "zoho_listing_reconcile_page_failed",
        logContext: { runId },
      },
      (after, limit) => this.deps.sources.pageOriginals(after, limit),
    );

    const failed = report.failures.length;
    const failures: ZohoListingRunFailure[] = report.failures
      .slice(0, RECONCILE_FAILURES_KEPT)
      .map(({ registerId, stockCode, code }) => ({
        registerId,
        ...(stockCode === undefined ? {} : { stockCode }),
        code,
      }));
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
    await this.checkStatuses(runId);
    return report;
  }

  /**
   * The Status is checked after the listing is recorded, and its failure never undoes or hides
   * the listing pass: it is logged and the next night tries again.
   */
  private async checkStatuses(runId: string): Promise<void> {
    if (!this.deps.statuses) return;
    try {
      await this.deps.statuses.run();
    } catch (err) {
      this.deps.log.error({ runId, err }, "zoho_status_reconcile_failed");
    }
  }
}
