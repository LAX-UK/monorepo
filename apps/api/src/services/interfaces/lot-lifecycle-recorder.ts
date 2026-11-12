import type { Database } from "@auction/db";
import type { Lot, LotEventPayload } from "@auction/types";
import type {
  LotAttachedToSalePayload,
  LotCancelledPayload,
  LotReturnedToInventoryPayload,
} from "../../domain/lot-events.js";
import type { RecordCreatedInput, RecordEndedInput } from "../lot-lifecycle-recording.types.js";

/** The lifecycle events of re-offering a defaulted lot to the next bidder, and of the re-award. */
export const LOT_REOFFER_EVENT_TYPES = [
  "lot.reoffer_started",
  "lot.seller_consent_given",
  "lot.seller_consent_refused",
  "lot.seller_consent_lapsed",
  "lot.reoffer_sent",
  "lot.reoffer_accepted",
  "lot.reoffer_declined",
  "lot.reoffer_expired",
  "lot.reoffer_withdrawn",
  "lot.reawarded",
] as const;
export type LotReofferEventType = (typeof LOT_REOFFER_EVENT_TYPES)[number];

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

  recordWithdrawalDeclined(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    sellerLegalEntityId: string,
    reason: string,
    actorUserId: string,
  ): Promise<void>;

  /** A won lot's buyer did not pay; the sale is cancelled and the invoice voided. */
  recordBuyerDefaulted(
    tx: Database,
    lotRow: Pick<Lot, "id" | "saleId" | "sellerLegalEntityId">,
    payload: LotEventPayload<"lot.buyer_defaulted">,
    actorUserId: string,
  ): Promise<void>;

  /**
   * A step of an offer to the next bidder, or the re-award itself. The lot stays ended, so no
   * status is set: the event is recorded against the lot with the actor in the payload.
   */
  recordReoffer<T extends LotReofferEventType>(
    tx: Database,
    lotRow: Pick<Lot, "id" | "saleId" | "sellerLegalEntityId">,
    eventType: T,
    payload: LotEventPayload<T>,
    actorUserId: string | null,
  ): Promise<void>;

  recordReturnedToInventory(
    tx: Database,
    lotRow: Pick<Lot, "id" | "sellerLegalEntityId">,
    payload: LotReturnedToInventoryPayload,
    actorUserId: string,
  ): Promise<void>;
}
