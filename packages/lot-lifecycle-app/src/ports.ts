import type { Database } from "@auction/db";
import type { IAntiShillingGuard, ISaleroomSessionLookup } from "@auction/persistence/interfaces";
import type { DomainEventInput } from "@auction/persistence/lib";
import type { Bid, Lot } from "@auction/types";
import type { LotCloseOutcome } from "./lot-lifecycle-types.js";

export interface ILifecycleDomainEventSink {
  publish(event: DomainEventInput): Promise<void>;
  withTx(tx: Database): ILifecycleDomainEventSink;
}

export type RecordEndedInput = {
  lot: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">;
  payload: {
    outcome: "sold" | "no_sale";
    winnerId: string | null;
    saleId: string | null;
    trigger: string;
    hammerPrice?: string | null;
    endedAt?: string;
  };
  actorUserId?: string | null;
};

/** Minimal lot lifecycle event recording for timed transitions in the worker runtime. */
export interface ILotLifecycleTransitionRecorder {
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
}

export interface ILotLifecycleNotifications {
  notifyWatchlistStarting(a: Lot): Promise<void>;
  notifyEndingSoonBuckets(now: Date): Promise<void>;
  notifyBiddersAfterLotClose(a: Lot, outcome: LotCloseOutcome): Promise<void>;
  stageLotCloseNotificationsInTransaction(input: {
    lot: Lot;
    winnerId: string | null;
    bid: { listForLotSettlement(lotId: string, limit: number): Promise<Bid[]> };
    tx: Database;
  }): Promise<void>;
}

export type LotLifecycleExecutionPorts = {
  antiShillingGuard?: IAntiShillingGuard | null;
  saleroomSessionLookup?: ISaleroomSessionLookup | null;
  domainEventSink?: ILifecycleDomainEventSink | null;
  lotLifecycleRecording?: ILotLifecycleTransitionRecorder | null;
  notifications: ILotLifecycleNotifications;
  onLotActivated?: ((lotId: string) => Promise<void>) | null;
};
