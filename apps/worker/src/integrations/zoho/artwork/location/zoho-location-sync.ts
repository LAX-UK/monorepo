import type { IZohoListingLock, IZohoLocationSourceReader } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { ZOHO_LISTING_BATCH_SIZE } from "../listing/zoho-listing-products.js";
import { EMPTY_REPORT, type ListingSyncReport, addReports } from "../listing/zoho-listing-sync.js";
import { PRODUCT_NOT_FOUND } from "../zoho-product-gone.js";
import { ZOHO_LOCATION_FIELD, zohoLocationValue } from "./zoho-location-fields.js";
import type { ZohoLocationProducts } from "./zoho-location-products.js";

export type ZohoLocationSyncMode = "dry_run" | "live";

type Planned = { registerId: string; stockCode: string; productId: string; value: string | null };

/**
 * Brings `LAX_Location` on Zoho Products into line with LAX for a set of originals. One path for
 * the event and the nightly pass, so they cannot disagree.
 *
 * Per batch: take the artworks' locks, read where each is now (after the locks, so it is the
 * newest), read what Zoho shows, and send only the Products that differ, in one request. A dry run
 * reads both sides and logs what it would send without sending it. The report has the listing's
 * shape so the listing's page walk can drive it; nothing here is ever `stale`.
 */
export class ZohoLocationSync {
  constructor(
    private readonly deps: {
      mode: ZohoLocationSyncMode;
      sources: IZohoLocationSourceReader;
      products: ZohoLocationProducts;
      lock: IZohoListingLock;
      log: Logger;
    },
  ) {}

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
    const sources = await this.deps.sources.read(registerIds);
    if (sources.length === 0) return EMPTY_REPORT;
    const shown = await this.deps.products.read(sources.map((source) => source.zohoProductId));

    const report: ListingSyncReport = { ...EMPTY_REPORT, checked: sources.length, failures: [] };
    const planned: Planned[] = [];
    for (const source of sources) {
      if (!shown.has(source.zohoProductId)) {
        report.failures.push({
          registerId: source.registerId,
          stockCode: source.stockCode,
          code: PRODUCT_NOT_FOUND,
          retryable: false,
        });
        continue;
      }
      const value = zohoLocationValue(source.location);
      if ((shown.get(source.zohoProductId) ?? null) === value) {
        report.unchanged += 1;
        continue;
      }
      planned.push({
        registerId: source.registerId,
        stockCode: source.stockCode,
        productId: source.zohoProductId,
        value,
      });
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
            fields: { [ZOHO_LOCATION_FIELD]: item.value },
          },
          "zoho_location_dry_run",
        );
      }
      report.changed += planned.length;
      return;
    }
    const results = await this.deps.products.update(
      planned.map((item) => ({
        productId: item.productId,
        fields: { [ZOHO_LOCATION_FIELD]: item.value },
      })),
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
