import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import type { LegalEntityStatus } from "@auction/types";
import { eq } from "drizzle-orm";
import type {
  ILegalEntityLifecycleAdminRepository,
  LegalEntityLifecycleRow,
  LegalEntityLifecycleTransitionUpdate,
} from "../interfaces/legal-entity-lifecycle-admin.repository.js";

const lifecycleColumns = {
  id: legalEntity.id,
  status: legalEntity.status,
  stripeConnectAccountId: legalEntity.stripeConnectAccountId,
  stripeConnectChargesEnabled: legalEntity.stripeConnectChargesEnabled,
  stripeConnectPayoutsEnabled: legalEntity.stripeConnectPayoutsEnabled,
  stripeConnectRequirementsCurrentlyDue: legalEntity.stripeConnectRequirementsCurrentlyDue,
  stripeConnectRequirementsErrors: legalEntity.stripeConnectRequirementsErrors,
  stripeConnectDisabledReason: legalEntity.stripeConnectDisabledReason,
  isLaxManaged: legalEntity.isLaxManaged,
};

function toRow(
  row: { status: string } & Omit<LegalEntityLifecycleRow, "status">,
): LegalEntityLifecycleRow {
  return { ...row, status: row.status as LegalEntityStatus };
}

export class DrizzleLegalEntityLifecycleAdminRepository
  implements ILegalEntityLifecycleAdminRepository
{
  constructor(private readonly db: Database) {}

  async findById(entityId: string): Promise<LegalEntityLifecycleRow | null> {
    const preRows = await this.db
      .select(lifecycleColumns)
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    const pre = preRows[0];
    if (!pre) return null;
    return toRow(pre);
  }

  async findByIdForUpdate(tx: Database, entityId: string): Promise<LegalEntityLifecycleRow | null> {
    const lockedRows = await tx
      .select(lifecycleColumns)
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .for("update")
      .limit(1);
    const row = lockedRows[0];
    if (!row) return null;
    return toRow(row);
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
