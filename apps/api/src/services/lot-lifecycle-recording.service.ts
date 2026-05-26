import type { Database } from "@auction/db";
import { bid, lot } from "@auction/db/schema";
import type { Lot, LotStatus } from "@auction/types";
import { eq, sql } from "drizzle-orm";
import type {
  LotAttachedToSalePayload,
  LotCancelledPayload,
  LotCreatedPayload,
  LotDetachedFromSalePayload,
  LotEndedPayload,
  LotEventType,
  LotReturnedToInventoryPayload,
} from "../domain/lot-events.js";
import type {
  LotLifecycleEventRecorder,
  RecordLotLifecycleInput,
} from "./lot-lifecycle-event-recorder.js";

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

/** Shared recording helpers used by lot/sale/lifecycle services. */
export class LotLifecycleRecording {
  constructor(private readonly recorder: LotLifecycleEventRecorder) {}

  async recordCreated(tx: Database, input: RecordCreatedInput): Promise<void> {
    await this.recorder.record(tx, {
      lotId: input.lot.id,
      eventType: "lot.created",
      payload: {
        saleId: input.lot.saleId,
        source: input.source,
      } satisfies LotCreatedPayload,
      actorUserId: input.actorUserId ?? null,
      actingLegalEntityId: input.lot.sellerLegalEntityId ?? null,
      seedSnapshot: true,
      snapshotPatch: {
        currentStatus: input.lot.status,
        lastEventType: "lot.created",
        lastSaleId: input.lot.saleId,
        attachedCountDelta: input.lot.saleId ? 1 : 0,
      },
    });
  }

  async recordStatusEvent(
    tx: Database,
    input: {
      lot: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">;
      eventType: LotEventType;
      payload: Record<string, unknown>;
      actorUserId?: string | null;
      snapshotPatch?: Partial<RecordLotLifecycleInput["snapshotPatch"]>;
    },
  ): Promise<void> {
    await this.recorder.record(tx, {
      lotId: input.lot.id,
      eventType: input.eventType,
      payload: input.payload,
      actorUserId: input.actorUserId ?? null,
      actingLegalEntityId: input.lot.sellerLegalEntityId ?? null,
      snapshotPatch: {
        currentStatus: input.lot.status,
        lastEventType: input.eventType,
        lastSaleId: input.lot.saleId,
        ...input.snapshotPatch,
      },
    });
  }

  async recordPublished(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    actorUserId?: string | null,
  ): Promise<void> {
    await this.recordStatusEvent(tx, {
      lot: { ...lotRow, status: "scheduled" },
      eventType: "lot.published",
      payload: { saleId: lotRow.saleId },
      actorUserId: actorUserId ?? null,
    });
  }

  async recordUnpublished(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    reason: "sale_unpublish" | "manual",
    actorUserId?: string | null,
  ): Promise<void> {
    await this.recordStatusEvent(tx, {
      lot: { ...lotRow, status: "draft" },
      eventType: "lot.unpublished",
      payload: { saleId: lotRow.saleId, reason },
      actorUserId: actorUserId ?? null,
    });
  }

  async recordCancelled(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    reason: LotCancelledPayload["reason"],
    actorUserId?: string | null,
  ): Promise<void> {
    await this.recordStatusEvent(tx, {
      lot: { ...lotRow, status: "cancelled" },
      eventType: "lot.cancelled",
      payload: { reason },
      actorUserId: actorUserId ?? null,
      snapshotPatch: {
        lastSaleOutcome: "cancelled",
      },
    });
  }

  async recordActivated(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    activatedAt: Date,
  ): Promise<void> {
    await this.recordStatusEvent(tx, {
      lot: { ...lotRow, status: "active" },
      eventType: "lot.activated",
      payload: { saleId: lotRow.saleId, activatedAt: activatedAt.toISOString() },
      snapshotPatch: { currentStatus: "active" },
    });
  }

  async recordEnded(tx: Database, input: RecordEndedInput): Promise<void> {
    const endedAt = input.payload.endedAt ?? new Date().toISOString();
    await this.recordStatusEvent(tx, {
      lot: { ...input.lot, status: "ended" },
      eventType: "lot.ended",
      payload: {
        ...input.payload,
        hadWinner: input.payload.outcome === "sold",
        endedAt,
      },
      actorUserId: input.actorUserId ?? null,
      snapshotPatch: {
        currentStatus: "ended",
        lastSaleOutcome: input.payload.outcome,
        lastSaleEndedAt: new Date(endedAt),
      },
    });
  }

  async recordVoided(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    reason: string,
  ): Promise<void> {
    await this.recordStatusEvent(tx, {
      lot: { ...lotRow, status: "voided" },
      eventType: "lot.voided",
      payload: { reason },
      snapshotPatch: {
        currentStatus: "voided",
        lastSaleOutcome: "no_sale",
      },
    });
  }

  async recordAttached(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    payload: LotAttachedToSalePayload,
    actorUserId?: string | null,
  ): Promise<void> {
    await this.recorder.record(tx, {
      lotId: lotRow.id,
      eventType: "lot.attached_to_sale",
      payload,
      actorUserId: actorUserId ?? null,
      actingLegalEntityId: lotRow.sellerLegalEntityId ?? null,
      snapshotPatch: {
        currentStatus: lotRow.status,
        lastEventType: "lot.attached_to_sale",
        lastSaleId: payload.saleId,
        attachedCountDelta: 1,
      },
    });
  }

  async recordDetached(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    fromSaleId: string,
    actorUserId?: string | null,
  ): Promise<void> {
    const payload: LotDetachedFromSalePayload = { fromSaleId };
    await this.recorder.record(tx, {
      lotId: lotRow.id,
      eventType: "lot.detached_from_sale",
      payload,
      actorUserId: actorUserId ?? null,
      actingLegalEntityId: lotRow.sellerLegalEntityId ?? null,
      snapshotPatch: {
        currentStatus: lotRow.status,
        lastEventType: "lot.detached_from_sale",
        lastSaleId: null,
        attachedCountDelta: -1,
      },
    });
  }

  async recordWithdrawalRequested(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    sellerLegalEntityId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.recordStatusEvent(tx, {
      lot: lotRow,
      eventType: "lot.withdrawal_requested",
      payload: { sellerLegalEntityId },
      actorUserId,
    });
  }

  async recordReturnedToInventory(
    tx: Database,
    lotRow: Pick<Lot, "id" | "sellerLegalEntityId">,
    payload: LotReturnedToInventoryPayload,
    actorUserId: string,
  ): Promise<void> {
    const now = new Date();
    await this.recorder.record(tx, {
      lotId: lotRow.id,
      eventType: "lot.returned_to_inventory",
      payload,
      actorUserId,
      actingLegalEntityId: lotRow.sellerLegalEntityId ?? null,
      snapshotPatch: {
        currentStatus: "draft",
        lastEventType: "lot.returned_to_inventory",
        lastSaleId: payload.lastSaleId,
        lastSaleOutcome: null,
        lastSaleEndedAt: null,
        returnedToInventoryAt: now,
        returnCountDelta: 1,
        attachedCountDelta: payload.lastSaleId ? -1 : 0,
      },
    });
  }
}

export async function resetLotForInventoryReturn(
  tx: Database,
  lotId: string,
  _fromStatus: LotStatus,
): Promise<void> {
  await tx
    .update(lot)
    .set({
      status: "draft",
      saleId: null,
      lotNumber: null,
      winnerId: null,
      buyerLegalEntityId: null,
      currentPrice: sql`${lot.startingPrice}`,
      voidedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(lot.id, lotId));

  await tx.update(bid).set({ isWinning: false }).where(eq(bid.lotId, lotId));
}
