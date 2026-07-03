import type { Lot } from "@auction/types";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { IRepositoryFactory } from "../interfaces/repository-factory.js";
import type { ISaleroomSessionLookup } from "../interfaces/saleroom-session-lookup.js";
import type { ClerkLotOutcomeService } from "./clerk-lot-outcome.service.js";
import type { LotLifecycleNotificationCoordinator } from "./lot-lifecycle-notification.coordinator.js";

/** Scheduled status transitions (scheduled→active, active→ended), Dutch price decrements, and single-lot job hooks. */
export class TimedLotTransitionRunner {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly notifications: LotLifecycleNotificationCoordinator,
    private readonly clerkOutcomes: ClerkLotOutcomeService,
    private readonly saleroomSessionLookup: ISaleroomSessionLookup | null = null,
    private readonly lotLifecycleRecording: ILotLifecycleRecorder | null = null,
    /** Optional hook after a lot transitions to `active` (e.g. absentee replay). */
    private readonly onLotActivated: ((lotId: string) => Promise<void>) | null = null,
  ) {}

  private async shouldSkipTimedCloseForLot(lotId: string): Promise<boolean> {
    if (!this.saleroomSessionLookup) return false;
    return this.saleroomSessionLookup.isLotUnderLiveClerkSession(lotId);
  }

  async runDutchDecrements(now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const dutch = await lots.findActiveDutchLots();
    for (const a of dutch) {
      const intervalMs = a.dutchDecrementIntervalMs;
      const lastMs = a.dutchLastDecrementAt?.getTime() ?? a.startTime.getTime();
      if (now.getTime() - lastMs < intervalMs) continue;

      const decDefault = Math.max(0.01, Number(a.startingPrice) * 0.01);
      const dec =
        a.dutchDecrementAmount !== null && a.dutchDecrementAmount !== ""
          ? Number(a.dutchDecrementAmount)
          : decDefault;
      const safeDec = Number.isFinite(dec) && dec > 0 ? dec : decDefault;

      const floor =
        a.reservePrice !== null && a.reservePrice !== "" ? Number(a.reservePrice) : 0.01;
      const safeFloor = Number.isFinite(floor) && floor > 0 ? floor : 0.01;

      const cur = Number(a.currentPrice);
      if (!Number.isFinite(cur)) continue;
      const next = Math.max(safeFloor, cur - safeDec);
      if (next >= cur - 1e-9) continue;

      const expected = a.currentPrice;
      const nextStr = next.toFixed(2);
      await lots.updateDutchCurrentPriceIfMatch(a.id, expected, nextStr, now);
    }
  }

  async runTransitions(now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const toActivate = await lots.findScheduledToActivate(now);
    for (const a of toActivate) {
      await this.repos.runInTransaction(async ({ lot }, tx) => {
        const row = await lot.findByIdForUpdate(a.id);
        if (!row || row.status !== "scheduled" || row.startTime > now) return;
        await lot.updateStatus(a.id, "active");
        if (a.auctionType === "dutch") {
          await lot.setDutchLastDecrementAt(a.id, now);
        }
        if (this.lotLifecycleRecording) {
          await this.lotLifecycleRecording.recordActivated(tx, row, now);
        }
      });
      await this.notifications.notifyWatchlistStarting(a);
      await this.onLotActivated?.(a.id);
    }

    await this.runDutchDecrements(now);

    await this.notifications.notifyEndingSoonBuckets(now);

    const toEnd = await lots.findActivePastEnd(now);
    for (const a of toEnd) {
      await this.finalizeLotEnding(a, now);
    }
  }

  /** Idempotent activation for delayed jobs. */
  async processActivateJob(lotId: string, now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "scheduled" || a.startTime > now) return;
    await this.repos.runInTransaction(async ({ lot }, tx) => {
      const row = await lot.findByIdForUpdate(lotId);
      if (!row || row.status !== "scheduled" || row.startTime > now) return;
      await lot.updateStatus(lotId, "active");
      if (a.auctionType === "dutch") {
        await lot.setDutchLastDecrementAt(a.id, now);
      }
      if (this.lotLifecycleRecording) {
        await this.lotLifecycleRecording.recordActivated(tx, row, now);
      }
    });
    await this.notifications.notifyWatchlistStarting(a);
    await this.onLotActivated?.(lotId);
  }

  /** Idempotent end for delayed jobs. */
  async processEndJob(lotId: string, now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "active" || a.endTime > now) return;
    if (await this.shouldSkipTimedCloseForLot(lotId)) return;
    await this.finalizeLotEnding(a, now);
  }

  private async finalizeLotEnding(a: Lot, now: Date): Promise<void> {
    if (await this.shouldSkipTimedCloseForLot(a.id)) return;
    await this.clerkOutcomes.finalizeTimedLotEnding(a, now);
  }
}
