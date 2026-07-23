import type { Database } from "@auction/db";
import { lot, lotFulfilment } from "@auction/db/schema";
import { and, count, desc, eq, getTableColumns, ilike, or } from "drizzle-orm";
import type {
  AdminLotFulfilmentBaseFilter,
  AdminLotFulfilmentListFilter,
  AdminLotFulfilmentListSummary,
  ILotFulfilmentRepository,
  InsertLotFulfilmentInput,
  UpdateLotFulfilmentInput,
} from "../interfaces/lot-fulfilment.repository.js";

function buildSearchWhereClause(q?: string) {
  const needle = q?.trim();
  const needleIsUuid =
    needle != null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(needle);
  if (!needle) return undefined;
  return or(
    ilike(lot.title, `%${needle}%`),
    ...(needleIsUuid ? [eq(lotFulfilment.lotId, needle), eq(lotFulfilment.id, needle)] : []),
  );
}

function buildListWhereClause(filter?: AdminLotFulfilmentListFilter) {
  const searchWhere = buildSearchWhereClause(filter?.q);
  const filters = [
    ...(filter?.status !== undefined ? [eq(lotFulfilment.status, filter.status)] : []),
    ...(searchWhere ? [searchWhere] : []),
  ];
  return filters.length > 0 ? and(...filters) : undefined;
}

function summarizeFromStatusCounts(
  statusCounts: Record<string, number>,
): AdminLotFulfilmentListSummary {
  const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const awaitingPickup =
    (statusCounts.ready_for_collection ?? 0) + (statusCounts.awaiting_release ?? 0);
  const inTransit = (statusCounts.in_transit ?? 0) + (statusCounts.released ?? 0);
  return { total, awaitingPickup, inTransit, statusCounts };
}

export class DrizzleLotFulfilmentRepository implements ILotFulfilmentRepository {
  constructor(private readonly db: Database) {}

  async findByLotId(lotId: string) {
    const [row] = await this.db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lotId))
      .limit(1);
    return row ?? null;
  }

  async insert(input: InsertLotFulfilmentInput) {
    await this.db.insert(lotFulfilment).values({
      lotId: input.lotId,
      paymentId: input.paymentId,
      status: input.status,
      ...(input.addressSnapshot ? { addressSnapshot: input.addressSnapshot } : {}),
    });
  }

  async updateByLotId(lotId: string, patch: UpdateLotFulfilmentInput) {
    await this.db.update(lotFulfilment).set(patch).where(eq(lotFulfilment.lotId, lotId));
  }

  async countMatching(filter: AdminLotFulfilmentListFilter) {
    const whereClause = buildListWhereClause(filter);
    const countBase = this.db
      .select({ n: count() })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id));
    const [totalRow] = whereClause ? await countBase.where(whereClause) : await countBase;
    return Number(totalRow?.n ?? 0);
  }

  async summarizeForAdmin(baseFilter: AdminLotFulfilmentBaseFilter = {}) {
    const searchWhere = buildSearchWhereClause(baseFilter.q);
    const statusCountBase = this.db
      .select({ status: lotFulfilment.status, n: count() })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id))
      .groupBy(lotFulfilment.status);
    const statusRows = searchWhere
      ? await statusCountBase.where(searchWhere)
      : await statusCountBase;
    const statusCounts = Object.fromEntries(
      statusRows.map((row) => [row.status, Number(row.n ?? 0)]),
    );
    return summarizeFromStatusCounts(statusCounts);
  }

  async listForAdmin(options?: AdminLotFulfilmentListFilter & { limit?: number; offset?: number }) {
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = Math.max(0, options?.offset ?? 0);
    const listFilter: AdminLotFulfilmentListFilter = {
      ...(options?.q ? { q: options.q } : {}),
      ...(options?.status !== undefined ? { status: options.status } : {}),
    };
    const whereClause = buildListWhereClause(listFilter);

    const total = await this.countMatching(listFilter);

    const listBase = this.db
      .select({
        ...getTableColumns(lotFulfilment),
        lotTitle: lot.title,
      })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id))
      .orderBy(desc(lotFulfilment.updatedAt))
      .limit(limit)
      .offset(offset);
    const rows = whereClause ? await listBase.where(whereClause) : await listBase;
    const items = rows.map((r) => {
      const { lotTitle: title, ...rest } = r;
      return { ...rest, lotTitle: title };
    });

    return { items, total };
  }
}
