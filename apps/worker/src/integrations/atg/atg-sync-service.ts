import { type AtgGateway, AtgGatewayError } from "./atg-gateway.js";
import {
  AtgMappingError,
  gapImageName,
  mapLotToLotFields,
  mapSaleToAuctionFields,
  payloadHash,
  resolveLotImageUrls,
} from "./atg-mappers.js";
import type { AtgSyncStore } from "./atg-sync-store.js";
import type {
  AtgAuctionLink,
  AtgLotLink,
  AtgLotSnapshot,
  AtgPushSummary,
  AtgSaleSnapshot,
  AtgSyncConfig,
} from "./atg-types.js";

/** A job that cannot succeed by retrying (missing sale, not linked yet, …). */
export class AtgSyncPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtgSyncPreconditionError";
  }
}

/** Some lots failed with transient errors; the job should be retried. */
export class AtgPartialSyncError extends Error {
  constructor(
    message: string,
    readonly summary: AtgPushSummary,
  ) {
    super(message);
    this.name = "AtgPartialSyncError";
  }
}

export type AtgSyncServiceDeps = {
  gateway: AtgGateway;
  store: AtgSyncStore;
  config: AtgSyncConfig;
  now?: () => Date;
};

const POLL_CLOSED_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isRetryable(err: unknown): boolean {
  return err instanceof AtgGatewayError && err.retryable;
}

const MAX_LISTED_FAILURES = 5;

function failureSummary(failures: string[]): string | null {
  if (failures.length === 0) return null;
  const listed = failures.slice(0, MAX_LISTED_FAILURES).join("; ");
  const more = failures.length - MAX_LISTED_FAILURES;
  return more > 0 ? `${listed}; +${more} more` : listed;
}

/**
 * Pushes LAX sales to ATG and pulls results back. Every operation is idempotent: link rows
 * record what ATG already has, and payload hashes skip unchanged updates, so jobs can be
 * retried safely.
 */
export class AtgSyncService {
  private readonly gateway: AtgGateway;
  private readonly store: AtgSyncStore;
  private readonly config: AtgSyncConfig;
  private readonly now: () => Date;

  constructor(deps: AtgSyncServiceDeps) {
    this.gateway = deps.gateway;
    this.store = deps.store;
    this.config = deps.config;
    this.now = deps.now ?? (() => new Date());
  }

  async pushSale(saleId: string): Promise<AtgPushSummary> {
    const startedAt = this.now();
    const sale = await this.store.loadSale(saleId);
    if (!sale) throw new AtgSyncPreconditionError(`Sale ${saleId} not found`);

    const existing = await this.store.getAuctionLink(saleId);
    if (existing?.remoteStatus === "closed") {
      throw new AtgSyncPreconditionError("ATG auction is closed; it can no longer be updated");
    }

    let auctionId: string;
    try {
      auctionId = await this.upsertAuction(sale, existing);
    } catch (err) {
      await this.store.saveAuctionLink(saleId, { lastError: errorText(err) });
      throw err;
    }

    const { summary, failures } = await this.syncLots(sale, auctionId);
    await this.store.saveAuctionLink(saleId, {
      lastSyncedAt: startedAt,
      lastError: failureSummary(failures),
    });
    return summary;
  }

  async publishSale(saleId: string): Promise<void> {
    await this.pushSale(saleId);
    const link = await this.requireAuction(saleId);
    if (link.remoteStatus === "published") return;
    try {
      if (this.config.approveBeforePublish && link.remoteStatus !== "approved") {
        await this.gateway.approveAuction(link.atgAuctionId);
        await this.store.saveAuctionLink(saleId, { remoteStatus: "approved" });
      }
      await this.gateway.publishAuction(link.atgAuctionId);
    } catch (err) {
      await this.store.saveAuctionLink(saleId, { lastError: errorText(err) });
      throw err;
    }
    await this.store.saveAuctionLink(saleId, {
      remoteStatus: "published",
      publishedAt: this.now(),
      lastError: null,
    });
  }

  async closeSale(saleId: string): Promise<void> {
    const link = await this.requireAuction(saleId);
    if (link.remoteStatus !== "closed") {
      try {
        await this.gateway.closeAuction(link.atgAuctionId);
      } catch (err) {
        await this.store.saveAuctionLink(saleId, { lastError: errorText(err) });
        throw err;
      }
      await this.store.saveAuctionLink(saleId, {
        remoteStatus: "closed",
        closedAt: this.now(),
        lastError: null,
      });
    }
    await this.pollSale(saleId);
  }

  async deleteLot(lotId: string): Promise<void> {
    const link = await this.store.getLotLink(lotId);
    if (!link) return;
    try {
      await this.gateway.deleteLot(link.atgLotId);
    } catch (err) {
      await this.store.updateLotLink(lotId, { lastError: errorText(err) });
      throw err;
    }
    await this.store.deleteLotLink(lotId);
  }

  async pollSale(saleId: string): Promise<void> {
    const link = await this.requireAuction(saleId);
    const polledAt = this.now();
    try {
      const [lots, results] = await Promise.all([
        this.gateway.getLots(link.atgAuctionId),
        this.gateway.getSaleResults(link.atgAuctionId),
      ]);
      await this.store.applyRemoteLots(saleId, lots, polledAt);
      await this.store.saveAuctionLink(saleId, {
        lastPolledAt: polledAt,
        resultsSnapshot: results,
      });
    } catch (err) {
      await this.store.saveAuctionLink(saleId, { lastError: `Poll failed: ${errorText(err)}` });
      throw err;
    }
  }

  /**
   * Repeatable tick: re-pushes linked sales edited in LAX since their last sync, then polls
   * published and recently closed auctions. One failing sale does not stop the others.
   */
  async tick(): Promise<{ pushed: number; polled: number; failed: number }> {
    const now = this.now();
    const links = await this.store.listActiveAuctionLinks(
      new Date(now.getTime() - POLL_CLOSED_FOR_MS),
    );
    let pushed = 0;
    let polled = 0;
    let failed = 0;
    for (const link of links) {
      try {
        if (
          link.remoteStatus !== "closed" &&
          (!link.lastSyncedAt ||
            (await this.store.hasCatalogueChangesSince(link.saleId, link.lastSyncedAt)))
        ) {
          await this.pushSale(link.saleId);
          pushed += 1;
        }
        if (link.remoteStatus === "published" || link.remoteStatus === "closed") {
          await this.pollSale(link.saleId);
          polled += 1;
        }
      } catch {
        failed += 1;
      }
    }
    return { pushed, polled, failed };
  }

  private async requireAuction(saleId: string): Promise<AtgAuctionLink & { atgAuctionId: string }> {
    const link = await this.store.getAuctionLink(saleId);
    if (!link?.atgAuctionId) {
      throw new AtgSyncPreconditionError("Sale has not been pushed to ATG yet");
    }
    return { ...link, atgAuctionId: link.atgAuctionId };
  }

  private async upsertAuction(sale: AtgSaleSnapshot, link: AtgAuctionLink | null): Promise<string> {
    const fields = mapSaleToAuctionFields(sale, this.config);
    const hash = payloadHash(fields);
    if (!link?.atgAuctionId) {
      const { auctionId } = await this.gateway.createAuction(fields);
      await this.store.saveAuctionLink(sale.id, {
        atgAuctionId: auctionId,
        atgAuctionReference: sale.id,
        remoteStatus: "created",
        payloadHash: hash,
      });
      return auctionId;
    }
    if (link.payloadHash !== hash) {
      await this.gateway.updateAuction({ ...fields, AuctionId: link.atgAuctionId });
      await this.store.saveAuctionLink(sale.id, { payloadHash: hash });
    }
    return link.atgAuctionId;
  }

  private async syncLots(
    sale: AtgSaleSnapshot,
    auctionId: string,
  ): Promise<{ summary: AtgPushSummary; failures: string[] }> {
    const summary: AtgPushSummary = { created: 0, updated: 0, unchanged: 0, deleted: 0, failed: 0 };
    const failures: string[] = [];
    const links = new Map((await this.store.listLotLinks(sale.id)).map((l) => [l.lotId, l]));
    let retryableFailures = 0;

    for (const [index, lot] of sale.lots.entries()) {
      const link = links.get(lot.id);
      links.delete(lot.id);
      try {
        const outcome = await this.syncLot(sale, lot, index + 1, auctionId, link);
        summary[outcome] += 1;
      } catch (err) {
        if (!(err instanceof AtgGatewayError || err instanceof AtgMappingError)) throw err;
        summary.failed += 1;
        if (isRetryable(err)) retryableFailures += 1;
        failures.push(`Lot ${lot.lotNumber ?? `"${lot.title}"`}: ${errorText(err)}`);
        await this.store.updateLotLink(lot.id, { lastError: errorText(err) });
      }
    }

    for (const orphan of links.values()) {
      try {
        await this.gateway.deleteLot(orphan.atgLotId);
        await this.store.deleteLotLink(orphan.lotId);
        summary.deleted += 1;
      } catch (err) {
        if (!(err instanceof AtgGatewayError)) throw err;
        summary.failed += 1;
        if (err.retryable) retryableFailures += 1;
        failures.push(`Removed lot ${orphan.atgLotId}: ${errorText(err)}`);
        await this.store.updateLotLink(orphan.lotId, { lastError: errorText(err) });
      }
    }

    if (retryableFailures > 0) {
      await this.store.saveAuctionLink(sale.id, { lastError: failureSummary(failures) });
      throw new AtgPartialSyncError(
        `${retryableFailures} lot(s) hit transient ATG errors`,
        summary,
      );
    }
    return { summary, failures };
  }

  private async syncLot(
    sale: AtgSaleSnapshot,
    lot: AtgLotSnapshot,
    sequence: number,
    auctionId: string,
    link: AtgLotLink | undefined,
  ): Promise<"created" | "updated" | "unchanged"> {
    const fields = { ...mapLotToLotFields(lot, sale, sequence, this.config), AuctionId: auctionId };
    const hash = payloadHash(fields);
    let outcome: "created" | "updated" | "unchanged" = "unchanged";
    let current = link;

    if (!current) {
      const { lotId: atgLotId } = await this.gateway.createLot(fields);
      await this.store.insertLotLink({
        lotId: lot.id,
        saleId: sale.id,
        atgLotId,
        payloadHash: hash,
      });
      current = { lotId: lot.id, saleId: sale.id, atgLotId, imageNames: [], payloadHash: hash };
      outcome = "created";
    } else if (current.payloadHash !== hash) {
      await this.gateway.updateLot({ ...fields, LotId: current.atgLotId });
      outcome = "updated";
    }

    await this.sendImages(lot, current);
    await this.store.updateLotLink(lot.id, {
      payloadHash: hash,
      lastSyncedAt: this.now(),
      lastError: null,
    });
    return outcome;
  }

  /**
   * ATG exposes no image IDs to remove, so images are append-only: a position already sent is
   * never re-sent (replacements/reorders in LAX are not propagated).
   */
  private async sendImages(lot: AtgLotSnapshot, link: AtgLotLink): Promise<void> {
    const sent = [...link.imageNames];
    try {
      for (const [index, url] of resolveLotImageUrls(lot, this.config).entries()) {
        const name = gapImageName(index);
        if (sent.includes(name)) continue;
        await this.gateway.addLotImageUrl({ LotId: link.atgLotId, ImageName: name, Url: url });
        sent.push(name);
      }
    } finally {
      if (sent.length !== link.imageNames.length) {
        await this.store.updateLotLink(lot.id, { imageNames: sent });
      }
    }
  }
}
