import type { Database } from "@auction/db";
import type {
  CreateNotificationRow,
  StageNotificationOutboxInput,
} from "@auction/persistence/interfaces";
import type { DomainEventConnection, DomainEventInput } from "@auction/persistence/lib";
import type {
  Bid,
  Lot,
  LotAttachedToSalePayload,
  LotCancelledPayload,
  LotCreatedPayload,
  LotEndedPayload,
  LotEndedTrigger,
  LotReturnedToInventoryPayload,
  NewBid,
} from "@auction/types";
import type { Result } from "neverthrow";
import type { BidError } from "./bid-error.js";
import type { BidPolicyConfig } from "./bid-policy.js";

export type PlaceBidPlacement = {
  placedVia?: string;
  telephoneBookingId?: string;
  clerkUserId?: string;
  saleId?: string;
  paddleNumber?: number;
};

export type PlaceBidInput = {
  placedByUserId: string;
  buyerLegalEntityId: string;
  lotId: string;
  amount: number;
  maxAutoBidAmount?: number;
  autoBidStepAmount?: number;
  placement?: PlaceBidPlacement;
  /** Durable idempotency for internal replays (e.g. absentee). */
  internalPlacementKey?: string;
};

export type BidPlacementError = {
  message: string;
  status: number;
  code?: string | undefined;
};

export interface IBidPlacer {
  placeBid(input: PlaceBidInput): Promise<Result<Bid, BidPlacementError>>;
}

export type AbsenteeBidServiceError = {
  message: string;
  status: number;
  code?: string;
};

export interface IAbsenteeBidService {
  schedule(input: {
    userId: string;
    lotId: string;
    buyerLegalEntityId: string;
    maxAmount: number;
  }): Promise<Result<{ id: string }, AbsenteeBidServiceError>>;
  expireStaleExecutingLeases(): Promise<void>;
  replayScheduledForLot(lotId: string): Promise<void>;
}

/** Narrow port for HTTP/auto-bid callers that need idempotent placement. */
export type PlaceBidWithIdempotencyInput = {
  placedByUserId: string;
  buyerLegalEntityId?: string;
  idempotencyKey?: string;
  lotId: string;
  amount: number;
  maxAutoBidAmount?: number;
  autoBidStepAmount?: number;
  placedVia?: string;
  telephoneBookingId?: string;
  clerkUserId?: string;
  saleId?: string;
  paddleNumber?: number;
};

export type PlaceBidWithIdempotencyOutcome =
  | { type: "replay"; body: { data: Bid } }
  | { type: "err"; error: BidError }
  | { type: "ok"; body: { data: Bid } };

/** Narrow port for HTTP/auto-bid callers that need idempotent placement. */
export interface IBidPlacerWithIdempotency extends IBidPlacer {
  placeBidWithIdempotency(
    input: PlaceBidWithIdempotencyInput,
  ): Promise<PlaceBidWithIdempotencyOutcome>;
}

/** Placeholder written by {@link IIdempotencyStore.tryClaim} while a bid is in flight. */
export const IDEMPOTENCY_PENDING_VALUE = "__pending__";

/** Minimal key-value store for short-lived idempotent HTTP replay (e.g. bids). */
export interface IIdempotencyStore {
  get(key: string): Promise<string | null>;
  /** Persist value with TTL; implementation may use SET EX or equivalent. */
  setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Acquire an in-flight slot (SET NX). Returns true when this caller owns the key. */
  tryClaim(key: string, ttlSeconds: number): Promise<boolean>;
  /** Release a pending claim after a failed placement so the client can retry. */
  delete(key: string): Promise<void>;
}

export interface ICacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export type RecordCreatedInput = {
  lot: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">;
  source: LotCreatedPayload["source"];
  actorUserId?: string | null;
};

export type RecordEndedInput = {
  lot: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">;
  payload: LotEndedPayload;
  actorUserId?: string | null;
};

/** Bid early-close path only records `lot.ended`. */
export interface ILotEarlyCloseLifecycleRecorder {
  recordEnded(tx: Database, input: RecordEndedInput): Promise<void>;
}

/** Narrow port for lot lifecycle event recording (status transitions, attach/detach). */
export interface ILotLifecycleRecorder {
  recordCreated(tx: Database, input: RecordCreatedInput): Promise<void>;

  recordPublished(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    actorUserId?: string | null,
  ): Promise<void>;

  recordUnpublished(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    reason: "sale_unpublish" | "manual",
    actorUserId?: string | null,
  ): Promise<void>;

  recordCancelled(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    reason: LotCancelledPayload["reason"],
    actorUserId?: string | null,
  ): Promise<void>;

  recordActivated(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    activatedAt: Date,
  ): Promise<void>;

  recordEnded(tx: Database, input: RecordEndedInput): Promise<void>;

  recordVoided(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    reason: string,
  ): Promise<void>;

  recordAttached(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    payload: LotAttachedToSalePayload,
    actorUserId?: string | null,
  ): Promise<void>;

  recordDetached(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    fromSaleId: string,
    actorUserId?: string | null,
  ): Promise<void>;

  recordWithdrawalRequested(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    sellerLegalEntityId: string,
    actorUserId: string,
  ): Promise<void>;

  recordReturnedToInventory(
    tx: Database,
    lotRow: Pick<Lot, "id" | "sellerLegalEntityId">,
    payload: LotReturnedToInventoryPayload,
    actorUserId: string,
  ): Promise<void>;
}

export interface INotificationOutboxService {
  stageDispatch(input: StageNotificationOutboxInput, tx?: Database): Promise<void>;
}

/** Builds persisted notification rows from domain events. */
export interface INotificationFactory {
  createOutbid(lot: Lot, outbidUserId: string): CreateNotificationRow;

  createWon(
    lot: Lot,
    winnerId: string,
    opts?: { hammerPrice?: string; totalDue?: string },
  ): CreateNotificationRow;

  createLost(lot: Lot, bidderId: string): CreateNotificationRow;
}

export type BidPlacedRealtimeMeta = {
  /** Previous high bidder (for client-side outbid toast). */
  outbidUserId?: string | undefined;
  /** Total bids on the lot after placement. */
  bidCount?: number | undefined;
};

export type LotEndedRealtimeMeta = {
  trigger?: LotEndedTrigger;
  hadBids?: boolean;
  voided?: boolean;
};

/** Narrow port for outbound bid/lot notifications used by the placement pipeline. */
export interface INotificationSender {
  notifyBidPlaced(lot: Lot, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void>;
  notifyLotExtended(lot: Lot, newEndTime: Date): Promise<void>;
  notifyLotEnded(lot: Lot, winningBid: Bid | null, meta?: LotEndedRealtimeMeta): Promise<void>;
  notifyProxyCancelled(lotId: string, bidderUserId: string, reason?: string): Promise<void>;
}

export type BidEligibilityCheckInput = {
  placedByUserId: string;
  buyerLegalEntityId: string;
  lotId: string;
  amount: number;
  maxAutoBidAmount?: number | undefined;
  autoBidStepAmount?: number | undefined;
  placedVia?: string | null;
  telephoneBookingId?: string | null;
  saleId?: string | null;
  paddleNumber?: number | null;
};

/** Optional bidding gates (KYC, sale registration, buyer-agent caps) applied before bid tx. */
export interface IBidEligibility {
  assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>>;
}

/** Threshold enforcement for bidding paths (narrow slice of the KYC gate service). */
export interface IKycThresholdGate {
  enforceThreshold(userId: string): Promise<void>;
}

export type ValidateBidContext = {
  currentWinnerId?: string | null;
  /** Origin of bid placement; operator paths skip self-service-only guards. */
  placedVia?: string | null;
};

export type EarlyCloseResolution = {
  endedEarly: true;
  winnerUserId: string;
  winnerLegalEntityId: string;
  hammerPrice: string;
};

export interface ILotStrategy {
  validateBid(lot: Lot, bid: NewBid, ctx?: ValidateBidContext): Result<void, BidError>;
  getNextPrice(lot: Lot, currentBidAmount: number): number;
  determineWinner(lot: Lot, bids: Bid[]): Bid | null;
  shouldExtendTime(lot: Lot, bid: NewBid, policy: BidPolicyConfig): boolean;
  /** Gate self-service bids when catalogue policy restricts auction types. */
  validateSelfServiceAllowed?(lot: Lot, englishOnlyAuctions: boolean): Result<void, BidError>;
  /** Returns early-close outcome when a bid ends the lot before scheduled end. */
  resolveEarlyClose?(
    lot: Lot,
    lastBid: Bid,
    ctx: { buyerLegalEntityId: string },
  ): EarlyCloseResolution | null;
}

export interface ILotStrategyFactory {
  create(type: Lot["auctionType"]): ILotStrategy;
}

/**
 * Connection-owning event port (DIP). Services publish domain events without
 * holding a `Database`: the root connection is captured once in the container;
 * transactional call sites rebind with {@link IDomainEventSink.withTx}.
 */
export interface IDomainEventSink {
  publish(event: DomainEventInput): Promise<void>;
  /** Sink bound to a transaction so events commit/roll back with the tx. */
  withTx(tx: DomainEventConnection): IDomainEventSink;
}

/** Narrow port for the admin cockpit's rolling bid-rate counter. */
export interface IAdminMetricsService {
  recordBidPlaced(): Promise<void>;
}
