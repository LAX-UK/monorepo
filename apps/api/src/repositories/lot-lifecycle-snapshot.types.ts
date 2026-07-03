import type { lotLifecycleSnapshot } from "@auction/db/schema";
import type { LotStatus } from "@auction/types";
import type { LotEventType } from "../domain/lot-events.js";

export type LotLifecycleSnapshotRow = typeof lotLifecycleSnapshot.$inferSelect;

export type LotLifecycleSnapshotPatch = {
  currentStatus?: LotStatus;
  lastEventType: LotEventType | string;
  lastEventAt?: Date;
  lastActorUserId?: string | null;
  lastSaleId?: string | null;
  lastSaleOutcome?: string | null;
  lastSaleEndedAt?: Date | null;
  returnedToInventoryAt?: Date | null;
  returnCountDelta?: number;
  attachedCountDelta?: number;
};

export type UpsertLotLifecycleSnapshotInput = {
  lotId: string;
  actorUserId?: string | null;
  snapshotPatch: LotLifecycleSnapshotPatch;
  seedSnapshot?: boolean;
};

export type LotLifecycleTimelineEventRow = {
  id: number;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  occurredAt: Date;
};
