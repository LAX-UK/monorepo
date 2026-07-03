import type { Database } from "@auction/db";
import { lot, lotFulfilment } from "@auction/db/schema";
import { and, count, desc, eq, getTableColumns, ilike, or } from "drizzle-orm";
import type {
  ILotFulfilmentRepository,
  InsertLotFulfilmentInput,
  UpdateLotFulfilmentInput,
} from "../interfaces/lot-fulfilment.repository.js";

function buildAdminWhereClause(options?: {
  status?: (typeof lotFulfilment.$inferSelect)["status"];
  q?: string;
}) {
  const needle = options?.q?.trim();
  const needleIsUuid =
    needle != null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(needle);
  const filters = [
    ...(options?.status !== undefined ? [eq(lotFulfilment.status, options.status)] : []),
    ...(needle
      ? [
          or(
            ilike(lot.title, `%${needle}%`),
            ...(needleIsUuid
              ? [eq(lotFulfilment.lotId, needle), eq(lotFulfilment.id, needle)]
              : []),
          ),
        ]
      : []),
  ];
  return filters.length > 0 ? and(...filters) : undefined;
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

  async listForAdmin(options?: {
    status?: (typeof lotFulfilment.$inferSelect)["status"];
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = Math.max(0, options?.offset ?? 0);
    const whereClause = buildAdminWhereClause(options);

    const countBase = this.db
      .select({ n: count() })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id));
    const [totalRow] = whereClause ? await countBase.where(whereClause) : await countBase;
    const total = Number(totalRow?.n ?? 0);

    const statusCountBase = this.db
      .select({ status: lotFulfilment.status, n: count() })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id))
      .groupBy(lotFulfilment.status);
    const statusRows = whereClause
      ? await statusCountBase.where(whereClause)
      : await statusCountBase;
    const statusCounts = Object.fromEntries(
      statusRows.map((row) => [row.status, Number(row.n ?? 0)]),
    );

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

    return { items, total, statusCounts };
  }
}
