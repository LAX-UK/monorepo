import type { Database } from "@auction/db";
import {
  itemSubmission,
  legalEntity,
  privateSaleDeal,
  privateSaleDealParty,
} from "@auction/db/schema";
import { type DealScope, consignmentReference, dealViewCriteria } from "@auction/domain";
import type { PrivateSaleDealStage } from "@auction/types";
import { type SQL, and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  DealWork,
  IDealWorkStore,
  IPrivateSaleDealQueryReader,
  NewDealWork,
  PrivateSaleDealListFilter,
  PrivateSaleDealListRow,
  PrivateSaleDealStageCount,
} from "../interfaces/private-sale-deal-query.repository.js";

const seller = alias(privateSaleDealParty, "deal_seller");
const buyer = alias(privateSaleDealParty, "deal_buyer");
const sellerEntity = alias(legalEntity, "deal_seller_entity");
const buyerEntity = alias(legalEntity, "deal_buyer_entity");

/** What a person's scope allows, as conditions on the deal. */
function scopeConditions(scope: DealScope): SQL[] {
  if (scope.kind === "all") return [];
  if (scope.kind === "owned") return [eq(privateSaleDeal.ownerUserId, scope.userId)];
  return [inArray(privateSaleDeal.stage, [...scope.stages])];
}

/** The deal lists staff work from, and the deals a person is named to act in. */
export class DrizzlePrivateSaleDealQueryRepository implements IPrivateSaleDealQueryReader {
  constructor(private readonly db: Database) {}

  async list(filter: PrivateSaleDealListFilter): Promise<PrivateSaleDealListRow[]> {
    const criteria = dealViewCriteria(filter.view);
    const oldestFirst = criteria.order === "oldest_first";
    const conditions: SQL[] = [];
    if (criteria.stages) {
      conditions.push(inArray(privateSaleDeal.stage, [...criteria.stages]));
    }
    conditions.push(...scopeConditions(filter.scope));
    if (criteria.ownedByViewer) {
      conditions.push(eq(privateSaleDeal.ownerUserId, filter.viewerUserId));
    }
    // Compared at the millisecond a cursor can carry, so a row on a page boundary is never repeated.
    const changedAt = sql`date_trunc('milliseconds', ${privateSaleDeal.updatedAt})`;
    if (filter.after) {
      const { updatedAt, id } = filter.after;
      const op = oldestFirst ? sql`>` : sql`<`;
      conditions.push(
        sql`(${changedAt}, ${privateSaleDeal.id}) ${op} (${updatedAt.toISOString()}::timestamptz, ${id}::uuid)`,
      );
    }
    const rows = await this.db
      .select({
        id: privateSaleDeal.id,
        reference: privateSaleDeal.reference,
        stage: privateSaleDeal.stage,
        itemSubmissionId: privateSaleDeal.itemSubmissionId,
        workTitle: itemSubmission.title,
        workNumber: itemSubmission.referenceNumber,
        sellerName: sellerEntity.displayName,
        buyerName: buyerEntity.displayName,
        priceMinor: privateSaleDeal.priceMinor,
        ownerUserId: privateSaleDeal.ownerUserId,
        offerExpiresAt: privateSaleDeal.offerExpiresAt,
        paymentDueAt: privateSaleDeal.paymentDueAt,
        collectionDueAt: privateSaleDeal.collectionDueAt,
        updatedAt: privateSaleDeal.updatedAt,
      })
      .from(privateSaleDeal)
      .innerJoin(itemSubmission, eq(itemSubmission.id, privateSaleDeal.itemSubmissionId))
      .innerJoin(seller, and(eq(seller.dealId, privateSaleDeal.id), eq(seller.role, "seller")))
      .innerJoin(sellerEntity, eq(sellerEntity.id, seller.legalEntityId))
      .leftJoin(buyer, and(eq(buyer.dealId, privateSaleDeal.id), eq(buyer.role, "buyer")))
      .leftJoin(buyerEntity, eq(buyerEntity.id, buyer.legalEntityId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        oldestFirst ? asc(changedAt) : desc(changedAt),
        oldestFirst ? asc(privateSaleDeal.id) : desc(privateSaleDeal.id),
      )
      .limit(filter.limit + 1);
    return rows.map(({ workNumber, stage, ...row }) => ({
      ...row,
      stage: stage as PrivateSaleDealStage,
      workReference: consignmentReference(workNumber),
    }));
  }

  async findLiveDealReferenceForWork(itemSubmissionId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ reference: privateSaleDeal.reference })
      .from(privateSaleDeal)
      .where(
        and(
          eq(privateSaleDeal.itemSubmissionId, itemSubmissionId),
          notInArray(privateSaleDeal.stage, ["cancelled"]),
        ),
      )
      .limit(1);
    return row?.reference ?? null;
  }

  async findReferencesByIds(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: privateSaleDeal.id, reference: privateSaleDeal.reference })
      .from(privateSaleDeal)
      .where(inArray(privateSaleDeal.id, [...ids]));
    return new Map(rows.map((row) => [row.id, row.reference]));
  }

  async countByStage(viewerUserId: string, scope: DealScope): Promise<PrivateSaleDealStageCount[]> {
    const rows = await this.db
      .select({
        stage: privateSaleDeal.stage,
        total: sql<number>`count(*)::int`,
        ownedByViewer: sql<number>`count(*) filter (where ${privateSaleDeal.ownerUserId} = ${viewerUserId})::int`,
      })
      .from(privateSaleDeal)
      .where(and(...scopeConditions(scope)))
      .groupBy(privateSaleDeal.stage);
    return rows.map((row) => ({ ...row, stage: row.stage as PrivateSaleDealStage }));
  }

  async listIdsForActingUser(userId: string, limit: number): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ id: privateSaleDeal.id, updatedAt: privateSaleDeal.updatedAt })
      .from(privateSaleDeal)
      .innerJoin(privateSaleDealParty, eq(privateSaleDealParty.dealId, privateSaleDeal.id))
      .where(eq(privateSaleDealParty.actingUserId, userId))
      .orderBy(desc(privateSaleDeal.updatedAt), desc(privateSaleDeal.id))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async findWorkSummary(
    itemSubmissionId: string,
  ): Promise<{ title: string; reference: string; legalEntityId: string } | null> {
    const [row] = await this.db
      .select({
        title: itemSubmission.title,
        referenceNumber: itemSubmission.referenceNumber,
        legalEntityId: itemSubmission.legalEntityId,
      })
      .from(itemSubmission)
      .where(eq(itemSubmission.id, itemSubmissionId));
    return row
      ? {
          title: row.title,
          reference: consignmentReference(row.referenceNumber),
          legalEntityId: row.legalEntityId,
        }
      : null;
  }
}

/** Opens and finds the works deals are made of. */
export class DrizzleDealWorkStore implements IDealWorkStore {
  constructor(private readonly db: Database) {}

  async createDraftInTransaction(tx: Database, input: NewDealWork): Promise<DealWork> {
    const [row] = await tx
      .insert(itemSubmission)
      .values({
        legalEntityId: input.legalEntityId,
        title: input.title,
        description: input.description,
        medium: input.medium,
        dimensions: input.dimensions,
        submittedByUserId: input.submittedByUserId,
        status: "draft",
      })
      .returning();
    if (!row) throw new Error("the work was not created");
    return toWork(row);
  }

  async lockInTransaction(tx: Database, id: string): Promise<DealWork | null> {
    const [row] = await tx
      .select()
      .from(itemSubmission)
      .where(eq(itemSubmission.id, id))
      .for("update")
      .limit(1);
    return row ? toWork(row) : null;
  }

  async findByReference(reference: string): Promise<DealWork | null> {
    const match = /^C-?(\d{1,15})$/i.exec(reference.trim());
    if (!match?.[1]) return null;
    const [row] = await this.db
      .select()
      .from(itemSubmission)
      .where(eq(itemSubmission.referenceNumber, Number(match[1])));
    return row ? toWork(row) : null;
  }
}

function toWork(row: typeof itemSubmission.$inferSelect): DealWork {
  return {
    id: row.id,
    reference: consignmentReference(row.referenceNumber),
    legalEntityId: row.legalEntityId,
    submittedByUserId: row.submittedByUserId,
    title: row.title,
    status: row.status,
    convertedLotId: row.convertedLotId,
  };
}
