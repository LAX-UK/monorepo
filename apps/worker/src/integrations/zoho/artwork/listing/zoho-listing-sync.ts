import type { ArtListingFacts } from "@auction/artwork-register-contracts";
import type {
  IZohoListingLock,
  IZohoListingSourceReader,
  ZohoListingRunFailure,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { computeZohoListing } from "./compute-zoho-listing.js";
import type { LaxArtListings } from "./lax-art-listings.js";
import type { ListingLinks } from "./listing-links.js";
import { planListingUpdate } from "./plan-listing-update.js";
import { ZOHO_LISTING_BATCH_SIZE, type ZohoListingProducts } from "./zoho-listing-products.js";

export type ZohoListingSyncMode = "dry_run" | "live";

export type ListingSyncFailure = ZohoListingRunFailure & { retryable: boolean };

export type ListingSyncReport = {
  /** Originals looked at. */
  checked: number;
  /** Sent to Zoho, or in a dry run, would have been. */
  changed: number;
  unchanged: number;
  /** Dropped because Zoho already shows a newer listing. */
  stale: number;
  failures: ListingSyncFailure[];
};

export const EMPTY_REPORT: ListingSyncReport = {
  checked: 0,
  changed: 0,
  unchanged: 0,
  stale: 0,
  failures: [],
};

export function addReports(a: ListingSyncReport, b: ListingSyncReport): ListingSyncReport {
  return {
    checked: a.checked + b.checked,
    changed: a.changed + b.changed,
    unchanged: a.unchanged + b.unchanged,
    stale: a.stale + b.stale,
    failures: [...a.failures, ...b.failures],
  };
}

export type ZohoListingSyncDeps = {
  mode: ZohoListingSyncMode;
  sources: Pick<IZohoListingSourceReader, "read">;
  laxArt: LaxArtListings;
  products: ZohoListingProducts;
  lock: IZohoListingLock;
  links: ListingLinks;
  log: Logger;
  now?: () => Date;
};

type Planned = {
  registerId: string;
  stockCode: string;
  productId: string;
  fields: Record<string, string | null>;
};

/**
 * Brings the LAX listing on Zoho Products into line with LAX for a set of originals. One path for
 * every trigger (an event, a sale going live, the nightly pass), so they cannot disagree.
 *
 * Per batch: take the artworks' locks, read the facts (after the locks, so they are the newest),
 * read what Zoho shows, and send only what differs, in one request. A dry run reads both sides and
 * reports what it would send without sending it.
 */
export class ZohoListingSync {
  private readonly now: () => Date;

  constructor(private readonly deps: ZohoListingSyncDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async sync(registerIds: readonly string[]): Promise<ListingSyncReport> {
    const ids = [...new Set(registerIds)];
    let report = EMPTY_REPORT;
    for (let at = 0; at < ids.length; at += ZOHO_LISTING_BATCH_SIZE) {
      const batch = ids.slice(at, at + ZOHO_LISTING_BATCH_SIZE);
      report = addReports(
        report,
        await this.deps.lock.withLock(batch, () => this.syncBatch(batch)),
      );
    }
    return report;
  }

  private async syncBatch(registerIds: string[]): Promise<ListingSyncReport> {
    const observedAt = this.now();
    const sources = await this.deps.sources.read(registerIds);
    if (sources.length === 0) return EMPTY_REPORT;
    const productIds = sources.map((source) => source.entry.zohoProductId);
    const [listings, current] = await Promise.all([
      this.deps.laxArt.find(productIds),
      this.deps.products.read(productIds),
    ]);
    const laxArtByProduct = new Map<string, ArtListingFacts>(
      listings.map((listing) => [listing.zohoProductId, listing]),
    );

    const planned: Planned[] = [];
    const report: ListingSyncReport = { ...EMPTY_REPORT, checked: sources.length, failures: [] };
    for (const source of sources) {
      const { entry } = source;
      const shown = current.get(entry.zohoProductId);
      if (!shown) {
        report.failures.push({
          registerId: entry.id,
          stockCode: entry.stockCode,
          code: "product_not_found",
          retryable: false,
        });
        continue;
      }
      const wanted = computeZohoListing(
        { ...source, laxArt: laxArtByProduct.get(entry.zohoProductId) ?? null },
        observedAt,
        this.deps.links,
      );
      const plan = planListingUpdate({ wanted, current: shown, observedAt });
      if (plan.kind === "unchanged") report.unchanged += 1;
      else if (plan.kind === "stale") report.stale += 1;
      else {
        planned.push({
          registerId: entry.id,
          stockCode: entry.stockCode,
          productId: entry.zohoProductId,
          fields: plan.fields,
        });
      }
    }

    if (planned.length > 0) await this.send(planned, report);
    return report;
  }

  private async send(planned: Planned[], report: ListingSyncReport): Promise<void> {
    if (this.deps.mode === "dry_run") {
      for (const item of planned) {
        this.deps.log.info(
          {
            registerId: item.registerId,
            stockCode: item.stockCode,
            zohoProductId: item.productId,
            fields: item.fields,
          },
          "zoho_listing_dry_run",
        );
      }
      report.changed += planned.length;
      return;
    }
    const results = await this.deps.products.update(
      planned.map((item) => ({ productId: item.productId, fields: item.fields })),
    );
    const byProduct = new Map(results.map((result) => [result.productId, result]));
    for (const item of planned) {
      const result = byProduct.get(item.productId);
      if (result?.ok) {
        report.changed += 1;
        continue;
      }
      report.failures.push({
        registerId: item.registerId,
        stockCode: item.stockCode,
        code: result ? result.code : "EMPTY_RESPONSE",
        retryable: result ? result.retryable : true,
      });
    }
  }
}
