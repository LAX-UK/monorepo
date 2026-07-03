import { type Database, lot, lotNotDeleted, qrCode, sale, saleNotDeleted } from "@auction/db";
import { lotPath, salePath } from "@auction/types";
import { and, desc, eq } from "drizzle-orm";
import type { QrCodeEntityType } from "../services/qr-code/qr-code-types.js";
import type {
  IQrCodeRepository,
  QrCodeEntityRef,
  QrCodeInsert,
  QrCodeRow,
  QrCodeUpdatePatch,
} from "./interfaces/qr-code.repository.js";

function mapRow(row: typeof qrCode.$inferSelect): QrCodeRow {
  return {
    id: row.id,
    shortCode: row.shortCode,
    entityType: row.entityType,
    entityId: row.entityId,
    campaign: row.campaign,
    placement: row.placement,
    status: row.status,
    expiresAt: row.expiresAt,
    isDefault: row.isDefault,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleQrCodeRepository implements IQrCodeRepository {
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): IQrCodeRepository {
    return new DrizzleQrCodeRepository(conn);
  }

  async findByShortCode(shortCode: string): Promise<QrCodeRow | null> {
    const [row] = await this.db
      .select()
      .from(qrCode)
      .where(eq(qrCode.shortCode, shortCode))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findDefaultForEntity(
    entityType: QrCodeEntityType,
    entityId: string,
  ): Promise<QrCodeRow | null> {
    const [row] = await this.db
      .select()
      .from(qrCode)
      .where(
        and(
          eq(qrCode.entityType, entityType),
          eq(qrCode.entityId, entityId),
          eq(qrCode.isDefault, true),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listForEntity(entityType: QrCodeEntityType, entityId: string): Promise<QrCodeRow[]> {
    const rows = await this.db
      .select()
      .from(qrCode)
      .where(and(eq(qrCode.entityType, entityType), eq(qrCode.entityId, entityId)))
      .orderBy(desc(qrCode.createdAt));
    return rows.map(mapRow);
  }

  async insert(row: QrCodeInsert): Promise<QrCodeRow> {
    const [created] = await this.db
      .insert(qrCode)
      .values({
        shortCode: row.shortCode,
        entityType: row.entityType,
        entityId: row.entityId,
        isDefault: row.isDefault ?? true,
        createdByUserId: row.createdByUserId ?? null,
      })
      .returning();
    if (!created) throw new Error("qr_code insert returned no row");
    return mapRow(created);
  }

  async update(id: string, patch: QrCodeUpdatePatch): Promise<QrCodeRow | null> {
    const values: Partial<typeof qrCode.$inferInsert> = {
      updatedAt: new Date(),
    };
    if ("campaign" in patch) values.campaign = patch.campaign ?? null;
    if ("placement" in patch) values.placement = patch.placement ?? null;
    if (patch.status) values.status = patch.status;
    if ("expiresAt" in patch) values.expiresAt = patch.expiresAt ?? null;
    if ("isDefault" in patch) values.isDefault = patch.isDefault;

    const [updated] = await this.db.update(qrCode).set(values).where(eq(qrCode.id, id)).returning();
    return updated ? mapRow(updated) : null;
  }

  async disableDefaultAndInsert(
    entityType: QrCodeEntityType,
    entityId: string,
    newRow: QrCodeInsert,
  ): Promise<{ row: QrCodeRow; oldShortCodes: string[] }> {
    const oldShortCodes: string[] = [];
    const row = await this.db.transaction(async (tx) => {
      const repo = new DrizzleQrCodeRepository(tx);
      const current = await repo.findDefaultForEntity(entityType, entityId);
      if (current) {
        oldShortCodes.push(current.shortCode);
        await tx
          .update(qrCode)
          .set({ isDefault: false, status: "disabled", updatedAt: new Date() })
          .where(eq(qrCode.id, current.id));
      }
      return repo.insert({ ...newRow, isDefault: true });
    });
    return { row, oldShortCodes };
  }

  async loadEntity(
    entityType: QrCodeEntityType,
    entityId: string,
  ): Promise<QrCodeEntityRef | null> {
    if (entityType === "sale") {
      const [row] = await this.db
        .select({ id: sale.id, title: sale.title })
        .from(sale)
        .where(and(eq(sale.id, entityId), saleNotDeleted()))
        .limit(1);
      return row ? { title: row.title, destinationPath: salePath(row) } : null;
    }
    const [row] = await this.db
      .select({ id: lot.id, title: lot.title })
      .from(lot)
      .where(and(eq(lot.id, entityId), lotNotDeleted()))
      .limit(1);
    return row ? { title: row.title, destinationPath: lotPath(row) } : null;
  }
}
