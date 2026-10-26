import { type AtgGateway, AtgGatewayError } from "./atg-gateway.js";
import { type AtgImageInspector, atgImageProblem } from "./atg-image-inspector.js";
import {
  AtgMappingError,
  bidLockedFieldsHash,
  gapImageName,
  mapLotToLotFields,
  payloadHash,
  resolveLotImageUrls,
} from "./atg-mappers.js";
import { errorText, failureSummary, isRetryable } from "./atg-sync-errors.js";
import type { AtgSyncStore } from "./atg-sync-store.js";
import type {
  AtgLotLink,
  AtgLotSnapshot,
  AtgPushSummary,
  AtgSaleSnapshot,
  AtgSyncConfig,
} from "./atg-types.js";

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

export type AtgLotSyncerDeps = {
  gateway: AtgGateway;
  store: AtgSyncStore;
  imageInspector: AtgImageInspector;
  config: AtgSyncConfig;
  now?: () => Date;
};

const BID_LOCKED_MESSAGE =
  "The lot has bids on ATG, so its description, reserve, estimates and opening price can't change. Undo the edit in LAX.";

/**
 * Brings the lots of one sale in line with ATG: creates, updates, adopts and deletes lots and
 * appends images. Per-lot failures are collected rather than thrown, so one bad lot never
 * blocks the rest; transient ones surface as `AtgPartialSyncError` so the job retries.
 */
export class AtgLotSyncer {
  private readonly gateway: AtgGateway;
  private readonly store: AtgSyncStore;
  private readonly imageInspector: AtgImageInspector;
  private readonly config: AtgSyncConfig;
  private readonly now: () => Date;

  constructor(deps: AtgLotSyncerDeps) {
    this.gateway = deps.gateway;
    this.store = deps.store;
    this.imageInspector = deps.imageInspector;
    this.config = deps.config;
    this.now = deps.now ?? (() => new Date());
  }

  async syncLots(
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
