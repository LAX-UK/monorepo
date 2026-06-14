import type { Bid, Lot } from "@auction/types";
import {
  listAllowedAutoBidSteps,
  numberToMinorUnits,
  parseMoneyToMinorUnits,
  validateAutoBidStepAmount,
} from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import { lotMinIncrementMoney, minBidAmountMoney, numberToMoneyString } from "./bid/bid-money.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IBidPlacer } from "./interfaces/place-bid.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { NotificationService } from "./notification.service.js";

function minNextBidAmountMoney(lot: Lot): string {
  const increment = lotMinIncrementMoney(lot);
  return minBidAmountMoney(lot.currentPrice, increment);
}

export type AutoBidSettings = {
  maxAutoBidAmount: string;
  autoBidStepAmount: string | null;
  isActive: boolean;
};

export type AutoBidServiceOptions = {
  repos: IRepositoryFactory;
  bidPlacer: IBidPlacer;
  bidPlacerWithIdempotency?: IBidPlacer & {
    placeBidWithIdempotency(input: {
      placedByUserId: string;
      buyerLegalEntityId?: string;
      idempotencyKey?: string;
      lotId: string;
      amount: number;
      maxAutoBidAmount?: number;
      autoBidStepAmount?: number;
      placedVia?: string;
    }): Promise<
      | { type: "ok"; body: { data: Bid } }
      | { type: "replay"; body: { data: Bid } }
      | { type: "err"; error: BidError }
    >;
  };
  bidEligibility: IBidEligibility | null;
  legalEntityRepository: ILegalEntityRepository;
  notifications?: NotificationService | null;
};

export class AutoBidService {
  constructor(private readonly opts: AutoBidServiceOptions) {}

  async getAutoBid(input: {
    lotId: string;
    placedByUserId: string;
  }): Promise<Result<AutoBidSettings | null, BidError>> {
    const lot = await this.opts.repos.root.lot.findById(input.lotId);
    if (!lot) return err(new BidError("Lot not found", 404));
    const settings = await this.opts.repos.root.bid.findProxySettingsForBidderOnLot(
      input.lotId,
      input.placedByUserId,
    );
    if (!settings) return ok(null);
    return ok({
      maxAutoBidAmount: settings.maxAutoBidAmount,
      autoBidStepAmount: settings.autoBidStepAmount,
      isActive: true,
    });
  }

  async setAutoBid(input: {
    lotId: string;
    placedByUserId: string;
    buyerLegalEntityId: string;
    maxAutoBidAmount: number;
    autoBidStepAmount: number;
    idempotencyKey?: string;
  }): Promise<Result<Bid | AutoBidSettings, BidError>> {
    const lot = await this.opts.repos.root.lot.findById(input.lotId);
    if (!lot) return err(new BidError("Lot not found", 404));
    if (lot.status !== "active") {
      return err(new BidError("Lot is not accepting bids", 400));
    }
    if (lot.auctionType !== "english" && lot.auctionType !== "buy_it_now") {
      return err(new BidError("Auto-bid is only available on English and buy-it-now lots", 400));
    }
    if (lot.autoBidEnabled === false) {
      return err(new BidError("Auto-bid is not enabled for this lot", 403, "auto_bid_disabled"));
    }

    const stepErr = validateAutoBidStepAmount(
      {
        autoBidEnabled: lot.autoBidEnabled ?? true,
        minBidIncrement: lot.minBidIncrement,
        autoBidStepMin: lot.autoBidStepMin ?? null,
        autoBidStepMax: lot.autoBidStepMax ?? null,
        autoBidStepPresets: lot.autoBidStepPresets ?? null,
      },
      input.autoBidStepAmount,
    );
    if (stepErr) {
      return err(new BidError(stepErr, 400, "auto_bid_step_invalid"));
    }

    const minNextMoney = minNextBidAmountMoney(lot);
    const maxMinor = numberToMinorUnits(input.maxAutoBidAmount);
    const minNextMinor = parseMoneyToMinorUnits(minNextMoney);
    if (maxMinor < minNextMinor) {
      return err(
        new BidError(`Max auto-bid must be at least ${minNextMoney} (next minimum bid)`, 400),
      );
    }

    if (this.opts.bidEligibility) {
      const elig = await this.opts.bidEligibility.assertCanPlaceBid({
        placedByUserId: input.placedByUserId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        lotId: input.lotId,
        amount: Number.parseFloat(minNextMoney),
        maxAutoBidAmount: input.maxAutoBidAmount,
        autoBidStepAmount: input.autoBidStepAmount,
      });
      if (elig.isErr()) return err(elig.error);
    }

    const winning = await this.opts.repos.root.bid.findWinningBid(input.lotId);
    const winnerUserId = winning?.placedByUserId ?? winning?.bidderId ?? null;
    const maxStr = numberToMoneyString(input.maxAutoBidAmount);
    const stepStr = numberToMoneyString(input.autoBidStepAmount);
    const minNext = Number.parseFloat(minNextMoney);

    if (winnerUserId === input.placedByUserId) {
      await this.opts.repos.runInTransaction(async ({ lot: lots, bid: bids }) => {
        const lotRow = await lots.findByIdForUpdate(input.lotId);
        if (!lotRow || lotRow.status !== "active") {
          throw new BidError("Lot is not accepting bids", 400);
        }
        await bids.updateProxySettingsForBidderOnLot(input.lotId, input.placedByUserId, {
          maxAutoBidAmount: maxStr,
          autoBidStepAmount: stepStr,
        });
      });
      return ok({
        maxAutoBidAmount: maxStr,
        autoBidStepAmount: stepStr,
        isActive: true,
      });
    }

    const result = this.opts.bidPlacerWithIdempotency
      ? await this.opts.bidPlacerWithIdempotency.placeBidWithIdempotency({
          placedByUserId: input.placedByUserId,
          ...(input.buyerLegalEntityId ? { buyerLegalEntityId: input.buyerLegalEntityId } : {}),
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
          lotId: input.lotId,
          amount: minNext,
          maxAutoBidAmount: input.maxAutoBidAmount,
          autoBidStepAmount: input.autoBidStepAmount,
          placedVia: "web",
        })
      : null;

    if (result) {
      if (result.type === "err") return err(result.error);
      return ok(result.body.data);
    }

    const legacy = await this.opts.bidPlacer.placeBid({
      placedByUserId: input.placedByUserId,
      buyerLegalEntityId: input.buyerLegalEntityId,
      lotId: input.lotId,
      amount: minNext,
      maxAutoBidAmount: input.maxAutoBidAmount,
      autoBidStepAmount: input.autoBidStepAmount,
      placement: { placedVia: "web" },
    });
    if (legacy.isErr()) return err(legacy.error);
    return ok(legacy.value);
  }

  async clearAutoBid(input: {
    lotId: string;
    placedByUserId: string;
  }): Promise<Result<{ cleared: number }, BidError>> {
    const lot = await this.opts.repos.root.lot.findById(input.lotId);
    if (!lot) return err(new BidError("Lot not found", 404));
    const cleared = await this.opts.repos.root.bid.clearProxyAutoBidForBidderOnLot(
      input.lotId,
      input.placedByUserId,
    );
    if (cleared > 0 && this.opts.notifications) {
      void this.opts.notifications.notifyProxyCancelled(
        input.lotId,
        input.placedByUserId,
        "user_cleared",
      );
    }
    return ok({ cleared });
  }

  /** Allowed step options for buyer UI. */
  listAllowedSteps(lot: Lot): number[] {
    return listAllowedAutoBidSteps({
      autoBidEnabled: lot.autoBidEnabled ?? true,
      minBidIncrement: lot.minBidIncrement,
      autoBidStepMin: lot.autoBidStepMin ?? null,
      autoBidStepMax: lot.autoBidStepMax ?? null,
      autoBidStepPresets: lot.autoBidStepPresets ?? null,
    });
  }
}
