import type { Database } from "@auction/db";
import type { Lot } from "@auction/types";
import type {
  LotAttachedToSalePayload,
  LotCancelledPayload,
  LotReturnedToInventoryPayload,
} from "../../domain/lot-events.js";
import type { RecordCreatedInput, RecordEndedInput } from "../lot-lifecycle-recording.service.js";

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
