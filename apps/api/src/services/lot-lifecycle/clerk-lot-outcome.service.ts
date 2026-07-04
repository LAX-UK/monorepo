import type { IAntiShillingGuard } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type { Bid, Lot } from "@auction/types";
import { moneyGte } from "@auction/validators";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { LotLifecycleNotificationCoordinator } from "./lot-lifecycle-notification.coordinator.js";
import type { LotCloseOutcome } from "./lot-lifecycle-types.js";

export class ClerkLotOutcomeService {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly notifications: LotLifecycleNotificationCoordinator,
    private readonly antiShillingGuard: IAntiShillingGuard | null = null,
    private readonly domainEventPublisher: DomainEventPublisher | null = null,
    private readonly lotLifecycleRecording: ILotLifecycleRecorder | null = null,
  ) {}

  /** Same settlement rules as timed close, but ignores the auction clock (clerk hammer). */
  async finalizeActiveLotFromClerkHammer(
    lotId: string,
  ): Promise<{ winnerId: string | null; voided: boolean } | null> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "active") return null;
    const outcome = await this.runFinalizeLotTransaction(a, new Date(), true);
    if (!outcome) return null;
    await this.notifications.notifyBiddersAfterLotClose(a, outcome);
    return { winnerId: outcome.winnerId, voided: outcome.voided };
  }

  /** Clerk declares no sale: end the active lot without a winner (reserve not met / passed). */
  async noSaleEndActiveLotFromClerk(lotId: string): Promise<boolean> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "active") return false;
    const ok = await this.repos.runInTransaction(async ({ lot, bid }, tx) => {
      const row = await lot.findByIdForUpdate(lotId);
      if (!row || row.status !== "active") return false;
      await bid.clearWinningBid(lotId);
      await lot.updateStatus(lotId, "ended");
      if (this.lotLifecycleRecording) {
        await this.lotLifecycleRecording.recordEnded(tx, {
          lot: row,
          payload: {
            outcome: "no_sale",
            winnerId: null,
            saleId: row.saleId,
            trigger: "clerk_no_sale",
          },
        });
      }
      await this.notifications.stageLotCloseNotificationsInTransaction({
        lot: row,
        winnerId: null,
        bid,
        tx,
      });
      return true;
    });
    if (!ok) return false;
    const bids = this.repos.root.bid;
    const hadBids = (await bids.listForLotSettlement(lotId, 1)).length > 0;
    await this.notifications.notifyBiddersAfterLotClose(a, {
      lotId,
      winnerId: null,
      voided: false,
      winningBid: null,
      trigger: "clerk_no_sale",
      hadBids,
    });
    return true;
  }

  /** Finalize all still-active lots on a sale (e.g. when saleroom session closes). */
  async finalizeActiveLotsPastEnd(saleId: string, now: Date = new Date()): Promise<number> {
    const lots = this.repos.root.lot;
    const saleLots = await lots.findBySaleId(saleId);
    let closed = 0;
    for (const a of saleLots) {
      if (a.status !== "active") continue;
      const outcome = await this.runFinalizeLotTransaction(a, now, true);
      if (outcome) {
        closed += 1;
        await this.notifications.notifyBiddersAfterLotClose(a, outcome);
      }
    }
    return closed;
  }

  /** Timed close settlement when end time has passed (respects auction clock). */
  async finalizeTimedLotEnding(a: Lot, now: Date): Promise<LotCloseOutcome | null> {
    const outcome = await this.runFinalizeLotTransaction(a, now, false);
    if (!outcome) return null;
    await this.notifications.notifyBiddersAfterLotClose(a, outcome);
    return outcome;
  }

  async runFinalizeLotTransaction(
    a: Lot,
    now: Date,
    ignoreEndTime: boolean,
  ): Promise<LotCloseOutcome | null> {
    return this.repos.runInTransaction(async ({ lot, bid }, tx) => {
      const row = await lot.findByIdForUpdate(a.id);
      if (!row || row.status !== "active") {
        return null;
      }
      if (!ignoreEndTime && row.endTime > now) {
        return null;
      }
      const bidsList = await bid.listForLotSettlement(row.id, 10_000);
      const ordered =
        row.auctionType === "dutch"
          ? [...bidsList].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
          : bidsList;

      const meetsReserve = (b: Bid) =>
        !row.reservePrice || row.reservePrice === "" || moneyGte(b.amount, row.reservePrice);

      const reserveMet = ordered.filter((b) =>
        Boolean(b.placedByUserId && b.buyerLegalEntityId && meetsReserve(b)),
      );

      let chosen: Bid | undefined;
      if (reserveMet.length === 0) {
        chosen = undefined;
      } else if (!this.antiShillingGuard) {
        chosen = reserveMet[0];
      } else {
        const sqlEligible = await bid.findEligibleBidsForLotClose(row.id, {
          sellerLegalEntityId: row.sellerLegalEntityId ?? null,
          reservePrice: row.reservePrice ?? null,
          sort: row.auctionType === "dutch" ? "dutch" : "english",
        });
        chosen = sqlEligible[0];
      }

      let winnerId: string | null = null;
      let voided = false;

      if (chosen?.placedByUserId && chosen.buyerLegalEntityId) {
        await lot.setWinner(row.id, chosen.placedByUserId, chosen.buyerLegalEntityId);
        winnerId = chosen.placedByUserId;
      } else if (reserveMet.length > 0 && this.antiShillingGuard && !chosen) {
        await lot.voidLotAntiShillingClose(row.id);
        voided = true;
        if (this.lotLifecycleRecording) {
          await this.lotLifecycleRecording.recordVoided(tx, row, "no_valid_winner");
        } else if (this.domainEventPublisher) {
          await this.domainEventPublisher.publish(tx, {
            aggregateType: "lot",
            aggregateId: row.id,
            eventType: "lot.voided",
            payload: { reason: "no_valid_winner", lotId: row.id },
            actorUserId: null,
            actingLegalEntityId: row.sellerLegalEntityId ?? null,
            schemaVersion: 1,
            producer: "apps/api",
          });
        }
      }

      if (!voided) {
        if (!winnerId) {
          await bid.clearWinningBid(row.id);
        }
        await lot.updateStatus(row.id, "ended");
        if (this.lotLifecycleRecording) {
          await this.lotLifecycleRecording.recordEnded(tx, {
            lot: row,
            payload: {
              outcome: winnerId ? "sold" : "no_sale",
              winnerId,
              saleId: row.saleId,
              trigger: ignoreEndTime ? "clerk_hammer" : "timed",
              hammerPrice: chosen?.amount ?? null,
            },
          });
        }
        await this.notifications.stageLotCloseNotificationsInTransaction({
          lot: row,
          winnerId,
          bid,
          tx,
        });
      }
      return {
        lotId: row.id,
        winnerId,
        voided,
        winningBid: chosen ?? null,
        trigger: ignoreEndTime ? "clerk_hammer" : "timed",
        hadBids: bidsList.length > 0,
      };
    });
  }
}
