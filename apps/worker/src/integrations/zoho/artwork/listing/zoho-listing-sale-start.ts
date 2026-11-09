import type { IZohoListingSourceReader } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { crmErrorOutcome } from "../../../crm/classify-crm-error.js";
import {
  EMPTY_REPORT,
  type ListingSyncReport,
  type ZohoListingSync,
  addReports,
} from "./zoho-listing-sync.js";

/** How often the pass runs. */
export const SALE_START_PASS_INTERVAL_MS = 15 * 60_000;
/**
 * How far back each pass looks. One interval plus slack, so a late or skipped run still sees the
 * sales that started in the gap. Passes overlap; that is safe because a sync only writes when
 * Zoho shows something different.
 */
export const SALE_START_PASS_LOOKBACK_MS = SALE_START_PASS_INTERVAL_MS + 5 * 60_000;
const PAGE_SIZE = 200;
/** A bound on one pass: far more artworks than any sale starts with. */
export const SALE_START_PASS_MAX_PAGES = 50;

/** Sales that started after `from`, up to and including `to`. */
export function saleStartWindow(now: Date): { from: Date; to: Date } {
  return { from: new Date(now.getTime() - SALE_START_PASS_LOOKBACK_MS), to: now };
}

/**
 * A sale starts on its own time with no event, so the listings of its lots (upcoming until then,
 * live now after) would wait for the nightly pass. This pass refreshes the lots of sales that
 * started in the last window. Writes go through the listing sync only, which follows the listing
 * mode.
 */
export class ZohoListingSaleStartPass {
  private readonly now: () => Date;

  constructor(
    private readonly deps: {
      sync: Pick<ZohoListingSync, "sync">;
      sources: Pick<IZohoListingSourceReader, "registerIdsForSalesStartedBetween">;
      log: Logger;
      now?: () => Date;
    },
  ) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Throws when any record could not be refreshed, so the job and its monitor show the failure. */
  async run(): Promise<ListingSyncReport> {
    const window = saleStartWindow(this.now());
    let report = EMPTY_REPORT;
    let after: string | null = null;
    for (let page = 0; page < SALE_START_PASS_MAX_PAGES; page++) {
      const ids = await this.deps.sources.registerIdsForSalesStartedBetween(
        window,
        after,
        PAGE_SIZE,
      );
      if (ids.length === 0) break;
      try {
        report = addReports(report, await this.deps.sync.sync(ids));
      } catch (err) {
        const { error } = crmErrorOutcome(err);
        this.deps.log.warn({ after, code: error.code }, "zoho_listing_sale_start_page_failed");
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
    this.deps.log.info(
      {
        from: window.from,
        to: window.to,
        checked: report.checked,
        changed: report.changed,
        failed,
      },
      "zoho_listing_sale_start_finished",
    );
    if (failed > 0) throw new Error(`zoho_listing_sale_start_failed:${failed}`);
    return report;
  }
}
