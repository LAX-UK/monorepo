import { canPushOrPublishSaleOnAtg, resolveSaleSellingPlatform } from "@auction/types";
import { type AtgGateway, AtgGatewayError } from "./atg-gateway.js";
import { type AtgImageInspector, atgImageProblem } from "./atg-image-inspector.js";
import {
  AtgMappingError,
  bidLockedFieldsHash,
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
  imageInspector: AtgImageInspector;
  config: AtgSyncConfig;
  now?: () => Date;
  /** Per-sale tick failure; the tick carries on with the next sale. */
  onTickError?: (saleId: string, err: unknown) => void;
};

const POLL_CLOSED_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isRetryable(err: unknown): boolean {
  return err instanceof AtgGatewayError && err.retryable;
}

/**
 * A timeout or 5xx on create may still have created the auction; GAP offers no lookup by our
 * sale id, so retrying blindly risks a duplicate. 425/429 are rejected before processing.
 */
function mayHaveCreated(err: unknown): boolean {
  return (
    isRetryable(err) &&
    (err as AtgGatewayError).status !== 429 &&
    (err as AtgGatewayError).status !== 425
  );
}

const MAX_LISTED_FAILURES = 5;

function failureSummary(failures: string[]): string | null {
  if (failures.length === 0) return null;
  const listed = failures.slice(0, MAX_LISTED_FAILURES).join("; ");
  const more = failures.length - MAX_LISTED_FAILURES;
  return more > 0 ? `${listed}; +${more} more` : listed;
}

const SALE_ON_LAX_MESSAGE =
  "This sale is published on lax.bid. Unpublish it there before pushing to ATG.";

export const AWAITING_ATG_APPROVAL_MESSAGE =
  "ATG did not publish the auction. ATG staff must approve it in Toolbox first; once they confirm, publish again.";

const BID_LOCKED_MESSAGE =
  "The lot has bids on ATG, so its description, reserve, estimates and opening price can't change. Undo the edit in LAX.";

/** ATG staff approve every auction; until then `PublishAuction` is rejected (not retryable). */
function publishErrorText(err: unknown): string {
  if (err instanceof AtgGatewayError && !err.retryable) {
    return `${AWAITING_ATG_APPROVAL_MESSAGE} (${err.message})`;
  }
  return errorText(err);
}

/**
 * Pushes LAX sales to ATG and pulls results back. Every operation is idempotent: link rows
 * record what ATG already has, and payload hashes skip unchanged updates, so jobs can be
 * retried safely.
 */
export class AtgSyncService {
  private readonly gateway: AtgGateway;
  private readonly store: AtgSyncStore;
  private readonly imageInspector: AtgImageInspector;
  private readonly config: AtgSyncConfig;
  private readonly now: () => Date;
  private readonly onTickError: ((saleId: string, err: unknown) => void) | undefined;

  constructor(deps: AtgSyncServiceDeps) {
    this.gateway = deps.gateway;
    this.store = deps.store;
    this.imageInspector = deps.imageInspector;
    this.config = deps.config;
    this.now = deps.now ?? (() => new Date());
    this.onTickError = deps.onTickError;
  }

  async pushSale(saleId: string): Promise<AtgPushSummary> {
    return (await this.push(saleId)).summary;
  }

  private async push(saleId: string): Promise<{ summary: AtgPushSummary; failures: string[] }> {
    const startedAt = this.now();
    const sale = await this.store.loadSale(saleId);
    if (!sale) throw new AtgSyncPreconditionError(`Sale ${saleId} not found`);

    const existing = await this.store.getAuctionLink(saleId);
    if (existing?.remoteStatus === "closed") {
      throw new AtgSyncPreconditionError("ATG auction is closed; it can no longer be updated");
    }
    if (sale.cancelled) {
      const message = "Sale is cancelled in LAX, so it is no longer pushed. Close it on ATG.";
      if (existing) {
        await this.store.saveAuctionLink(saleId, { lastSyncedAt: startedAt, lastError: message });
      }
      throw new AtgSyncPreconditionError(message);
    }
    await this.assertCanPushToAtg(saleId);

    let auction: { auctionId: string; created: boolean };
    try {
      auction = await this.upsertAuction(sale, existing);
    } catch (err) {
      await this.store.saveAuctionLink(saleId, { lastError: errorText(err) });
      throw err;
    }

    let result: { summary: AtgPushSummary; failures: string[] };
    try {
      result = await this.syncLots(sale, auction.auctionId, auction.created);
    } catch (err) {
      if (err instanceof AtgGatewayError) {
        await this.store.saveAuctionLink(saleId, { lastError: errorText(err) });
      }
      throw err;
    }
    await this.store.saveAuctionLink(saleId, {
      lastSyncedAt: startedAt,
      lastError: failureSummary(result.failures),
    });
    return result;
  }

  async publishSale(saleId: string): Promise<void> {
    const { summary, failures } = await this.push(saleId);
    if (summary.failed > 0) {
      const message = `Not published: fix these lots first. ${failureSummary(failures)}`;
      await this.store.saveAuctionLink(saleId, { lastError: message });
      throw new AtgSyncPreconditionError(message);
    }
    const link = await this.requireAuction(saleId);
    if (link.remoteStatus === "published") return;
    await this.assertCanPushToAtg(saleId);
    try {
      await this.gateway.publishAuction(link.atgAuctionId);
    } catch (err) {
      await this.store.saveAuctionLink(saleId, { lastError: publishErrorText(err) });
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
    const priorError = link.lastError;
    try {
      const [lots, results] = await Promise.all([
        this.gateway.getLots(link.atgAuctionId),
        this.gateway.getSaleResults(link.atgAuctionId),
      ]);
      await this.store.applyRemoteLots(saleId, lots, polledAt);
      await this.store.saveAuctionLink(saleId, {
        lastPolledAt: polledAt,
        resultsSnapshot: results,
        ...(priorError?.startsWith("Poll failed:") ? { lastError: null } : {}),
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
        const ownership = await this.store.loadOwnershipState(link.saleId);
        const platform = ownership
          ? resolveSaleSellingPlatform({
              saleStatus: ownership.saleStatus,
              atgRemoteStatus: ownership.atgRemoteStatus,
              atgLinked: ownership.atgLinked,
              atgSoldLotCount: ownership.atgSoldLotCount,
            })
          : "free";
        if (
          link.remoteStatus !== "closed" &&
          canPushOrPublishSaleOnAtg(platform) &&
          (!link.lastSyncedAt ||
            link.lastError ||
            (await this.store.hasCatalogueChangesSince(link.saleId, link.lastSyncedAt)))
        ) {
          await this.pushSale(link.saleId);
          pushed += 1;
        }
        if (link.remoteStatus === "published" || link.remoteStatus === "closed") {
          await this.pollSale(link.saleId);
          polled += 1;
        }
      } catch (err) {
        failed += 1;
        this.onTickError?.(link.saleId, err);
      }
    }
    return { pushed, polled, failed };
  }

  private async assertCanPushToAtg(saleId: string): Promise<void> {
    const ownership = await this.store.loadOwnershipState(saleId);
    if (!ownership) {
      throw new AtgSyncPreconditionError(`Sale ${saleId} not found`);
    }
    const platform = resolveSaleSellingPlatform({
      saleStatus: ownership.saleStatus,
      atgRemoteStatus: ownership.atgRemoteStatus,
      atgLinked: ownership.atgLinked,
      atgSoldLotCount: ownership.atgSoldLotCount,
    });
    if (platform === "lax") {
      throw new AtgSyncPreconditionError(SALE_ON_LAX_MESSAGE);
    }
  }

  private async requireAuction(saleId: string): Promise<AtgAuctionLink & { atgAuctionId: string }> {
    const link = await this.store.getAuctionLink(saleId);
    if (!link?.atgAuctionId) {
      throw new AtgSyncPreconditionError("Sale has not been pushed to ATG yet");
    }
    return { ...link, atgAuctionId: link.atgAuctionId };
  }

  private async upsertAuction(
    sale: AtgSaleSnapshot,
    link: AtgAuctionLink | null,
  ): Promise<{ auctionId: string; created: boolean }> {
    const fields = mapSaleToAuctionFields(sale, this.config);
    const hash = payloadHash(fields);
    if (!link?.atgAuctionId) {
      let auctionId: string;
      try {
        ({ auctionId } = await this.gateway.createAuction(fields));
      } catch (err) {
        if (!mayHaveCreated(err)) throw err;
        throw new AtgSyncPreconditionError(
          `ATG did not confirm the new auction (${errorText(err)}). Check the ATG admin for "${sale.title}" before pushing again, to avoid a duplicate.`,
        );
      }
      await this.store.saveAuctionLink(sale.id, {
        atgAuctionId: auctionId,
        atgAuctionReference: sale.id,
        remoteStatus: "created",
        payloadHash: hash,
      });
      return { auctionId, created: true };
    }
    if (link.payloadHash !== hash) {
      await this.gateway.updateAuction({ ...fields, AuctionId: link.atgAuctionId });
      await this.store.saveAuctionLink(sale.id, { payloadHash: hash });
    }
    return { auctionId: link.atgAuctionId, created: false };
  }

  private async syncLots(
    sale: AtgSaleSnapshot,
    auctionId: string,
    auctionJustCreated: boolean,
  ): Promise<{ summary: AtgPushSummary; failures: string[] }> {
    const summary: AtgPushSummary = { created: 0, updated: 0, unchanged: 0, deleted: 0, failed: 0 };
    const failures: string[] = [];
    const links = new Map((await this.store.listLotLinks(sale.id)).map((l) => [l.lotId, l]));
    let retryableFailures = 0;
    const recordFailure = async (label: string, lotId: string, err: unknown) => {
      summary.failed += 1;
      if (isRetryable(err)) retryableFailures += 1;
      failures.push(`${label}: ${errorText(err)}`);
      await this.store.updateLotLink(lotId, { lastError: errorText(err) });
    };

    const unlinked = sale.lots.filter((lot) => !links.has(lot.id));
    const blocked = new Set<string>();
    // A lot moved here from another ATG-linked sale still has a lot on the old auction.
    for (const stray of await this.store.findLotLinks(unlinked.map((lot) => lot.id))) {
      try {
        await this.gateway.deleteLot(stray.atgLotId);
        await this.store.deleteLotLink(stray.lotId);
      } catch (err) {
        if (!(err instanceof AtgGatewayError)) throw err;
        blocked.add(stray.lotId);
        await recordFailure(`Moved lot ${stray.atgLotId}`, stray.lotId, err);
      }
    }
    const adoptable =
      !auctionJustCreated && unlinked.some((lot) => lot.lotNumber != null)
        ? await this.unlinkedRemoteLotsByNumber(auctionId, links)
        : new Map<string, string>();

    for (const [index, lot] of sale.lots.entries()) {
      const link = links.get(lot.id);
      links.delete(lot.id);
      if (blocked.has(lot.id)) continue;
      let adoptAtgLotId: string | undefined;
      if (!link && lot.lotNumber != null) {
        adoptAtgLotId = adoptable.get(String(lot.lotNumber));
        adoptable.delete(String(lot.lotNumber));
      }
      try {
        const outcome = await this.syncLot(sale, lot, index + 1, auctionId, link, adoptAtgLotId);
        summary[outcome] += 1;
      } catch (err) {
        if (!(err instanceof AtgGatewayError || err instanceof AtgMappingError)) throw err;
        await recordFailure(`Lot ${lot.lotNumber ?? `"${lot.title}"`}`, lot.id, err);
      }
    }

    for (const orphan of links.values()) {
      try {
        await this.gateway.deleteLot(orphan.atgLotId);
        await this.store.deleteLotLink(orphan.lotId);
        summary.deleted += 1;
      } catch (err) {
        if (!(err instanceof AtgGatewayError)) throw err;
        await recordFailure(`Removed lot ${orphan.atgLotId}`, orphan.lotId, err);
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

  /**
   * ATG lots on this auction that no LAX lot is linked to, keyed by lot number. They exist when
   * a create succeeded on ATG but the response was lost; adopting them avoids duplicates.
   */
  private async unlinkedRemoteLotsByNumber(
    auctionId: string,
    links: Map<string, AtgLotLink>,
  ): Promise<Map<string, string>> {
    const linked = new Set([...links.values()].map((l) => l.atgLotId));
    const byNumber = new Map<string, string>();
    for (const remote of await this.gateway.getLots(auctionId)) {
      if (remote.lotNumber && !linked.has(remote.atgLotId) && !byNumber.has(remote.lotNumber)) {
        byNumber.set(remote.lotNumber, remote.atgLotId);
      }
    }
    return byNumber;
  }

  private async syncLot(
    sale: AtgSaleSnapshot,
    lot: AtgLotSnapshot,
    sequence: number,
    auctionId: string,
    link: AtgLotLink | undefined,
    adoptAtgLotId: string | undefined,
  ): Promise<"created" | "updated" | "unchanged"> {
    const fields = { ...mapLotToLotFields(lot, sale, sequence, this.config), AuctionId: auctionId };
    const hash = payloadHash(fields);
    const lockedHash = bidLockedFieldsHash(fields);
    let outcome: "created" | "updated" | "unchanged" = "unchanged";
    let current = link;

    await this.assertImagesAccepted(lot, current);
    // Locked fields are re-sent unchanged rather than omitted: UpdateLot replacement semantics
    // are unconfirmed, and a rejected request is safer than a silently cleared field.
    if (
      current &&
      current.numberOfBids > 0 &&
      current.payloadHash !== hash &&
      current.lockedFieldsHash !== lockedHash
    ) {
      throw new AtgMappingError(BID_LOCKED_MESSAGE);
    }

    if (!current) {
      let atgLotId: string;
      if (adoptAtgLotId) {
        await this.gateway.updateLot({ ...fields, LotId: adoptAtgLotId });
        atgLotId = adoptAtgLotId;
      } else {
        ({ lotId: atgLotId } = await this.gateway.createLot(fields));
      }
      await this.store.insertLotLink({
        lotId: lot.id,
        saleId: sale.id,
        atgLotId,
        payloadHash: hash,
        lockedFieldsHash: lockedHash,
      });
      current = {
        lotId: lot.id,
        saleId: sale.id,
        atgLotId,
        imageNames: [],
        payloadHash: hash,
        lockedFieldsHash: lockedHash,
        numberOfBids: 0,
      };
      outcome = adoptAtgLotId ? "updated" : "created";
    } else if (current.payloadHash !== hash) {
      await this.gateway.updateLot({ ...fields, LotId: current.atgLotId });
      outcome = "updated";
    }

    await this.sendImages(lot, current);
    await this.store.updateLotLink(lot.id, {
      payloadHash: hash,
      lockedFieldsHash: lockedHash,
      lastSyncedAt: this.now(),
      lastError: null,
    });
    return outcome;
  }

  /** Checks images not yet on ATG before any lot write, so failures name the lot and image. */
  private async assertImagesAccepted(lot: AtgLotSnapshot, link: AtgLotLink | undefined) {
    const sent = new Set(link?.imageNames ?? []);
    const problems: string[] = [];
    for (const [index, url] of resolveLotImageUrls(lot, this.config).entries()) {
      if (sent.has(gapImageName(index))) continue;
      const problem = atgImageProblem(await this.imageInspector.inspect(url));
      if (problem) problems.push(`image ${index + 1} ${problem}`);
    }
    if (problems.length > 0) {
      throw new AtgMappingError(`ATG can't take this lot's images: ${problems.join("; ")}`);
    }
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
