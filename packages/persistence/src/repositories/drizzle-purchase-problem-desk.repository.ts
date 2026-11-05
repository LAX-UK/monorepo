import type { Database } from "@auction/db";
import {
  legalEntity,
  lot,
  payment,
  purchaseProblem,
  purchaseProblemNote,
  sale,
} from "@auction/db/schema";
import {
  PURCHASE_PROBLEM_STATUSES,
  type PurchaseProblemCategory,
  type PurchaseProblemStatus,
} from "@auction/domain";
import { type SQL, and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type {
  IPurchaseProblemDeskRepository,
  IPurchaseProblemNoteRepository,
  PurchaseProblemChange,
  PurchaseProblemDeskQuery,
  PurchaseProblemDeskRecord,
  PurchaseProblemNoteRecord,
  PurchaseProblemStatusCounts,
} from "../interfaces/purchase-problem-desk.repository.js";
import { escapeLikePattern } from "../lib/like-pattern.js";

const COLUMNS = {
  id: purchaseProblem.id,
  status: purchaseProblem.status,
  category: purchaseProblem.category,
  message: purchaseProblem.message,
  version: purchaseProblem.version,
  assignedToUserId: purchaseProblem.assignedToUserId,
  resolvedByUserId: purchaseProblem.resolvedByUserId,
  resolvedAt: purchaseProblem.resolvedAt,
  createdAt: purchaseProblem.createdAt,
  updatedAt: purchaseProblem.updatedAt,
  reportedByUserId: purchaseProblem.reportedByUserId,
  buyerLegalEntityId: purchaseProblem.buyerLegalEntityId,
  buyerName: legalEntity.displayName,
  lotId: lot.id,
  lotTitle: lot.title,
  lotNumber: lot.lotNumber,
  saleId: lot.saleId,
  saleTitle: sale.title,
  paymentId: payment.id,
  paymentStatus: payment.status,
  paymentAmount: payment.amount,
};

function selectDesk(db: Database) {
  return db
    .select(COLUMNS)
    .from(purchaseProblem)
    .innerJoin(lot, eq(purchaseProblem.lotId, lot.id))
    .innerJoin(legalEntity, eq(purchaseProblem.buyerLegalEntityId, legalEntity.id))
    .innerJoin(payment, eq(purchaseProblem.paymentId, payment.id))
    .leftJoin(sale, eq(lot.saleId, sale.id));
}

type Row = Awaited<ReturnType<typeof selectDesk>>[number];

function toRecord(row: Row): PurchaseProblemDeskRecord {
  return {
    id: row.id,
    status: row.status as PurchaseProblemStatus,
    category: row.category as PurchaseProblemCategory,
    message: row.message,
    version: row.version,
    assignedToUserId: row.assignedToUserId,
    resolvedByUserId: row.resolvedByUserId,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    buyer: {
      legalEntityId: row.buyerLegalEntityId,
      name: row.buyerName,
      reportedByUserId: row.reportedByUserId,
    },
    lot: {
      id: row.lotId,
      title: row.lotTitle,
      lotNumber: row.lotNumber,
      saleId: row.saleId,
      saleTitle: row.saleTitle,
    },
    payment: {
      id: row.paymentId,
      status: row.paymentStatus,
      amountMinor: Math.round(Number.parseFloat(row.paymentAmount) * 100),
    },
  };
}

/** A search typed as a reference ("PR-3F2A9C1E", or its first characters) matches the case id. */
function searchCondition(search: string): SQL | undefined {
  const text = search.trim();
  if (!text) return undefined;
  const pattern = `%${escapeLikePattern(text)}%`;
  const hex = text.replace(/^pr-?/i, "").replace(/-/g, "");
  const byReference = /^[0-9a-f]{3,32}$/i.test(hex)
    ? sql`replace(${purchaseProblem.id}::text, '-', '') ILIKE ${`${escapeLikePattern(hex)}%`}`
    : undefined;
  return or(ilike(legalEntity.displayName, pattern), ilike(lot.title, pattern), byReference);
}

function filterConditions(
  filters: Pick<PurchaseProblemDeskQuery, "saleId" | "assignee" | "search">,
): Array<SQL | undefined> {
  return [
    filters.saleId ? eq(lot.saleId, filters.saleId) : undefined,
    filters.assignee === "unassigned"
      ? isNull(purchaseProblem.assignedToUserId)
      : filters.assignee
        ? eq(purchaseProblem.assignedToUserId, filters.assignee)
        : undefined,
    filters.search ? searchCondition(filters.search) : undefined,
  ];
}

export class DrizzlePurchaseProblemDeskRepository implements IPurchaseProblemDeskRepository {
  constructor(private readonly db: Database) {}

  async list(query: PurchaseProblemDeskQuery) {
    const where = and(
      query.status ? eq(purchaseProblem.status, query.status) : undefined,
      ...filterConditions(query),
    );
    const [rows, [total]] = await Promise.all([
      selectDesk(this.db)
        .where(where)
        // Oldest first within a status: the report waiting longest is at the top.
        .orderBy(asc(purchaseProblem.createdAt), asc(purchaseProblem.id))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(purchaseProblem)
        .innerJoin(lot, eq(purchaseProblem.lotId, lot.id))
        .innerJoin(legalEntity, eq(purchaseProblem.buyerLegalEntityId, legalEntity.id))
        .where(where),
    ]);
    return { rows: rows.map(toRecord), total: total?.value ?? 0 };
  }

  async counts(
    filters: Pick<PurchaseProblemDeskQuery, "saleId" | "assignee" | "search">,
  ): Promise<PurchaseProblemStatusCounts> {
    const grouped = await this.db
      .select({ status: purchaseProblem.status, value: sql<number>`count(*)::int` })
      .from(purchaseProblem)
      .innerJoin(lot, eq(purchaseProblem.lotId, lot.id))
      .innerJoin(legalEntity, eq(purchaseProblem.buyerLegalEntityId, legalEntity.id))
      .where(and(...filterConditions(filters)))
      .groupBy(purchaseProblem.status);
    const counts = Object.fromEntries(
      PURCHASE_PROBLEM_STATUSES.map((status) => [status, 0]),
    ) as PurchaseProblemStatusCounts;
    for (const row of grouped) counts[row.status as PurchaseProblemStatus] = row.value;
    return counts;
  }

  async salesWithReports() {
    return this.db
      .selectDistinct({ id: sale.id, title: sale.title })
      .from(purchaseProblem)
      .innerJoin(lot, eq(purchaseProblem.lotId, lot.id))
      .innerJoin(sale, eq(lot.saleId, sale.id))
      .orderBy(asc(sale.title));
  }

  async findById(id: string) {
    return this.findIn(this.db, id);
  }

  private async findIn(db: Database, id: string) {
    const [row] = await selectDesk(db).where(eq(purchaseProblem.id, id)).limit(1);
    return row ? toRecord(row) : null;
  }

  async updateInTransaction(
    tx: Database,
    id: string,
    version: number,
    change: PurchaseProblemChange,
  ) {
    const [updated] = await tx
      .update(purchaseProblem)
      .set({
        ...(change.status !== undefined ? { status: change.status } : {}),
        ...(change.assignedToUserId !== undefined
          ? { assignedToUserId: change.assignedToUserId }
          : {}),
        ...(change.resolved !== undefined
          ? {
              resolvedAt: change.resolved?.at ?? null,
              resolvedByUserId: change.resolved?.byUserId ?? null,
            }
          : {}),
        version: sql`${purchaseProblem.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(purchaseProblem.id, id), eq(purchaseProblem.version, version)))
      .returning({ id: purchaseProblem.id });
    return updated ? this.findIn(tx, id) : null;
  }
}

function toNote(row: typeof purchaseProblemNote.$inferSelect): PurchaseProblemNoteRecord {
  return {
    id: row.id,
    purchaseProblemId: row.purchaseProblemId,
    authorUserId: row.authorUserId,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export class DrizzlePurchaseProblemNoteRepository implements IPurchaseProblemNoteRepository {
  constructor(private readonly db: Database) {}

  async addInTransaction(
    tx: Database,
    input: { purchaseProblemId: string; authorUserId: string; body: string },
  ) {
    const [row] = await tx
      .insert(purchaseProblemNote)
      // clock_timestamp() keeps notes added in one transaction in the order they were written.
      .values({ ...input, createdAt: sql`clock_timestamp()` })
      .returning();
    if (!row) throw new Error("purchase problem note insert returned no row");
    return toNote(row);
  }

  async listForProblem(purchaseProblemId: string) {
    const rows = await this.db
      .select()
      .from(purchaseProblemNote)
      .where(eq(purchaseProblemNote.purchaseProblemId, purchaseProblemId))
      .orderBy(asc(purchaseProblemNote.createdAt), asc(purchaseProblemNote.id));
    return rows.map(toNote);
  }
}
