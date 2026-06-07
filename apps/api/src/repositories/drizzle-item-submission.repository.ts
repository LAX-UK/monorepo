import type { Database } from "@auction/db";
import { itemSubmission, submissionCategories } from "@auction/db/schema";
import type { CreateItemSubmissionInput, ItemSubmissionStatus } from "@auction/types";
import {
  type InferInsertModel,
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  sql,
} from "drizzle-orm";
import { mapItemSubmissionRow } from "../lib/mappers.js";
import type {
  IItemSubmissionRepository,
  ItemSubmissionUpdatePatch,
  ListSubmissionsFilter,
} from "../services/interfaces/repositories.js";

function qualityGapsSql() {
  return sql`(
    btrim(${itemSubmission.title}) = '' OR
    NOT EXISTS (
      SELECT 1 FROM ${submissionCategories}
      WHERE ${submissionCategories.submissionId} = ${itemSubmission.id}
    ) OR
    cardinality(${itemSubmission.images}) < 1 OR
    cardinality(${itemSubmission.images}) < 3 OR
    ${itemSubmission.description} IS NULL OR btrim(${itemSubmission.description}) = '' OR
    jsonb_array_length(${itemSubmission.provenance}) = 0
  )`;
}

function titleSearchSql(q: string | undefined) {
  if (!q?.trim()) return undefined;
  const safe = q
    .trim()
    .slice(0, 200)
    .replace(/[%_\\]/g, "");
  if (safe.length === 0) return undefined;
  return ilike(itemSubmission.title, `%${safe}%`);
}

function sellerWhere(legalEntityId: string, f: Omit<ListSubmissionsFilter, "limit" | "offset">) {
  const parts = [eq(itemSubmission.legalEntityId, legalEntityId)];
  if (f.statuses && f.statuses.length > 0) {
    parts.push(inArray(itemSubmission.status, f.statuses));
  } else if (f.status) parts.push(eq(itemSubmission.status, f.status));
  const title = titleSearchSql(f.q);
  if (title) parts.push(title);
  return and(...parts);
}

function adminWhere(f: Omit<ListSubmissionsFilter, "limit" | "offset">) {
  const parts = [];
  if (f.statuses && f.statuses.length > 0) {
    parts.push(inArray(itemSubmission.status, f.statuses));
  } else if (f.status) parts.push(eq(itemSubmission.status, f.status));
  if (f.legalEntityId) parts.push(eq(itemSubmission.legalEntityId, f.legalEntityId));
  if (f.categoryId) {
    parts.push(
      sql`exists (select 1 from ${submissionCategories} where ${submissionCategories.submissionId} = ${itemSubmission.id} and ${submissionCategories.categoryId} = ${f.categoryId})`,
    );
  }
  const title = titleSearchSql(f.q);
  if (title) parts.push(title);
  if (f.qualityGaps) parts.push(qualityGapsSql());
  if (f.assignedToUserId) parts.push(eq(itemSubmission.assignedToUserId, f.assignedToUserId));
  return parts.length > 0 ? and(...parts) : undefined;
}

function adminOrderBy(sort: ListSubmissionsFilter["sort"]) {
  switch (sort) {
    case "oldest":
      return asc(itemSubmission.createdAt);
    case "sla":
      return asc(itemSubmission.updatedAt);
    default:
      return desc(itemSubmission.createdAt);
  }
}

export class DrizzleItemSubmissionRepository implements IItemSubmissionRepository {
  constructor(private readonly db: Database) {}

  private async categoryIdsBySubmissionIds(ids: string[]): Promise<Map<string, string[]>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        submissionId: submissionCategories.submissionId,
        categoryId: submissionCategories.categoryId,
      })
      .from(submissionCategories)
      .where(inArray(submissionCategories.submissionId, ids))
      .orderBy(asc(submissionCategories.sortOrder));
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const arr = map.get(row.submissionId) ?? [];
      arr.push(row.categoryId);
      map.set(row.submissionId, arr);
    }
    return map;
  }

  private async withCategoryIds(
    rows: (typeof itemSubmission.$inferSelect)[],
  ): Promise<ReturnType<typeof mapItemSubmissionRow>[]> {
    const categoriesBySubmission = await this.categoryIdsBySubmissionIds(rows.map((row) => row.id));
    return rows.map((row) => mapItemSubmissionRow(row, categoriesBySubmission.get(row.id) ?? []));
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(itemSubmission)
      .where(eq(itemSubmission.id, id))
      .limit(1);
    if (!row) return null;
    const categories = await this.categoryIdsBySubmissionIds([row.id]);
    return mapItemSubmissionRow(row, categories.get(row.id) ?? []);
  }

  async create(input: CreateItemSubmissionInput) {
    const now = new Date();
    const categoryIds = input.categoryIds ?? (input.categoryId ? [input.categoryId] : []);
    if (!input.legalEntityId) {
      throw new Error("legal_entity_id_required");
    }
    const legalEntityId = input.legalEntityId;

    const row = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(itemSubmission)
        .values({
          legalEntityId,
          title: input.title,
          description: input.description ?? null,
          medium: input.medium ?? null,
          dimensions: input.dimensions ?? null,
          images: input.images ?? [],
          yearOfWork: input.yearOfWork ?? null,
          isSigned: input.isSigned ?? false,
          signatureNote: input.signatureNote ?? null,
          edition: input.edition ?? null,
          conditionSelfReport: input.conditionSelfReport ?? null,
          provenance: input.provenance ?? [],
          exhibitions: input.exhibitions ?? [],
          askingPrice: input.askingPrice ?? null,
          reservePrice: input.reservePrice ?? null,
          submitterNotes: input.submitterNotes ?? null,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw new Error("item_submission insert failed");
      if (categoryIds.length > 0) {
        await tx.insert(submissionCategories).values(
          categoryIds.map((categoryId, index) => ({
            submissionId: created.id,
            categoryId,
            sortOrder: index,
          })),
        );
      }
      return created;
    });
    return mapItemSubmissionRow(row, categoryIds);
  }

  async update(id: string, patch: ItemSubmissionUpdatePatch) {
    type Insert = InferInsertModel<typeof itemSubmission>;
    const rowPatch: Partial<Insert> = { updatedAt: new Date() };
    if (patch.title !== undefined) rowPatch.title = patch.title;
    if (patch.description !== undefined) rowPatch.description = patch.description;
    if (patch.medium !== undefined) rowPatch.medium = patch.medium;
    if (patch.dimensions !== undefined) rowPatch.dimensions = patch.dimensions;
    if (patch.images !== undefined) rowPatch.images = patch.images;
    if (patch.yearOfWork !== undefined) rowPatch.yearOfWork = patch.yearOfWork;
    if (patch.isSigned !== undefined) rowPatch.isSigned = patch.isSigned;
    if (patch.signatureNote !== undefined) rowPatch.signatureNote = patch.signatureNote;
    if (patch.edition !== undefined) rowPatch.edition = patch.edition;
    if (patch.conditionSelfReport !== undefined)
      rowPatch.conditionSelfReport = patch.conditionSelfReport;
    if (patch.provenance !== undefined) rowPatch.provenance = patch.provenance;
    if (patch.exhibitions !== undefined) rowPatch.exhibitions = patch.exhibitions;
    if (patch.askingPrice !== undefined) rowPatch.askingPrice = patch.askingPrice;
    if (patch.reservePrice !== undefined) rowPatch.reservePrice = patch.reservePrice;
    const categoryIds =
      patch.categoryIds !== undefined
        ? patch.categoryIds
        : patch.categoryId
          ? [patch.categoryId]
          : undefined;
    if (patch.submitterNotes !== undefined) rowPatch.submitterNotes = patch.submitterNotes;
    if (patch.status !== undefined) rowPatch.status = patch.status;
    if (patch.reviewedBy !== undefined) rowPatch.reviewedBy = patch.reviewedBy;
    if (patch.reviewedAt !== undefined) rowPatch.reviewedAt = patch.reviewedAt;
    if (patch.reviewNotes !== undefined) rowPatch.reviewNotes = patch.reviewNotes;
    if (patch.rejectionReason !== undefined) rowPatch.rejectionReason = patch.rejectionReason;
    if (patch.convertedLotId !== undefined) rowPatch.convertedLotId = patch.convertedLotId;
    if (patch.assignedToUserId !== undefined) rowPatch.assignedToUserId = patch.assignedToUserId;
    if (patch.draftReminderSentAt !== undefined) {
      rowPatch.draftReminderSentAt = patch.draftReminderSentAt;
    }

    const row = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(itemSubmission)
        .set(rowPatch)
        .where(eq(itemSubmission.id, id))
        .returning();
      if (!updated) throw new Error("item_submission update failed");
      if (categoryIds !== undefined) {
        await tx.delete(submissionCategories).where(eq(submissionCategories.submissionId, id));
        if (categoryIds.length > 0) {
          await tx.insert(submissionCategories).values(
            categoryIds.map((categoryId, index) => ({
              submissionId: id,
              categoryId,
              sortOrder: index,
            })),
          );
        }
      }
      return updated;
    });
    const categories = await this.categoryIdsBySubmissionIds([row.id]);
    return mapItemSubmissionRow(row, categories.get(row.id) ?? []);
  }

  async listForLegalEntity(legalEntityId: string, f: ListSubmissionsFilter) {
    const where = sellerWhere(legalEntityId, f);
    const rows = await this.db
      .select()
      .from(itemSubmission)
      .where(where)
      .orderBy(desc(itemSubmission.updatedAt))
      .limit(f.limit)
      .offset(f.offset);
    return this.withCategoryIds(rows);
  }

  async countForLegalEntity(
    legalEntityId: string,
    f: Omit<ListSubmissionsFilter, "limit" | "offset">,
  ) {
    const where = sellerWhere(legalEntityId, f);
    const [row] = await this.db.select({ n: count() }).from(itemSubmission).where(where);
    return Number(row?.n ?? 0);
  }

  async countStatusForLegalEntity(legalEntityId: string) {
    const rows = await this.db
      .select({ status: itemSubmission.status, n: count() })
      .from(itemSubmission)
      .where(eq(itemSubmission.legalEntityId, legalEntityId))
      .groupBy(itemSubmission.status);
    const out = {
      draft: 0,
      submitted: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      withdrawn: 0,
      converted: 0,
    } satisfies Record<ItemSubmissionStatus, number>;
    for (const row of rows) {
      out[row.status as ItemSubmissionStatus] = Number(row.n ?? 0);
    }
    return out;
  }

  async listForAdmin(f: ListSubmissionsFilter) {
    const where = adminWhere(f);
    const base = this.db
      .select()
      .from(itemSubmission)
      .orderBy(adminOrderBy(f.sort))
      .limit(f.limit)
      .offset(f.offset);
    const rows = where ? await base.where(where) : await base;
    return this.withCategoryIds(rows);
  }

  async countAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">) {
    const where = adminWhere(f);
    const q = this.db.select({ n: count() }).from(itemSubmission);
    const [row] = where ? await q.where(where) : await q;
    return Number(row?.n ?? 0);
  }

  async countAdminForLegalEntityIds(legalEntityIds: readonly string[]) {
    if (legalEntityIds.length === 0) return 0;
    const [row] = await this.db
      .select({ n: count() })
      .from(itemSubmission)
      .where(inArray(itemSubmission.legalEntityId, [...legalEntityIds]));
    return Number(row?.n ?? 0);
  }

  async listStaleDraftsWithoutReminder(cutoff: Date, limit: number) {
    const rows = await this.db
      .select()
      .from(itemSubmission)
      .where(
        and(
          eq(itemSubmission.status, "draft"),
          lt(itemSubmission.updatedAt, cutoff),
          sql`${itemSubmission.draftReminderSentAt} IS NULL`,
        ),
      )
      .orderBy(asc(itemSubmission.updatedAt))
      .limit(limit);
    return this.withCategoryIds(rows);
  }
}
