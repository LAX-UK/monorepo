import {
  type AtgOwnershipState,
  canPushOrPublishSaleOnAtg,
  resolveSaleSellingPlatform,
} from "@auction/types";
import { type AtgGateway, AtgGatewayError } from "./atg-gateway.js";
import type { AtgImageInspector } from "./atg-image-inspector.js";
import { AtgLotSyncer, AtgPartialSyncError } from "./atg-lot-syncer.js";
import { mapSaleToAuctionFields, payloadHash } from "./atg-mappers.js";
import { errorText, failureSummary, isRetryable } from "./atg-sync-errors.js";
import type { AtgAuctionLinkPatch, AtgSyncStore } from "./atg-sync-store.js";
import type {
  AtgAuctionLink,
  AtgPushSummary,
  AtgSaleSnapshot,
  AtgSyncConfig,
} from "./atg-types.js";

export { AtgPartialSyncError };

/** A job that cannot succeed by retrying (missing sale, not linked yet, …). */
export class AtgSyncPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtgSyncPreconditionError";
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
/** How far back a lost create is searched for; a push that timed out is minutes old at most. */
const RECONCILE_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** A retry after an earlier failed create also searches this far back before creating again. */
const RETRY_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A timeout or 5xx on create may still have created the auction, so retrying blindly risks a
 * duplicate; the caller looks the auction up by our sale id first. 425/429 are rejected before
 * processing.
 */
function mayHaveCreated(err: unknown): boolean {
  return (
    isRetryable(err) &&
    (err as AtgGatewayError).status !== 429 &&
    (err as AtgGatewayError).status !== 425
  );
}

const SALE_ON_LAX_MESSAGE =
  "This sale is published on lax.bid. Unpublish it there before pushing to ATG.";

export const AWAITING_ATG_APPROVAL_MESSAGE =
  "ATG did not publish the auction. ATG staff must approve it in Toolbox first; once they confirm, publish again.";

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
  private readonly lotSyncer: AtgLotSyncer;
  private readonly config: AtgSyncConfig;
  private readonly now: () => Date;
  private readonly onTickError: ((saleId: string, err: unknown) => void) | undefined;

  constructor(deps: AtgSyncServiceDeps) {
    this.gateway = deps.gateway;
    this.store = deps.store;
    this.config = deps.config;
    this.now = deps.now ?? (() => new Date());
    this.lotSyncer = new AtgLotSyncer({
      gateway: deps.gateway,
      store: deps.store,
      imageInspector: deps.imageInspector,
      config: deps.config,
      now: this.now,
    });
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
      result = await this.lotSyncer.syncLots(sale, auction.auctionId, auction.created);
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
        const platform = (await this.sellingPlatform(link.saleId)) ?? "free";
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
        if (link.remoteStatus === "created" && canPushOrPublishSaleOnAtg(platform)) {
          await this.checkApproval(link);
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

  /** Who owns the sale's bidding right now; null when the sale no longer exists. */
  private async sellingPlatform(saleId: string): Promise<AtgOwnershipState | null> {
    const ownership = await this.store.loadOwnershipState(saleId);
    if (!ownership) return null;
    return resolveSaleSellingPlatform({
      saleStatus: ownership.saleStatus,
      atgRemoteStatus: ownership.atgRemoteStatus,
      atgLinked: ownership.atgLinked,
      atgSoldLotCount: ownership.atgSoldLotCount,
    });
  }

  /**
   * Asks ATG whether staff approved a pushed auction, and whether they already published it in
   * Toolbox. Only transitions are written, so a quiet tick costs one read.
   */
  private async checkApproval(link: AtgAuctionLink): Promise<void> {
    if (!link.atgAuctionId) return;
    const remote = await this.gateway.getAuction(link.atgAuctionId);
    if (!remote) return;
    const now = this.now();
    const patch: AtgAuctionLinkPatch = {
      ...(remote.isApproved && !link.approvedAt ? { approvedAt: now } : {}),
      ...(remote.isPublished
        ? { remoteStatus: "published" as const, publishedAt: now, lastError: null }
        : {}),
    };
    if (Object.keys(patch).length > 0) {
      await this.store.saveAuctionLink(link.saleId, patch);
    }
  }

  private async assertCanPushToAtg(saleId: string): Promise<void> {
    const platform = await this.sellingPlatform(saleId);
    if (!platform) {
      throw new AtgSyncPreconditionError(`Sale ${saleId} not found`);
    }
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

  /**
   * After a create whose reply was lost, looks for the auction ATG may have made, matched on the
   * `ClientsAuctionId` we sent (the sale id). Needs `ATG_CLIENT_ID`; `note` explains a miss.
   */
  private async findLostCreate(
    sale: AtgSaleSnapshot,
    lookbackMs = RECONCILE_LOOKBACK_MS,
  ): Promise<{ auctionId: string | null; note: string; lookupFailed: boolean }> {
    const clientId = this.config.clientId;
    if (!clientId) return { auctionId: null, note: "", lookupFailed: false };
    try {
      const fromDate = new Date(this.now().getTime() - lookbackMs);
      const found = (await this.gateway.findAuctionsByClientId(clientId, fromDate)).find(
        (auction) => auction.clientsAuctionId === sale.id,
      );
      if (found) return { auctionId: found.atgAuctionId, note: "", lookupFailed: false };
      return {
        auctionId: null,
        note: " ATG has no auction for this sale from the last day.",
        lookupFailed: false,
      };
    } catch (lookupError) {
      if (!(lookupError instanceof AtgGatewayError)) throw lookupError;
      return {
        auctionId: null,
        note: ` Looking for it on ATG also failed (${errorText(lookupError)}).`,
        lookupFailed: true,
      };
    }
  }

  private async upsertAuction(
    sale: AtgSaleSnapshot,
    link: AtgAuctionLink | null,
  ): Promise<{ auctionId: string; created: boolean }> {
    const fields = mapSaleToAuctionFields(sale, this.config);
    const hash = payloadHash(fields);
    if (!link?.atgAuctionId) {
      // An earlier push left an error and no auction id: its create may have reached ATG, so
      // adopt that auction instead of creating a duplicate. A failed lookup stops the push.
      if (link?.lastError && this.config.clientId) {
        const earlier = await this.findLostCreate(sale, RETRY_LOOKBACK_MS);
        if (earlier.lookupFailed) {
          throw new AtgSyncPreconditionError(
            `Couldn't check ATG for an earlier attempt at this auction (${earlier.note.trim()}). Try again shortly.`,
          );
        }
        if (earlier.auctionId) {
          await this.store.saveAuctionLink(sale.id, {
            atgAuctionId: earlier.auctionId,
            atgAuctionReference: sale.id,
            remoteStatus: "created",
            // Unknown remote payload: an empty hash forces the full update below.
            payloadHash: "",
          });
          return this.upsertAuction(sale, await this.store.getAuctionLink(sale.id));
        }
      }
      let auctionId: string;
      try {
        ({ auctionId } = await this.gateway.createAuction(fields));
      } catch (err) {
        if (!mayHaveCreated(err)) throw err;
        const adopted = await this.findLostCreate(sale);
        if (adopted.auctionId) {
          auctionId = adopted.auctionId;
        } else {
          throw new AtgSyncPreconditionError(
            `ATG did not confirm the new auction (${errorText(err)}).${adopted.note} Check the ATG admin for "${sale.title}" before pushing again, to avoid a duplicate.`,
          );
        }
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
}
