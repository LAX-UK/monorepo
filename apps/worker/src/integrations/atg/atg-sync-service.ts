import {
  type AtgOwnershipState,
  canPushOrPublishSaleOnAtg,
  resolveSaleSellingPlatform,
} from "@auction/types";
import { joinMessages, withFeeMismatch, withoutFeeMismatch } from "./atg-fee-check.js";
import { AtgFeeVerifier } from "./atg-fee-verifier.js";
import { type AtgGateway, AtgGatewayError } from "./atg-gateway.js";
import type { AtgImageInspector } from "./atg-image-inspector.js";
import { AtgLotSyncer, AtgPartialSyncError } from "./atg-lot-syncer.js";
import { AtgMappingError, mapSaleToAuctionFields, payloadHash } from "./atg-mappers.js";
import type { AtgSoldRegisterRecorder } from "./atg-sold-register.js";
import { errorText, failureSummary, isRetryable } from "./atg-sync-errors.js";
import type { AtgAuctionLinkPatch, AtgSyncStore } from "./atg-sync-store.js";
import type {
  AtgAuctionLink,
  AtgPushSummary,
  AtgSaleSnapshot,
  AtgSyncConfig,
} from "./atg-types.js";
import type { GapAuctionFields } from "./gap-types.js";

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
  /** ATG holds other fees than LAX sent; called once per distinct message, not every tick. */
  onFeeMismatch?: (saleId: string, message: string) => void;
  /** Moves the artwork register to sold for each lot ATG reports sold. */
  soldRegister?: AtgSoldRegisterRecorder;
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

/** What an upsert settled on: the auction, the fields LAX maps for it and whether they were sent. */
type UpsertedAuction = {
  auctionId: string;
  created: boolean;
  fields: GapAuctionFields;
  /** False when ATG already held these exact fields (payload hash unchanged). */
  sent: boolean;
};

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
  private readonly feeVerifier: AtgFeeVerifier;
  private readonly soldRegister: AtgSoldRegisterRecorder | undefined;
  /** Staff-fixable tick errors already sent to Sentry, so one that is never stored is not repeated. */
  private readonly reportedTickErrors = new Map<string, Set<string>>();

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
    this.soldRegister = deps.soldRegister;
    this.feeVerifier = new AtgFeeVerifier({
      gateway: deps.gateway,
      onMismatch: deps.onFeeMismatch,
    });
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
        await this.store.saveAuctionLink(saleId, {
          lastSyncedAt: startedAt,
          lastError: withFeeMismatch(existing.lastError, message),
        });
      }
      throw new AtgSyncPreconditionError(message);
    }
    await this.assertCanPushToAtg(saleId);

    let auction: UpsertedAuction;
    try {
      auction = await this.upsertAuction(sale, existing);
    } catch (err) {
      await this.saveError(saleId, errorText(err));
      throw err;
    }
    const feeMismatch = await this.feeVerifier.verify({
      saleId,
      auctionId: auction.auctionId,
      fields: auction.fields,
      justSent: auction.sent,
      priorError: existing?.lastError ?? null,
    });

    let result: { summary: AtgPushSummary; failures: string[] };
    try {
      result = await this.lotSyncer.syncLots(sale, auction.auctionId, auction.created);
    } catch (err) {
      if (err instanceof AtgGatewayError) {
        await this.store.saveAuctionLink(saleId, {
          lastError: joinMessages(feeMismatch, errorText(err)),
        });
      }
      throw err;
    }
    await this.store.saveAuctionLink(saleId, {
      lastSyncedAt: startedAt,
      lastError: joinMessages(feeMismatch, failureSummary(result.failures)),
    });
    return result;
  }

  /** Stores a failure on the link without hiding a fee mismatch that is still showing. */
  private async saveError(saleId: string, error: string): Promise<void> {
    const link = await this.store.getAuctionLink(saleId);
    await this.store.saveAuctionLink(saleId, {
      lastError: withFeeMismatch(link?.lastError, error),
    });
  }

  async publishSale(saleId: string): Promise<void> {
    const { summary, failures } = await this.push(saleId);
    if (summary.failed > 0) {
      const message = `Not published: fix these lots first. ${failureSummary(failures)}`;
      await this.saveError(saleId, message);
      throw new AtgSyncPreconditionError(message);
    }
    const link = await this.requireAuction(saleId);
    if (link.remoteStatus === "published") return;
    await this.assertCanPushToAtg(saleId);
    try {
      await this.gateway.publishAuction(link.atgAuctionId);
    } catch (err) {
      await this.saveError(saleId, publishErrorText(err));
      throw err;
    }
    await this.store.saveAuctionLink(saleId, {
      remoteStatus: "published",
      publishedAt: this.now(),
      lastError: withFeeMismatch(link.lastError, null),
    });
  }

  async closeSale(saleId: string): Promise<void> {
    const link = await this.requireAuction(saleId);
    if (link.remoteStatus !== "closed") {
      try {
        await this.gateway.closeAuction(link.atgAuctionId);
      } catch (err) {
        await this.saveError(saleId, errorText(err));
        throw err;
      }
      await this.store.saveAuctionLink(saleId, {
        remoteStatus: "closed",
        closedAt: this.now(),
        lastError: withFeeMismatch(link.lastError, null),
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
      await this.recordSoldLots(saleId);
      await this.store.saveAuctionLink(saleId, {
        lastPolledAt: polledAt,
        resultsSnapshot: results,
        ...(withoutFeeMismatch(priorError)?.startsWith("Poll failed:")
          ? { lastError: withFeeMismatch(priorError, null) }
          : {}),
      });
    } catch (err) {
      await this.saveError(saleId, `Poll failed: ${errorText(err)}`);
      throw err;
    }
  }

  /**
   * Tells the register about every lot ATG reports sold. Each poll repeats it, which is safe (the
   * register write is idempotent) and means a failed write is retried on the next poll. A failure
   * is reported, never allowed to fail the poll that already stored the results.
   */
  private async recordSoldLots(saleId: string): Promise<void> {
    const recorder = this.soldRegister;
    if (!recorder) return;
    for (const link of await this.store.listLotLinks(saleId)) {
      if (!link.sold) continue;
      try {
        await recorder.recordSold(link.lotId);
      } catch (err) {
        this.onTickError?.(saleId, err);
      }
    }
  }

  /**
   * Repeatable tick: re-pushes linked sales edited in LAX since their last sync, checks ATG
   * approval, then polls published and recently closed auctions. The three steps are
   * independent, so a failed push still lets a published auction be polled, and one failing
   * sale does not stop the others. `failed` counts sales with at least one failing step.
   */
  async tick(): Promise<{ pushed: number; polled: number; failed: number }> {
    const now = this.now();
    const links = await this.store.listActiveAuctionLinks(
      new Date(now.getTime() - POLL_CLOSED_FOR_MS),
    );
    const totals = { pushed: 0, polled: 0, failed: 0 };
    for (const link of links) {
      const outcome = await this.tickLink(link);
      totals.pushed += outcome.pushed ? 1 : 0;
      totals.polled += outcome.polled ? 1 : 0;
      totals.failed += outcome.failed ? 1 : 0;
    }
    return totals;
  }

  private async tickLink(
    link: AtgAuctionLink,
  ): Promise<{ pushed: boolean; polled: boolean; failed: boolean }> {
    const outcome = { pushed: false, polled: false, failed: false };
    const attempt = async (step: () => Promise<void>): Promise<boolean> => {
      try {
        await step();
        return true;
      } catch (err) {
        outcome.failed = true;
        this.reportTickError(link, err);
        return false;
      }
    };

    let platform: AtgOwnershipState | null = null;
    const resolved = await attempt(async () => {
      platform = await this.sellingPlatform(link.saleId);
    });
    if (!resolved) return outcome;
    // A sale row that is gone cannot be pushed; its ATG auction is still polled.
    const canPush = platform !== null && canPushOrPublishSaleOnAtg(platform);

    if (link.remoteStatus !== "closed" && canPush) {
      let due = false;
      const checked = await attempt(async () => {
        due = await this.needsPush(link);
      });
      if (checked && due) {
        outcome.pushed = await attempt(async () => {
          await this.pushSale(link.saleId);
        });
        // A fixed error that comes back later must be reported again.
        if (outcome.pushed) this.reportedTickErrors.delete(link.saleId);
      }
    }
    if (link.remoteStatus !== "closed" && canPush && !this.feeVerifier.hasVerified(link.saleId)) {
      await attempt(() => this.verifyFees(link.saleId));
    }
    if (link.remoteStatus === "created" && canPush) {
      await attempt(() => this.checkApproval(link));
    }
    if (link.remoteStatus === "published" || link.remoteStatus === "closed") {
      outcome.polled = await attempt(() => this.pollSale(link.saleId));
    }
    return outcome;
  }

  /**
   * Checks the fees of an auction that was pushed earlier (an unchanged one is never re-sent),
   * once per process: one read per auction after each worker start.
   */
  private async verifyFees(saleId: string): Promise<void> {
    const [sale, link] = await Promise.all([
      this.store.loadSale(saleId),
      this.store.getAuctionLink(saleId),
    ]);
    if (!sale || !link?.atgAuctionId || link.remoteStatus === "closed") return;
    let fields: GapAuctionFields;
    try {
      fields = mapSaleToAuctionFields(sale, this.config);
    } catch (err) {
      if (err instanceof AtgMappingError) return; // the push step shows this one
      throw err;
    }
    const message = await this.feeVerifier.verify({
      saleId,
      auctionId: link.atgAuctionId,
      fields,
      justSent: false,
      priorError: link.lastError,
    });
    const lastError = joinMessages(message, withoutFeeMismatch(link.lastError));
    if (lastError !== link.lastError) await this.store.saveAuctionLink(saleId, { lastError });
  }

  private async needsPush(link: AtgAuctionLink): Promise<boolean> {
    return (
      !link.lastSyncedAt ||
      Boolean(link.lastError) ||
      (await this.store.hasCatalogueChangesSince(link.saleId, link.lastSyncedAt))
    );
  }

  /**
   * Mapping and precondition errors are shown to staff on the sale's ATG tab through
   * `lastError`; they go to Sentry only when that message is new, not on every tick. Gateway and
   * other errors always go.
   */
  private reportTickError(link: AtgAuctionLink, err: unknown): void {
    const staffFixable = err instanceof AtgMappingError || err instanceof AtgSyncPreconditionError;
    if (staffFixable) {
      const text = errorText(err);
      const reported = this.reportedTickErrors.get(link.saleId) ?? new Set<string>();
      if (text === link.lastError || reported.has(text)) return;
      reported.add(text);
      this.reportedTickErrors.set(link.saleId, reported);
    }
    this.onTickError?.(link.saleId, err);
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
    // Earlier steps of this tick may have changed `lastError`; keep a fee mismatch it holds.
    const current = remote.isPublished ? await this.store.getAuctionLink(link.saleId) : null;
    const patch: AtgAuctionLinkPatch = {
      ...(remote.isApproved && !link.approvedAt ? { approvedAt: now } : {}),
      ...(remote.isPublished
        ? {
            remoteStatus: "published" as const,
            publishedAt: now,
            lastError: withFeeMismatch(current?.lastError ?? link.lastError, null),
          }
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
  ): Promise<UpsertedAuction> {
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
      return { auctionId, created: true, fields, sent: true };
    }
    const changed = link.payloadHash !== hash;
    if (changed) {
      await this.gateway.updateAuction({ ...fields, AuctionId: link.atgAuctionId });
      await this.store.saveAuctionLink(sale.id, { payloadHash: hash });
    }
    return { auctionId: link.atgAuctionId, created: false, fields, sent: changed };
  }
}
