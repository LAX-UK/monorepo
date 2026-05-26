import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot, lotCategories, lotLifecycleSnapshot, sale } from "@auction/db/schema";
import type { LotStatus } from "@auction/types";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

export type AdminLotBrowseState = "available" | "returned" | "all";

export type AdminLotBrowseInput = {
  q?: string | undefined;
  sellerLegalEntityId?: string | undefined;
  categoryIds?: string[] | undefined;
  artistId?: string | undefined;
  state?: AdminLotBrowseState | undefined;
  excludeSaleId?: string | undefined;
  limit: number;
  offset: number;
};

export type AdminAttachableLotRow = {
  id: string;
  title: string;
  status: LotStatus;
  sellerLegalEntityId: string;
  saleId: string | null;
  artistId: string | null;
  createdAt: Date;
  lifecycle: {
    kind: "new_draft" | "returned";
    returnedAt: Date | null;
    lastSaleId: string | null;
    lastSaleName: string | null;
    returnCount: number;
  };
};

export class AdminLotBrowseService {
  constructor(private readonly db: Database) {}

  async listAttachable(
    input: AdminLotBrowseInput,
  ): Promise<{ data: AdminAttachableLotRow[]; total: number }> {
    const state = input.state ?? "available";
    const conditions = [
      lotNotDeleted(),
      eq(lot.status, "draft"),
      isNull(lot.saleId),
      eq(lot.archivedSeller, false),
    ];

    if (input.sellerLegalEntityId) {
      conditions.push(eq(lot.sellerLegalEntityId, input.sellerLegalEntityId));
    }
    if (input.artistId) {
      conditions.push(eq(lot.artistId, input.artistId));
    }
    if (input.excludeSaleId) {
      const excludeSaleCondition = or(
        isNull(lot.saleId),
        sql`${lot.saleId} <> ${input.excludeSaleId}`,
      );
      if (excludeSaleCondition) conditions.push(excludeSaleCondition);
    }
    if (input.q?.trim()) {
      const safe = input.q
        .trim()
        .slice(0, 200)
        .replace(/[%_\\]/g, "");
      if (safe.length > 0) conditions.push(ilike(lot.title, `%${safe}%`));
    }
    if (input.categoryIds?.length) {
      conditions.push(
        sql`exists (
          select 1 from ${lotCategories}
          where ${lotCategories.lotId} = ${lot.id}
            and ${lotCategories.categoryId} in (${sql.join(
              input.categoryIds.map((id) => sql`${id}`),
              sql`, `,
            )})
        )`,
      );
    }

    if (state === "returned") {
      conditions.push(
        sql`${lotLifecycleSnapshot.returnedToInventoryAt} > now() - interval '90 days'`,
      );
    } else if (state === "available") {
      const availableCondition = or(
        isNull(lotLifecycleSnapshot.returnCount),
        eq(lotLifecycleSnapshot.returnCount, 0),
      );
      if (availableCondition) conditions.push(availableCondition);
    }

    const where = and(...conditions);

    const [countRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(lot)
      .leftJoin(lotLifecycleSnapshot, eq(lotLifecycleSnapshot.lotId, lot.id))
      .where(where);

    const rows = await this.db
      .select({
        id: lot.id,
        title: lot.title,
        status: lot.status,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        saleId: lot.saleId,
        artistId: lot.artistId,
        createdAt: lot.createdAt,
        returnCount: lotLifecycleSnapshot.returnCount,
        returnedToInventoryAt: lotLifecycleSnapshot.returnedToInventoryAt,
        lastSaleId: lotLifecycleSnapshot.lastSaleId,
      })
      .from(lot)
      .leftJoin(lotLifecycleSnapshot, eq(lotLifecycleSnapshot.lotId, lot.id))
      .where(where)
      .orderBy(desc(lot.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    const saleIds = rows.map((r) => r.lastSaleId).filter((id): id is string => id != null);
    const saleNames = new Map<string, string>();
    if (saleIds.length > 0) {
      const saleRows = await this.db
        .select({ id: sale.id, title: sale.title })
        .from(sale)
        .where(inArray(sale.id, saleIds));
      for (const s of saleRows) saleNames.set(s.id, s.title);
    }

    const data: AdminAttachableLotRow[] = rows.map((r) => {
      const returnCount = r.returnCount ?? 0;
      const returnedAt = r.returnedToInventoryAt ?? null;
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        sellerLegalEntityId: r.sellerLegalEntityId,
        saleId: r.saleId,
        artistId: r.artistId,
        createdAt: r.createdAt,
        lifecycle: {
          kind: returnCount > 0 ? "returned" : "new_draft",
          returnedAt,
          lastSaleId: r.lastSaleId,
          lastSaleName: r.lastSaleId ? (saleNames.get(r.lastSaleId) ?? null) : null,
          returnCount,
        },
      };
    });

    return { data, total: countRow?.n ?? 0 };
  }
}
