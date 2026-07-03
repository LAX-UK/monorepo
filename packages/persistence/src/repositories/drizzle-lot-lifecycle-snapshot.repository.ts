import type { Database } from "@auction/db";
import { lotLifecycleSnapshot } from "@auction/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import type { ILotLifecycleSnapshotReader } from "../interfaces/lot-lifecycle-snapshot.reader.js";
import type { ILotLifecycleSnapshotRepository } from "../interfaces/lot-lifecycle-snapshot.repository.js";
import type { UpsertLotLifecycleSnapshotInput } from "../interfaces/lot-lifecycle-snapshot.types.js";

export class DrizzleLotLifecycleSnapshotRepository
  implements ILotLifecycleSnapshotRepository, ILotLifecycleSnapshotReader
{
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): ILotLifecycleSnapshotRepository {
    return new DrizzleLotLifecycleSnapshotRepository(conn);
  }

  async getSnapshot(lotId: string) {
    const [row] = await this.db
      .select()
      .from(lotLifecycleSnapshot)
      .where(eq(lotLifecycleSnapshot.lotId, lotId))
      .limit(1);
    return row ?? null;
  }

  async getSnapshotsForLots(lotIds: string[]) {
    if (lotIds.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(lotLifecycleSnapshot)
      .where(inArray(lotLifecycleSnapshot.lotId, lotIds));
    return new Map(rows.map((r) => [r.lotId, r]));
  }

  async upsertSnapshot(input: UpsertLotLifecycleSnapshotInput): Promise<void> {
    const now = input.snapshotPatch.lastEventAt ?? new Date();
    const patch = input.snapshotPatch;

    if (input.seedSnapshot) {
      await this.db.insert(lotLifecycleSnapshot).values({
        lotId: input.lotId,
        currentStatus: patch.currentStatus ?? "draft",
        lastEventType: patch.lastEventType,
        lastEventAt: now,
        lastActorUserId: patch.lastActorUserId ?? input.actorUserId ?? null,
        lastSaleId: patch.lastSaleId ?? null,
        lastSaleOutcome: patch.lastSaleOutcome ?? null,
        lastSaleEndedAt: patch.lastSaleEndedAt ?? null,
        returnedToInventoryAt: patch.returnedToInventoryAt ?? null,
        returnCount: Math.max(0, patch.returnCountDelta ?? 0),
        attachedCount: Math.max(0, patch.attachedCountDelta ?? 0),
        updatedAt: now,
      });
      return;
    }

    await this.db
      .insert(lotLifecycleSnapshot)
      .values({
        lotId: input.lotId,
        currentStatus: patch.currentStatus ?? "draft",
        lastEventType: patch.lastEventType,
        lastEventAt: now,
        lastActorUserId: patch.lastActorUserId ?? input.actorUserId ?? null,
        lastSaleId: patch.lastSaleId ?? null,
        lastSaleOutcome: patch.lastSaleOutcome ?? null,
        lastSaleEndedAt: patch.lastSaleEndedAt ?? null,
        returnedToInventoryAt: patch.returnedToInventoryAt ?? null,
        returnCount: Math.max(0, patch.returnCountDelta ?? 0),
        attachedCount: Math.max(0, patch.attachedCountDelta ?? 0),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: lotLifecycleSnapshot.lotId,
        set: {
          ...(patch.currentStatus !== undefined ? { currentStatus: patch.currentStatus } : {}),
          lastEventType: patch.lastEventType,
          lastEventAt: now,
          lastActorUserId: patch.lastActorUserId ?? input.actorUserId ?? null,
          ...(patch.lastSaleId !== undefined ? { lastSaleId: patch.lastSaleId } : {}),
          ...(patch.lastSaleOutcome !== undefined
            ? { lastSaleOutcome: patch.lastSaleOutcome }
            : {}),
          ...(patch.lastSaleEndedAt !== undefined
            ? { lastSaleEndedAt: patch.lastSaleEndedAt }
            : {}),
          ...(patch.returnedToInventoryAt !== undefined
            ? { returnedToInventoryAt: patch.returnedToInventoryAt }
            : {}),
          returnCount: sql`${lotLifecycleSnapshot.returnCount} + ${patch.returnCountDelta ?? 0}`,
          attachedCount: sql`${lotLifecycleSnapshot.attachedCount} + ${patch.attachedCountDelta ?? 0}`,
          updatedAt: now,
        },
      });
  }
}
