import type { Database } from "@auction/db";
import type {
  IAntiShillingGuard,
  IBidRepository,
  ILotRepository,
  IRepositoryFactory,
  ISaleroomSessionLookup,
} from "@auction/persistence/interfaces";
import type { Bid, Lot } from "@auction/types";
import { BidError } from "../bid-error.js";
import { numberToMoneyString } from "../bid-money.js";
import type { BidPolicyConfig } from "../bid-policy.js";
import type { IDomainEventSink, ILotStrategyFactory, PlaceBidInput } from "../ports.js";
import type { BidCriticalNotificationStager } from "./bid-critical-notification.stager.js";
import { publishBidMilestoneDomainEvents } from "./bid-milestone-domain-events.js";
import type { BidNotificationCoordinator } from "./bid-notification.coordinator.js";
import type { EarlyCloseHandler } from "./early-close.handler.js";
import type { ProxyAutoBidResolver, ProxyCancelNotification } from "./proxy-auto-bid.resolver.js";
import type { SaleroomBidGate } from "./saleroom-bid.gate.js";

export type PlaceBidPipelineDeps = {
  strategyFactory: ILotStrategyFactory;
  saleroomBidGate: SaleroomBidGate;
  saleroomSessionLookup: ISaleroomSessionLookup | null;
  antiShillingGuard: IAntiShillingGuard | null;
  proxyResolver: ProxyAutoBidResolver;
  earlyCloseHandler: EarlyCloseHandler;
  criticalNotificationStager: BidCriticalNotificationStager;
  notificationCoordinator: BidNotificationCoordinator;
  repos: IRepositoryFactory;
  englishOnlyAuctions: boolean;
  bidPolicy: BidPolicyConfig;
  domainEventSink?: IDomainEventSink | null;
};

export type PlaceBidTxOutcome = {
  created: Bid;
  lot: Lot;
  nextEnd: Date;
  endedEarly: boolean;
};

export type PlaceBidInTransactionInput = PlaceBidInput & {
  pendingProxyCancels: ProxyCancelNotification[];
};

export async function validateLotForBid(
  deps: PlaceBidPipelineDeps,
  input: PlaceBidInTransactionInput,
  lots: ILotRepository,
  bids: IBidRepository,
  tx: Database,
): Promise<{ lotRow: Lot; prevWinnerId: string | null; prevWinningBid: Bid | null }> {
  const { placedByUserId, buyerLegalEntityId, lotId } = input;

  const lotRow = await lots.findByIdForUpdate(lotId);
  if (!lotRow) {
    throw new BidError("Lot not found", 404);
  }
  if (lotRow.status !== "active") {
    throw new BidError("Lot is not accepting bids", 400);
  }

  const skipCatalogEndTime =
    deps.saleroomSessionLookup != null &&
    (await deps.saleroomSessionLookup.shouldSkipAntiSnipeForLot(lotId));
  if (!skipCatalogEndTime && Date.now() > lotRow.endTime.getTime()) {
    throw new BidError("Lot has ended", 400);
  }

  const onBlock = await deps.saleroomBidGate.assertCanBidOnLot({
    lotId,
    saleId: lotRow.saleId,
    tx,
  });
  if (onBlock.isErr()) {
    throw onBlock.error;
  }

  const strategy = deps.strategyFactory.create(lotRow.auctionType);
  const selfService = strategy.validateSelfServiceAllowed?.(lotRow, deps.englishOnlyAuctions);
  if (selfService?.isErr()) {
    throw selfService.error;
  }

  if (
    deps.antiShillingGuard &&
    (await deps.antiShillingGuard.violatesAntiShilling({
      bidderUserId: placedByUserId,
      buyerLegalEntityId,
      lot: lotRow,
    }))
  ) {
    throw new BidError("Seller cannot bid on own lot", 400, "seller_cannot_bid");
  }

  const prevWinning = await bids.findWinningBid(lotId);
  const prevWinnerId = prevWinning?.placedByUserId ?? prevWinning?.bidderId ?? null;

  return { lotRow, prevWinnerId, prevWinningBid: prevWinning };
}

export function applyStrategyBidValidation(
  deps: PlaceBidPipelineDeps,
  input: PlaceBidInTransactionInput,
  lotRow: Lot,
  prevWinnerId: string | null,
): {
  strategy: ReturnType<ILotStrategyFactory["create"]>;
  nextPrice: number;
  amountStr: string;
  maxStr: string | null;
  stepStr: string | null;
  hasMax: boolean;
} {
  const {
    placedByUserId,
    buyerLegalEntityId,
    amount,
    maxAutoBidAmount,
    autoBidStepAmount,
    placement: bidPlacement,
  } = input;

  const strategy = deps.strategyFactory.create(lotRow.auctionType);
  const validation = strategy.validateBid(
    lotRow,
    {
      placedByUserId,
      buyerLegalEntityId,
      amount,
      bidderId: placedByUserId,
    },
    {
      currentWinnerId: prevWinnerId,
      placedVia: bidPlacement?.placedVia ?? null,
    },
  );
  if (validation.isErr()) {
    throw validation.error;
  }

  const nextPrice = strategy.getNextPrice(lotRow, amount);
  const amountStr = numberToMoneyString(nextPrice);

  const hasMax =
    maxAutoBidAmount !== undefined &&
    Number.isFinite(maxAutoBidAmount) &&
    maxAutoBidAmount >= amount;
  const maxStr = hasMax ? numberToMoneyString(maxAutoBidAmount) : null;
  const hasStep =
    hasMax &&
    autoBidStepAmount !== undefined &&
    Number.isFinite(autoBidStepAmount) &&
    autoBidStepAmount > 0;
  const stepStr = hasStep ? numberToMoneyString(autoBidStepAmount) : null;

  return { strategy, nextPrice, amountStr, maxStr, stepStr, hasMax };
}

export async function createInitialBid(
  bids: IBidRepository,
  input: PlaceBidInTransactionInput,
  amountStr: string,
  maxStr: string | null,
  stepStr: string | null,
  hasMax: boolean,
): Promise<Bid> {
  const { placedByUserId, buyerLegalEntityId, lotId, placement: bidPlacement } = input;

  return bids.create({
    lotId,
    placedByUserId,
    buyerLegalEntityId,
    amount: amountStr,
    isWinning: false,
    isAutoBid: hasMax,
    maxAutoBidAmount: maxStr,
    autoBidStepAmount: stepStr,
    ...(bidPlacement?.placedVia != null ? { placedVia: bidPlacement.placedVia } : {}),
    ...(bidPlacement?.telephoneBookingId != null
      ? { telephoneBookingId: bidPlacement.telephoneBookingId }
      : {}),
    ...(bidPlacement?.clerkUserId != null ? { clerkUserId: bidPlacement.clerkUserId } : {}),
    ...(input.internalPlacementKey != null
      ? { internalPlacementKey: input.internalPlacementKey }
      : {}),
  });
}

export async function applyProxyResolution(
  deps: PlaceBidPipelineDeps,
  input: PlaceBidInTransactionInput,
  lotRow: Lot,
  bids: IBidRepository,
  tx: Database,
  lastBid: Bid,
): Promise<Bid> {
  const { lotId } = input;

  if (deps.antiShillingGuard) {
    await deps.proxyResolver.cancelViolatingProxyBids(
      lotId,
      lotRow,
      bids,
      tx,
      input.pendingProxyCancels,
    );
  }

  if (lotRow.auctionType === "english" || lotRow.auctionType === "buy_it_now") {
    return deps.proxyResolver.resolve(bids, lotId, lotRow, lastBid, tx, input.pendingProxyCancels);
  }

  return lastBid;
}

export async function applyAntiSnipeExtension(
  deps: PlaceBidPipelineDeps,
  input: PlaceBidInTransactionInput,
  lotRow: Lot,
  lots: ILotRepository,
  strategy: ReturnType<ILotStrategyFactory["create"]>,
  nextPrice: number,
): Promise<Date> {
  const { placedByUserId, buyerLegalEntityId, lotId } = input;

  let nextEnd = lotRow.endTime;
  const skipAntiSnipe =
    deps.saleroomSessionLookup != null &&
    (await deps.saleroomSessionLookup.shouldSkipAntiSnipeForLot(lotId));
  if (
    !skipAntiSnipe &&
    strategy.shouldExtendTime(
      lotRow,
      {
        placedByUserId,
        buyerLegalEntityId,
        amount: nextPrice,
        bidderId: placedByUserId,
      },
      deps.bidPolicy,
    )
  ) {
    nextEnd = new Date(lotRow.endTime.getTime() + deps.bidPolicy.antiSnipingExtensionMs);
    await lots.updateEndTime(lotId, nextEnd);
  }

  return nextEnd;
}

export async function persistBidOutcome(
  deps: PlaceBidPipelineDeps,
  input: PlaceBidInTransactionInput,
  lotRow: Lot,
  lots: ILotRepository,
  bids: IBidRepository,
  tx: Database,
  lastBid: Bid,
  prevWinnerId: string | null,
  prevWinningBid: Bid | null,
  isFirstBidForUserOnLot: boolean,
  strategy: ReturnType<ILotStrategyFactory["create"]>,
  nextEnd: Date,
): Promise<PlaceBidTxOutcome> {
  const { placedByUserId, buyerLegalEntityId, lotId } = input;

  await publishBidMilestoneDomainEvents(deps.domainEventSink, tx, {
    lotId,
    winningBid: lastBid,
    prevWinnerId,
    prevWinningBid,
    isFirstBidForUserOnLot,
  });

  await bids.markWinningBid(lotId, lastBid.id);
  if (lotRow.auctionType === "sealed") {
    await lots.updateCurrentPrice(lotId, lotRow.startingPrice);
  } else {
    await lots.updateCurrentPrice(lotId, lastBid.amount);
  }

  const earlyClose = await deps.earlyCloseHandler.tryEarlyClose({
    strategy,
    lots,
    lotRow,
    lastBid,
    buyerLegalEntityId,
    placedByUserId,
    tx,
  });
  const endedEarly = earlyClose != null;

  await deps.criticalNotificationStager.stageInTransaction({
    lotId,
    lotRow,
    created: lastBid,
    prevWinnerId,
    endedEarly,
    bids,
    tx,
  });

  return { created: lastBid, lot: lotRow, nextEnd, endedEarly };
}

export async function runPlaceBidInTransaction(
  deps: PlaceBidPipelineDeps,
  input: PlaceBidInTransactionInput,
  lots: ILotRepository,
  bids: IBidRepository,
  tx: Database,
): Promise<PlaceBidTxOutcome & { prevWinnerId: string | null }> {
  const { lotRow, prevWinnerId, prevWinningBid } = await validateLotForBid(
    deps,
    input,
    lots,
    bids,
    tx,
  );
  const existingBidders = await bids.listDistinctBidderIds(input.lotId);
  const isFirstBidForUserOnLot = !existingBidders.includes(input.placedByUserId);
  const { strategy, nextPrice, amountStr, maxStr, stepStr, hasMax } = applyStrategyBidValidation(
    deps,
    input,
    lotRow,
    prevWinnerId,
  );

  let lastBid = await createInitialBid(bids, input, amountStr, maxStr, stepStr, hasMax);
  lastBid = await applyProxyResolution(deps, input, lotRow, bids, tx, lastBid);
  const nextEnd = await applyAntiSnipeExtension(deps, input, lotRow, lots, strategy, nextPrice);
  const outcome = await persistBidOutcome(
    deps,
    input,
    lotRow,
    lots,
    bids,
    tx,
    lastBid,
    prevWinnerId,
    prevWinningBid,
    isFirstBidForUserOnLot,
    strategy,
    nextEnd,
  );

  return { ...outcome, prevWinnerId };
}

export async function notifyAfterBidCommitted(
  deps: PlaceBidPipelineDeps,
  input: PlaceBidInput,
  txOutcome: PlaceBidTxOutcome & { prevWinnerId: string | null },
  pendingProxyCancels: ProxyCancelNotification[],
): Promise<void> {
  const { lotId } = input;
  const { created, lot, nextEnd, endedEarly, prevWinnerId } = txOutcome;

  const displayPrice =
    lot.auctionType === "sealed" && !endedEarly ? lot.startingPrice : created.amount;
  const createdUserId = created.placedByUserId ?? created.bidderId ?? null;

  const updatedLot: Lot = endedEarly
    ? {
        ...lot,
        endTime: nextEnd,
        currentPrice: created.amount,
        status: "ended",
        winnerId: createdUserId,
        ...(created.buyerLegalEntityId ? { buyerLegalEntityId: created.buyerLegalEntityId } : {}),
      }
    : nextEnd.getTime() !== lot.endTime.getTime()
      ? { ...lot, endTime: nextEnd, currentPrice: displayPrice }
      : { ...lot, currentPrice: displayPrice };

  await deps.proxyResolver.flushPendingProxyCancels(pendingProxyCancels);

  await deps.notificationCoordinator.afterBidCommitted({
    lotId,
    displayPrice,
    updatedLot,
    created,
    prevWinnerId,
    nextEnd,
    lotEndBefore: lot.endTime,
    endedEarly,
    bidCount: await deps.repos.root.bid.countForLot(lotId),
  });
}
