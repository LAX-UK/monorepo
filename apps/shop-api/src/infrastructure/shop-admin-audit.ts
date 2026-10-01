import type { Database } from "@auction/db";
import { shopAdminAudit } from "@auction/db/schema";

export type ShopAdminAuditInsert = {
  actorSubjectId: string;
  capability: string;
  action: string;
  targetType: string;
  targetId: string;
  afterJson?: Record<string, unknown>;
  beforeJson?: Record<string, unknown>;
};

export async function insertShopAdminAudit(db: Database, row: ShopAdminAuditInsert): Promise<void> {
  await db.insert(shopAdminAudit).values({
    actorSubjectId: row.actorSubjectId,
    capability: row.capability,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    ...(row.afterJson !== undefined ? { afterJson: JSON.stringify(row.afterJson) } : {}),
    ...(row.beforeJson !== undefined ? { beforeJson: JSON.stringify(row.beforeJson) } : {}),
  });
}
