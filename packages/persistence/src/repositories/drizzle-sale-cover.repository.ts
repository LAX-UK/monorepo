import type { Database } from "@auction/db";
import { lot, sale } from "@auction/db/schema";
import type { SaleCoverSlot, SaleCoverSlotName, SaleStatus } from "@auction/types";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type {
  HomePinnedSale,
  ISaleCoverRepository,
  SaleCoverState,
  SaleHomePatch,
  SaleHomeState,
} from "../interfaces/sale-cover.repository.js";

/** Cover slots and home fields in `sale`, changed one field at a time. */
export class DrizzleSaleCoverRepository implements ISaleCoverRepository {
  constructor(private readonly db: Database) {}

  async getState(saleId: string): Promise<SaleCoverState | null> {
    const [row] = await this.db
      .select({
        id: sale.id,
        status: sale.status,
        coverImages: sale.coverImages,
        coverSlots: sale.coverSlots,
      })
      .from(sale)
      .where(and(eq(sale.id, saleId), isNull(sale.deletedAt)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      status: row.status as SaleStatus,
      coverImages: row.coverImages ?? [],
      coverSlots: row.coverSlots ?? {},
    };
  }

  async setSlot(saleId: string, name: SaleCoverSlotName, slot: SaleCoverSlot): Promise<void> {
    const patch = JSON.stringify({ [name]: slot });
    await this.db
      .update(sale)
      .set({ coverSlots: sql`${sale.coverSlots} || ${patch}::jsonb`, updatedAt: new Date() })
      .where(eq(sale.id, saleId));
  }

  async clearSlot(saleId: string, name: SaleCoverSlotName): Promise<void> {
    await this.db
      .update(sale)
      .set({ coverSlots: sql`${sale.coverSlots} - ${name}::text`, updatedAt: new Date() })
      .where(eq(sale.id, saleId));
  }

  async getHome(saleId: string): Promise<SaleHomeState | null> {
    const [row] = await this.db
      .select({
        subtitle: sale.subtitle,
        featuredLotIds: sale.featuredLotIds,
        consignmentDeadline: sale.consignmentDeadline,
        homePinOrder: sale.homePinOrder,
      })
      .from(sale)
      .where(and(eq(sale.id, saleId), isNull(sale.deletedAt)))
      .limit(1);
    if (!row) return null;
    return {
      subtitle: row.subtitle ?? null,
      featuredLotIds: row.featuredLotIds ?? [],
      consignmentDeadline: row.consignmentDeadline ?? null,
      homePinOrder: row.homePinOrder ?? null,
    };
  }

  async updateHome(saleId: string, patch: SaleHomePatch): Promise<void> {
    const set: Partial<typeof sale.$inferInsert> = { updatedAt: new Date() };
    if (patch.subtitle !== undefined) set.subtitle = patch.subtitle;
    if (patch.featuredLotIds !== undefined) set.featuredLotIds = patch.featuredLotIds;
    if (patch.consignmentDeadline !== undefined)
      set.consignmentDeadline = patch.consignmentDeadline;
    await this.db.update(sale).set(set).where(eq(sale.id, saleId));
  }

  async listLotIds(saleId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ id: lot.id })
      .from(lot)
      .where(and(eq(lot.saleId, saleId), isNull(lot.deletedAt)));
    return new Set(rows.map((row) => row.id));
  }

  async getLotImages(lotId: string): Promise<{ saleId: string | null; images: string[] } | null> {
    const [row] = await this.db
      .select({ saleId: lot.saleId, images: lot.images })
      .from(lot)
      .where(and(eq(lot.id, lotId), isNull(lot.deletedAt)))
      .limit(1);
    if (!row) return null;
    return { saleId: row.saleId ?? null, images: row.images ?? [] };
  }

  async getSaleStatuses(saleIds: readonly string[]): Promise<Map<string, SaleStatus>> {
    if (saleIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: sale.id, status: sale.status })
      .from(sale)
      .where(and(inArray(sale.id, [...saleIds]), isNull(sale.deletedAt)));
    return new Map(rows.map((row) => [row.id, row.status as SaleStatus]));
  }

  async listHomePins(): Promise<HomePinnedSale[]> {
    const rows = await this.db
      .select({ saleId: sale.id, title: sale.title, position: sale.homePinOrder })
      .from(sale)
      .where(and(isNotNull(sale.homePinOrder), isNull(sale.deletedAt)))
      .orderBy(asc(sale.homePinOrder));
    return rows.flatMap((row) =>
      row.position === null
        ? []
        : [{ saleId: row.saleId, title: row.title, position: row.position }],
    );
  }

  async replaceHomePins(saleIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(sale)
        .set({ homePinOrder: null, updatedAt: new Date() })
        .where(isNotNull(sale.homePinOrder));
      for (const [index, saleId] of saleIds.entries()) {
        await tx
          .update(sale)
          .set({ homePinOrder: index + 1, updatedAt: new Date() })
          .where(eq(sale.id, saleId));
      }
    });
  }
}
