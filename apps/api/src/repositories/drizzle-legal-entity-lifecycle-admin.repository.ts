import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import type { LegalEntityStatus } from "@auction/types";
import { eq } from "drizzle-orm";
import type {
  ILegalEntityLifecycleAdminRepository,
  LegalEntityLifecycleRow,
  LegalEntityLifecycleTransitionUpdate,
} from "./interfaces/legal-entity-lifecycle-admin.repository.js";

export class DrizzleLegalEntityLifecycleAdminRepository
  implements ILegalEntityLifecycleAdminRepository
{
  constructor(private readonly db: Database) {}

  async findById(entityId: string): Promise<LegalEntityLifecycleRow | null> {
    const preRows = await this.db
      .select({ id: legalEntity.id, status: legalEntity.status })
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    const pre = preRows[0];
    if (!pre) return null;
    return { id: pre.id, status: pre.status as LegalEntityStatus };
  }

  async findByIdForUpdate(tx: Database, entityId: string): Promise<LegalEntityLifecycleRow | null> {
    const lockedRows = await tx
      .select({ id: legalEntity.id, status: legalEntity.status })
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .for("update")
      .limit(1);
    const row = lockedRows[0];
    if (!row) return null;
    return { id: row.id, status: row.status as LegalEntityStatus };
  }

  async applyTransitionUpdate(
    tx: Database,
    input: LegalEntityLifecycleTransitionUpdate,
  ): Promise<void> {
    await tx
      .update(legalEntity)
      .set({
        status: input.nextStatus,
        statusChangedAt: new Date(),
        statusChangedByUserId: input.actorUserId,
        statusReason: input.statusReason,
        updatedAt: new Date(),
      })
      .where(eq(legalEntity.id, input.entityId));
  }
}
