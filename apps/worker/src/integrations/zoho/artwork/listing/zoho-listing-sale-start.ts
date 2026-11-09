import type {
  IZohoListingSaleStartMark,
  IZohoListingSourceReader,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { syncPages } from "./sync-pages.js";
import type { ListingSyncReport, ZohoListingSync } from "./zoho-listing-sync.js";

/** How often the pass runs. */
export const SALE_START_PASS_INTERVAL_MS = 15 * 60_000;
/**
 * The least each pass looks back: one interval plus slack. Passes overlap by design; that is safe
 * because a sync only writes when Zoho shows something different.
 */
export const SALE_START_PASS_LOOKBACK_MS = SALE_START_PASS_INTERVAL_MS + 5 * 60_000;
/**
 * The most a pass looks back after a long gap. The nightly pass checks every original, so anything
 * older is its job, and a long outage does not turn into one huge pass.
 */
export const SALE_START_PASS_MAX_LOOKBACK_MS = 24 * 60 * 60_000;
/**
 * A bound on one pass: 10 pages of 200 artworks. A sale that has just started has far fewer lots
 * than that; the cap only guards against a runaway query.
 */
export const SALE_START_PASS_MAX_PAGES = 10;

/**
 * Sales that started after `from`, up to and including `to`. `from` is the earlier of the last
 * covered instant and the usual lookback, so a delayed or failed run is made up for, but never
 * reaches back further than the nightly pass's interval.
 */
export function saleStartWindow(now: Date, lastCoveredTo: Date | null): { from: Date; to: Date } {
  const usual = now.getTime() - SALE_START_PASS_LOOKBACK_MS;
  const earliest = now.getTime() - SALE_START_PASS_MAX_LOOKBACK_MS;
  const from = Math.max(earliest, lastCoveredTo ? Math.min(lastCoveredTo.getTime(), usual) : usual);
  return { from: new Date(from), to: now };
}

/**
 * A sale starts on its own time with no event, so the listings of its lots (upcoming until then,
 * live now after) would wait for the nightly pass. This pass refreshes the lots of sales that
 * started since the last pass that fully succeeded. Writes go through the listing sync only, which
 * follows the listing mode.
 */
export class ZohoListingSaleStartPass {
  private readonly now: () => Date;

  constructor(
    private readonly deps: {
      sync: Pick<ZohoListingSync, "sync">;
      sources: Pick<IZohoListingSourceReader, "registerIdsForSalesStartedBetween">;
      mark: IZohoListingSaleStartMark;
      log: Logger;
      now?: () => Date;
    },
  ) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Throws when any record could not be refreshed, so the job and its monitor show the failure. The
   * mark moves only after a run with no failures; a failed run is made up for by the next one.
   */
  async run(): Promise<ListingSyncReport> {
    const window = saleStartWindow(this.now(), await this.deps.mark.lastCoveredTo());
    const { report, capped } = await syncPages(
      {
        sync: this.deps.sync,
        log: this.deps.log,
        failedPageEvent: "zoho_listing_sale_start_page_failed",
        maxPages: SALE_START_PASS_MAX_PAGES,
      },
      (after, limit) => this.deps.sources.registerIdsForSalesStartedBetween(window, after, limit),
    );
    if (capped) {
      this.deps.log.warn(
        { from: window.from, to: window.to, maxPages: SALE_START_PASS_MAX_PAGES },
        "zoho_listing_sale_start_page_cap_reached",
      );
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
    await this.deps.mark.markCoveredTo(window.to);
    return report;
  }
}
